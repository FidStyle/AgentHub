import { access, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createClient } from '@/lib/app-db-client'
import { requireAuth } from '@/lib/auth-guard'
import { resolveWorkspacePath } from '@/lib/workspace/cloud-workspace-fs'
import { loadCloudWorkspaceRoot, loadOwnedWorkspace } from '@/lib/workspace/workspace-api'
import { NextResponse } from 'next/server'

function findSofficeCommand() {
  const explicit = process.env.SOFFICE_BIN || process.env.LIBREOFFICE_BIN
  if (explicit) return explicit
  const which = spawnSync('which', ['soffice'], { encoding: 'utf8' })
  if (which.status === 0 && which.stdout.trim()) return which.stdout.trim()
  const macPath = '/Applications/LibreOffice.app/Contents/MacOS/soffice'
  const mac = spawnSync(macPath, ['--version'], { encoding: 'utf8', timeout: 10_000 })
  if (mac.status === 0) return macPath
  return null
}

function findMagickCommand() {
  const explicit = process.env.MAGICK_BIN || process.env.IMAGEMAGICK_BIN
  if (explicit) return explicit
  const which = spawnSync('which', ['magick'], { encoding: 'utf8' })
  if (which.status === 0 && which.stdout.trim()) return which.stdout.trim()
  return null
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderMarkdownishHtml(markdown: string) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const html: string[] = []
  let listOpen = false
  const closeList = () => {
    if (listOpen) {
      html.push('</ul>')
      listOpen = false
    }
  }
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) {
      closeList()
      continue
    }
    const heading = line.match(/^(#{1,4})\s+(.+)$/)
    if (heading) {
      closeList()
      const level = heading[1].length
      html.push(`<h${level}>${escapeHtml(heading[2])}</h${level}>`)
      continue
    }
    const bullet = line.match(/^[-*]\s+(.+)$/)
    if (bullet) {
      if (!listOpen) {
        html.push('<ul>')
        listOpen = true
      }
      html.push(`<li>${escapeHtml(bullet[1])}</li>`)
      continue
    }
    closeList()
    html.push(`<p>${escapeHtml(line)}</p>`)
  }
  closeList()
  return html.join('\n')
}

