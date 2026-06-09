import { access, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createClient } from '@/lib/app-db-client'
import { parsePresentationDeck } from '@/lib/artifacts/rich-artifacts'
import { requireAuth } from '@/lib/auth-guard'
import { loadCloudWorkspaceRoot, loadOwnedWorkspace } from '@/lib/workspace/workspace-api'
import { NextResponse } from 'next/server'

function slideSummary(row: { content?: string | null; title: string }) {
  const deck = parsePresentationDeck(row.content, row.title)
  return deck.slides.map((slide, index) => ({ index: index + 1, title: slide.title, body: slide.body }))
}

function convertPptxToPdf(inputPath: string, outDir: string) {
  const externalCommand = process.env.PPT_TO_PDF_COMMAND || process.env.PPT_MASTER_CONVERT_COMMAND
  if (externalCommand) {
    const converted = spawnSync(externalCommand, [inputPath, outDir], { encoding: 'utf8', timeout: 120_000 })
    return {
      ok: converted.status === 0,
      command: externalCommand,
      stderr: converted.stderr,
    }
  }

  const soffice = spawnSync('which', ['soffice'], { encoding: 'utf8' })
  if (soffice.status !== 0) {
    return { ok: false, command: null, stderr: '当前服务器未安装 soffice，也未配置 PPT_TO_PDF_COMMAND。' }
  }
  const converted = spawnSync('soffice', ['--headless', '--convert-to', 'pdf', '--outdir', outDir, inputPath], { encoding: 'utf8', timeout: 120_000 })
  return {
    ok: converted.status === 0,
    command: 'soffice',
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
  if (row.artifact_type === 'markdown' || row.artifact_type === 'document') {
    const previewStatus = row.artifact_type === 'markdown' ? 'markdown' : 'document'
    await db.from('artifacts').update({
      metadata: { ...(row.metadata ?? {}), previewStatus },
      updated_at: new Date().toISOString(),
    }).eq('id', row.id)
    return NextResponse.json({
      kind: row.artifact_type,
      status: 'markdown',
      content: row.content ?? '',
      url: `/m/preview?artifactId=${encodeURIComponent(row.id)}`,
      downloadUrl: `/api/artifacts/${row.id}/download`,
    })
  }
  if (row.artifact_type !== 'presentation') {
    return NextResponse.json({ kind: row.artifact_type, status: 'unsupported', message: '该产物类型不需要预览转换' }, { status: 409 })
  }

  const cloud = await loadCloudWorkspaceRoot(db, owned.workspace, user)
  if (!cloud.ok) return NextResponse.json({ error: cloud.error }, { status: cloud.status })
  const pptxPath = typeof row.source_path === 'string' ? path.join(cloud.root, row.source_path) : null
  if (!pptxPath) {
    const message = 'PPTX 文件不存在，暂提供页摘要预览。'
    await db.from('artifacts').update({
      metadata: { ...(row.metadata ?? {}), previewStatus: 'summary', previewError: message },
      updated_at: new Date().toISOString(),
    }).eq('id', row.id)
    return NextResponse.json({
      kind: 'presentation',
      status: 'summary',
      message,
      slides: slideSummary(row),
    })
  }
  await access(pptxPath).catch(() => {
    throw new Error('PPTX 文件不存在，请重新生成演示稿')
  })
  const outDir = path.join(cloud.root, 'artifacts', row.id, 'preview')
  await mkdir(outDir, { recursive: true })
  const converted = convertPptxToPdf(pptxPath, outDir)
  if (!converted.ok) {
    const message = converted.stderr || 'PDF 预览转换失败，已回退到页摘要。'
    await db.from('artifacts').update({
      metadata: { ...(row.metadata ?? {}), previewStatus: 'summary', previewError: message, previewConverter: converted.command },
      updated_at: new Date().toISOString(),
    }).eq('id', row.id)
    return NextResponse.json({
      kind: 'presentation',
      status: 'summary',
      message,
      slides: slideSummary(row),
    })
  }
  const pdfName = `${path.basename(pptxPath, path.extname(pptxPath))}.pdf`
  const pdfPath = path.relative(cloud.root, path.join(outDir, pdfName)).replace(/\\/g, '/')
  await db.from('artifacts').update({
    metadata: { ...(row.metadata ?? {}), previewStatus: 'pdf', previewPdfPath: pdfPath, previewConverter: converted.command },
    updated_at: new Date().toISOString(),
  }).eq('id', row.id)
  return NextResponse.json({ kind: 'presentation', status: 'pdf', pdfPath, url: `/api/workspaces/${row.workspace_id}/files/download?path=${encodeURIComponent(pdfPath)}` })
}
