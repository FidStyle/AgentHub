import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@/lib/app-db-client'
import { createPptxBuffer } from '@/lib/artifacts/rich-artifact-export'
import { defaultPresentationDeck, parsePresentationDeck, serializePresentationDeck } from '@/lib/artifacts/rich-artifacts'
import { requireAuth } from '@/lib/auth-guard'
import { loadCloudWorkspaceRoot, loadOwnedWorkspace } from '@/lib/workspace/workspace-api'
import { NextResponse } from 'next/server'

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, '-').replace(/^-|-$/g, '').slice(0, 64) || `deck-${Date.now()}`
}

async function assertSessionInWorkspace(db: Awaited<ReturnType<typeof createClient>>, sessionId: string | null, workspaceId: string) {
  if (!sessionId) return true
  const { data } = await db.from('sessions').select('workspace_id').eq('id', sessionId).single()
  return Boolean(data && (data as { workspace_id?: string }).workspace_id === workspaceId)
}

export async function POST(request: Request) {
  const { user, error: authError } = await requireAuth()
  if (authError) return authError
  const body = await request.json()
  const workspaceId = typeof body.workspace_id === 'string' ? body.workspace_id : ''
  const sessionId = typeof body.session_id === 'string' ? body.session_id : null
  const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : 'AgentHub 演示稿'
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
  const sourcePath = typeof body.source_path === 'string' && body.source_path ? body.source_path : null
  if (!workspaceId) return NextResponse.json({ error: '缺少 workspace_id' }, { status: 400 })

  const db = await createClient()
  const owned = await loadOwnedWorkspace(db, workspaceId, user)
  if (!owned.ok) return NextResponse.json({ error: owned.error }, { status: owned.status })
  if (!(await assertSessionInWorkspace(db, sessionId, workspaceId))) {
    return NextResponse.json({ error: '会话不存在或不属于当前工作区' }, { status: 403 })
  }
  const cloud = await loadCloudWorkspaceRoot(db, owned.workspace, user)
  if (!cloud.ok) return NextResponse.json({ error: cloud.error }, { status: cloud.status })

  try {
    const sourceContent = sourcePath
      ? await readFile(path.join(cloud.root, sourcePath), 'utf8').catch(() => '')
      : ''
    const deck = sourceContent
      ? parsePresentationDeck(sourceContent, title)
      : prompt
        ? {
            ...defaultPresentationDeck(title),
            slides: [
              { title, body: [prompt.slice(0, 120), '由 AgentHub 根据对话需求生成，可下载为可编辑 PPTX。'] },
              ...defaultPresentationDeck(title).slides.slice(1),
            ],
          }
        : defaultPresentationDeck(title)
    const content = serializePresentationDeck(deck)
    const slug = slugify(title)
    const artifactDir = path.join(cloud.root, 'artifacts', slug)
    await mkdir(artifactDir, { recursive: true })
    const pptxPath = path.join(artifactDir, 'deck.pptx')
    await writeFile(pptxPath, createPptxBuffer(deck))
    const sourceArtifactPath = path.relative(cloud.root, pptxPath).replace(/\\/g, '/')

    const { data, error } = await db.from('artifacts').insert({
      workspace_id: workspaceId,
      session_id: sessionId,
      source_message_id: typeof body.source_message_id === 'string' ? body.source_message_id : null,
      source_run_id: null,
      source_path: sourceArtifactPath,
      artifact_type: 'presentation',
      title,
      content,
      content_ref: `workspace-file:${workspaceId}:${sourceArtifactPath}`,
      metadata: {
        generator: 'agenthub-openxml-fallback',
        pptMasterStatus: process.env.PPT_MASTER_HOME ? 'configured_not_used' : 'not_configured',
        sourcePath,
        pptxPath: sourceArtifactPath,
        workspaceDownloadUrl: `/api/workspaces/${workspaceId}/files/download?path=${encodeURIComponent(sourceArtifactPath)}`,
        previewStatus: 'summary',
        slides: deck.slides.map((slide, index) => ({ index: index + 1, title: slide.title, body: slide.body })),
      },
      created_by: user.id,
    }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ artifact: data, pptxPath: sourceArtifactPath }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'PPTX 生成失败' }, { status: 500 })
  }
}