function officePreviewShell(title: string, body: string) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f6f7f9; color: #111827; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 24px; }
    main { max-width: 960px; margin: 0 auto; }
    article { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 32px; line-height: 1.75; box-shadow: 0 1px 2px rgba(15, 23, 42, .06); }
    h1, h2, h3, h4 { line-height: 1.25; margin: 1.2em 0 .55em; }
    h1:first-child, h2:first-child, h3:first-child { margin-top: 0; }
    p { margin: .8em 0; }
    ul { padding-left: 1.35rem; }
    li { margin: .35em 0; list-style: disc; }
    .slide-page { margin: 0 auto 24px; max-width: 1120px; }
    .slide-page img { display: block; width: 100%; height: auto; border: 1px solid #d1d5db; border-radius: 8px; background: #fff; box-shadow: 0 1px 2px rgba(15, 23, 42, .08); }
    .slide-caption { margin: 0 0 8px; font-size: 13px; color: #6b7280; }
  </style>
</head>
<body>
  <main>${body}</main>
</body>
</html>`
}

async function newestFilePath(outDir: string, extension: string) {
  const entries = await readdir(outDir).catch(() => [])
  const files = await Promise.all(entries
    .filter((entry) => entry.toLowerCase().endsWith(extension))
    .map(async (entry) => {
      const fullPath = path.join(outDir, entry)
      const info = await stat(fullPath).catch(() => null)
      return info?.isFile() ? { fullPath, mtimeMs: info.mtimeMs } : null
    }))
  return files
    .filter((entry): entry is { fullPath: string; mtimeMs: number } => Boolean(entry))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0]?.fullPath ?? null
}

async function convertOfficeToPdf(inputPath: string, outDir: string) {
  const externalCommand = process.env.PPT_TO_PDF_COMMAND || process.env.PPT_MASTER_CONVERT_COMMAND
  if (externalCommand) {
    const converted = spawnSync(externalCommand, [inputPath, outDir], { encoding: 'utf8', timeout: 120_000 })
    const pdfPath = await newestFilePath(outDir, '.pdf')
    return {
      ok: converted.status === 0 && Boolean(pdfPath),
      command: externalCommand,
      pdfPath,
      stderr: converted.stderr,
    }
  }

  const soffice = findSofficeCommand()
  if (!soffice) {
    return { ok: false, command: null, pdfPath: null, stderr: '当前服务器未安装 LibreOffice/soffice，也未配置 SOFFICE_BIN 或 PPT_TO_PDF_COMMAND。' }
  }
  const converted = spawnSync(soffice, ['--headless', '--convert-to', 'pdf', '--outdir', outDir, inputPath], { encoding: 'utf8', timeout: 120_000 })
  const pdfPath = await newestFilePath(outDir, '.pdf')
  return {
    ok: converted.status === 0 && Boolean(pdfPath),
    command: soffice,
    pdfPath,
    stderr: converted.stderr,
  }
}

async function convertOfficeToHtml(inputPath: string, outDir: string) {
  const soffice = findSofficeCommand()
  if (!soffice) {
    return { ok: false, command: null, htmlPath: null, stderr: '当前服务器未安装 LibreOffice/soffice，也未配置 SOFFICE_BIN。' }
  }
  const converted = spawnSync(soffice, ['--headless', '--convert-to', 'html', '--outdir', outDir, inputPath], { encoding: 'utf8', timeout: 120_000 })
  const htmlPath = await newestFilePath(outDir, '.html')
  return {
    ok: converted.status === 0 && Boolean(htmlPath),
    command: soffice,
    htmlPath,
    stderr: converted.stderr,
  }
}

async function imagePagesFromDir(pagesDir: string) {
  const entries = await readdir(pagesDir).catch(() => [])
  return entries
    .filter((entry) => entry.toLowerCase().endsWith('.png'))
    .sort((a, b) => a.localeCompare(b))
    .map((entry) => path.join(pagesDir, entry))
}

async function convertPresentationToImages(inputPath: string, outDir: string) {
  await mkdir(outDir, { recursive: true })
  const intermediateDir = path.join(outDir, 'intermediate')
  const pagesDir = path.join(outDir, 'pages')
  await rm(intermediateDir, { recursive: true, force: true })
  await rm(pagesDir, { recursive: true, force: true })
  await mkdir(intermediateDir, { recursive: true })
  await mkdir(pagesDir, { recursive: true })

  const pdf = await convertOfficeToPdf(inputPath, intermediateDir)
  if (!pdf.ok || !pdf.pdfPath) {
    return { ok: false, command: pdf.command, pagePaths: [] as string[], stderr: pdf.stderr || 'LibreOffice/soffice 无法生成中间 PDF。' }
  }
  const magick = findMagickCommand()
  if (!magick) {
    return { ok: false, command: null, pagePaths: [] as string[], stderr: '当前服务器未安装 ImageMagick/magick，无法把演示稿页面渲染为 PNG。' }
  }
  const outputPattern = path.join(pagesDir, 'page-%02d.png')
  const rendered = spawnSync(magick, ['-density', '144', pdf.pdfPath, '-quality', '92', outputPattern], { encoding: 'utf8', timeout: 120_000 })
  const pagePaths = await imagePagesFromDir(pagesDir)
  return {
    ok: rendered.status === 0 && pagePaths.length > 0,
    command: `${pdf.command ?? 'soffice'} + ${magick}`,
    pagePaths,
    stderr: rendered.stderr || pdf.stderr,
  }
}

function buildPresentationHtml(input: { title: string; workspaceId: string; cloudRoot: string; pagePaths: string[] }) {
  const pages = input.pagePaths.map((pagePath, index) => {
    const rel = path.relative(input.cloudRoot, pagePath).replace(/\\/g, '/')
    const url = `/api/workspaces/${input.workspaceId}/files/inline?path=${encodeURIComponent(rel)}`
    return { rel, url, index }
  })
  const body = pages.map((page) => `
    <section class="slide-page">
      <div class="slide-caption">第 ${page.index + 1} 页</div>
      <img src="${page.url}" alt="${escapeHtml(input.title)} 第 ${page.index + 1} 页" loading="lazy" />
    </section>
  `).join('\n')
  return { html: officePreviewShell(input.title, body), pages }
}

function rewriteWorkspaceAssetUrls(html: string, workspaceId: string, htmlRelativePath: string) {
  const baseDir = path.posix.dirname(htmlRelativePath)
  return html.replace(/\b(src|href)=["']([^"']+)["']/gi, (match, attr: string, value: string) => {
    if (/^(?:https?:|data:|mailto:|#|\/)/i.test(value)) return match
    const rel = path.posix.normalize(path.posix.join(baseDir, value))
    return `${attr}="/api/workspaces/${workspaceId}/files/inline?path=${encodeURIComponent(rel)}"`
  })
}

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, error: authError } = await requireAuth()
  if (authError) return authError
  const db = await createClient()
  const { data: artifact } = await db.from('artifacts').select('*').eq('id', id).single()
  if (!artifact) return NextResponse.json({ error: '产物不存在' }, { status: 404 })
  const row = artifact as unknown as {
    id: string
    workspace_id: string
    artifact_type: string
    title: string
    content?: string | null
    source_path?: string | null
    metadata?: Record<string, unknown> | null
  }
  const owned = await loadOwnedWorkspace(db, row.workspace_id, user)
  if (!owned.ok) return NextResponse.json({ error: owned.error }, { status: owned.status })

  if (row.artifact_type === 'html' || row.metadata?.publishUrl) {
    return NextResponse.json({
      kind: 'web',
      status: row.metadata?.publishStatus ?? 'stopped',
      url: typeof row.metadata?.publishUrl === 'string' ? row.metadata.publishUrl : null,
    })
  }
  if (row.artifact_type === 'markdown') {
    await db.from('artifacts').update({
      metadata: { ...(row.metadata ?? {}), previewStatus: 'markdown' },
      updated_at: new Date().toISOString(),
    }).eq('id', row.id)
    return NextResponse.json({
      kind: 'markdown',
      status: 'markdown',
      content: row.content ?? '',
      url: `/m/preview?artifactId=${encodeURIComponent(row.id)}`,
      downloadUrl: `/api/artifacts/${row.id}/download`,
    })
  }

  if (row.artifact_type === 'document' && !row.source_path) {
    const html = officePreviewShell(row.title, `<article>${renderMarkdownishHtml(row.content ?? '')}</article>`)
    await db.from('artifacts').update({
      metadata: { ...(row.metadata ?? {}), previewStatus: 'html' },
      updated_at: new Date().toISOString(),
    }).eq('id', row.id)
    return NextResponse.json({
      kind: 'document',
      status: 'html',
      html,
      downloadUrl: `/api/artifacts/${row.id}/download`,
    })
  }

  if (row.artifact_type !== 'document' && row.artifact_type !== 'presentation') {
    return NextResponse.json({ kind: row.artifact_type, status: 'unsupported', message: '该产物类型不需要预览转换' }, { status: 409 })
  }

  const cloud = await loadCloudWorkspaceRoot(db, owned.workspace, user)
  if (!cloud.ok) return NextResponse.json({ error: cloud.error }, { status: cloud.status })
  const source = typeof row.source_path === 'string' ? resolveWorkspacePath(cloud.root, row.source_path) : null
  if (!source) {
    const message = '产物缺少源文件路径，无法生成真实预览。'
    await db.from('artifacts').update({
      metadata: { ...(row.metadata ?? {}), previewStatus: 'unavailable', previewError: message },
      updated_at: new Date().toISOString(),
    }).eq('id', row.id)
    return NextResponse.json({ kind: row.artifact_type, status: 'unavailable', message }, { status: 409 })
  }
  await access(source.fullPath).catch(() => {
    throw new Error('源文件不存在，请重新生成产物')
  })
  const outDir = path.join(cloud.root, 'artifacts', row.id, 'preview')
  await mkdir(outDir, { recursive: true })

  if (row.artifact_type === 'document') {
    const ext = path.extname(source.relativePath).toLowerCase()
    const content = typeof row.content === 'string' && row.content.trim()
      ? row.content
      : ['.md', '.markdown', '.txt'].includes(ext)
        ? await readFile(source.fullPath, 'utf8')
        : null
    let html: string | null = content ? officePreviewShell(row.title, `<article>${renderMarkdownishHtml(content)}</article>`) : null
    let converter: string | null = 'markdown-html'

    if (!html && ['.doc', '.docx'].includes(ext)) {
      const converted = await convertOfficeToHtml(source.fullPath, outDir)
      if (!converted.ok || !converted.htmlPath) {
        const message = converted.stderr || 'LibreOffice/soffice 转换 HTML 预览失败。'
        await db.from('artifacts').update({
          metadata: { ...(row.metadata ?? {}), previewStatus: 'failed', previewError: message, previewConverter: converted.command },
          updated_at: new Date().toISOString(),
        }).eq('id', row.id)
        return NextResponse.json({ kind: row.artifact_type, status: 'failed', message }, { status: 503 })
      }
      const htmlRelativePath = path.relative(cloud.root, converted.htmlPath).replace(/\\/g, '/')
      html = rewriteWorkspaceAssetUrls(await readFile(converted.htmlPath, 'utf8'), row.workspace_id, htmlRelativePath)
      converter = converted.command
    }

    if (!html) {
      const message = '文档预览需要 Markdown/正文内容或可转换的 DOC/DOCX 源文件。'
      await db.from('artifacts').update({
        metadata: { ...(row.metadata ?? {}), previewStatus: 'unavailable', previewError: message },
        updated_at: new Date().toISOString(),
      }).eq('id', row.id)
      return NextResponse.json({ kind: row.artifact_type, status: 'unavailable', message }, { status: 409 })
    }

    const htmlPath = path.join(outDir, 'index.html')
    await writeFile(htmlPath, html, 'utf8')
    const htmlRelativePath = path.relative(cloud.root, htmlPath).replace(/\\/g, '/')
    await db.from('artifacts').update({
      metadata: { ...(row.metadata ?? {}), previewStatus: 'html', previewHtmlPath: htmlRelativePath, previewConverter: converter },
      updated_at: new Date().toISOString(),
    }).eq('id', row.id)
    return NextResponse.json({ kind: row.artifact_type, status: 'html', htmlPath: htmlRelativePath, html })
  }

  const converted = await convertPresentationToImages(source.fullPath, outDir)
  if (!converted.ok) {
    const message = converted.stderr || '演示稿页面渲染为 PNG 失败。'
    await db.from('artifacts').update({
      metadata: { ...(row.metadata ?? {}), previewStatus: 'failed', previewError: message, previewConverter: converted.command },
      updated_at: new Date().toISOString(),
    }).eq('id', row.id)
    return NextResponse.json({ kind: row.artifact_type, status: 'failed', message }, { status: 503 })
  }
  const presentation = buildPresentationHtml({
    title: row.title,
    workspaceId: row.workspace_id,
    cloudRoot: cloud.root,
    pagePaths: converted.pagePaths,
  })
  const htmlPath = path.join(outDir, 'index.html')
  await writeFile(htmlPath, presentation.html, 'utf8')
  const htmlRelativePath = path.relative(cloud.root, htmlPath).replace(/\\/g, '/')
  const pageRelativePaths = converted.pagePaths.map((pagePath) => path.relative(cloud.root, pagePath).replace(/\\/g, '/'))
  await db.from('artifacts').update({
    metadata: {
      ...(row.metadata ?? {}),
      previewStatus: 'html',
      previewHtmlPath: htmlRelativePath,
      previewImagePaths: pageRelativePaths,
      previewConverter: converted.command,
    },
    updated_at: new Date().toISOString(),
  }).eq('id', row.id)
  return NextResponse.json({
    kind: row.artifact_type,
    status: 'html',
    htmlPath: htmlRelativePath,
    html: presentation.html,
    pages: presentation.pages.map((page) => ({ path: page.rel, url: page.url })),
  })
}
