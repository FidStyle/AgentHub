import { access, mkdir, readdir, stat } from 'node:fs/promises'
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

async function newestPdfPath(outDir: string) {
  const entries = await readdir(outDir).catch(() => [])
  const pdfs = await Promise.all(entries
    .filter((entry) => entry.toLowerCase().endsWith('.pdf'))
    .map(async (entry) => {
      const fullPath = path.join(outDir, entry)
      const info = await stat(fullPath).catch(() => null)
      return info?.isFile() ? { fullPath, mtimeMs: info.mtimeMs } : null
    }))
  return pdfs
    .filter((entry): entry is { fullPath: string; mtimeMs: number } => Boolean(entry))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0]?.fullPath ?? null
}

async function convertOfficeToPdf(inputPath: string, outDir: string) {
  const externalCommand = process.env.PPT_TO_PDF_COMMAND || process.env.PPT_MASTER_CONVERT_COMMAND
  if (externalCommand) {
    const converted = spawnSync(externalCommand, [inputPath, outDir], { encoding: 'utf8', timeout: 120_000 })
    const pdfPath = await newestPdfPath(outDir)
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
  const pdfPath = await newestPdfPath(outDir)
  return {
    ok: converted.status === 0 && Boolean(pdfPath),
    command: soffice,
    pdfPath,
    stderr: converted.stderr,
  }
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
    await db.from('artifacts').update({
      metadata: { ...(row.metadata ?? {}), previewStatus: 'markdown' },
      updated_at: new Date().toISOString(),
    }).eq('id', row.id)
    return NextResponse.json({
      kind: 'document',
      status: 'markdown',
      content: row.content ?? '',
      url: `/m/preview?artifactId=${encodeURIComponent(row.id)}`,
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
  const converted = await convertOfficeToPdf(source.fullPath, outDir)
  if (!converted.ok) {
    const message = converted.stderr || 'LibreOffice/soffice 转换 PDF 预览失败。'
    await db.from('artifacts').update({
      metadata: { ...(row.metadata ?? {}), previewStatus: 'failed', previewError: message, previewConverter: converted.command },
      updated_at: new Date().toISOString(),
    }).eq('id', row.id)
    return NextResponse.json({ kind: row.artifact_type, status: 'failed', message }, { status: 503 })
  }
  const pdfPath = path.relative(cloud.root, converted.pdfPath ?? '').replace(/\\/g, '/')
  await db.from('artifacts').update({
    metadata: { ...(row.metadata ?? {}), previewStatus: 'pdf', previewPdfPath: pdfPath, previewConverter: converted.command },
    updated_at: new Date().toISOString(),
  }).eq('id', row.id)
  return NextResponse.json({ kind: row.artifact_type, status: 'pdf', pdfPath, url: `/api/workspaces/${row.workspace_id}/files/download?path=${encodeURIComponent(pdfPath)}` })
}
