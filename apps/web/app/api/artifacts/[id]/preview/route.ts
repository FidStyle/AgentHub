import { access, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createClient } from '@/lib/app-db-client'
import { parsePresentationDeck } from '@/lib/artifacts/rich-artifacts'
import { requireAuth } from '@/lib/auth-guard'
import { loadCloudWorkspaceRoot, loadOwnedWorkspace } from '@/lib/workspace/workspace-api'
import { NextResponse } from 'next/server'

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
  if (row.artifact_type !== 'presentation') {
    return NextResponse.json({ kind: row.artifact_type, status: 'unsupported', message: '该产物类型不需要预览转换' }, { status: 409 })
  }

  const deck = parsePresentationDeck(row.content, row.title)
  const cloud = await loadCloudWorkspaceRoot(db, owned.workspace, user)
  if (!cloud.ok) return NextResponse.json({ error: cloud.error }, { status: cloud.status })
  const pptxPath = typeof row.source_path === 'string' ? path.join(cloud.root, row.source_path) : null
  const soffice = spawnSync('which', ['soffice'], { encoding: 'utf8' })
  if (!pptxPath || soffice.status !== 0) {
    return NextResponse.json({
      kind: 'presentation',
      status: 'summary',
      message: '当前服务器未安装 soffice，暂提供 PPTX 下载和页摘要预览。',
      slides: deck.slides.map((slide, index) => ({ index: index + 1, title: slide.title, body: slide.body })),
    })
  }
  await access(pptxPath).catch(() => {
    throw new Error('PPTX 文件不存在，请重新生成演示稿')
  })
  const outDir = path.join(cloud.root, 'artifacts', row.id, 'preview')
  await mkdir(outDir, { recursive: true })
  const converted = spawnSync('soffice', ['--headless', '--convert-to', 'pdf', '--outdir', outDir, pptxPath], { encoding: 'utf8', timeout: 120_000 })
  if (converted.status !== 0) {
    return NextResponse.json({
      kind: 'presentation',
      status: 'summary',
      message: converted.stderr || 'PDF 预览转换失败，已回退到页摘要。',
      slides: deck.slides.map((slide, index) => ({ index: index + 1, title: slide.title, body: slide.body })),
    })
  }
  const pdfName = `${path.basename(pptxPath, path.extname(pptxPath))}.pdf`
  const pdfPath = path.relative(cloud.root, path.join(outDir, pdfName)).replace(/\\/g, '/')
  await db.from('artifacts').update({
    metadata: { ...(row.metadata ?? {}), previewStatus: 'pdf', previewPdfPath: pdfPath },
    updated_at: new Date().toISOString(),
  }).eq('id', row.id)
  return NextResponse.json({ kind: 'presentation', status: 'pdf', pdfPath, url: `/api/workspaces/${row.workspace_id}/files/download?path=${encodeURIComponent(pdfPath)}` })
}
