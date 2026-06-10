import { createClient } from '@/lib/app-db-client'
import { createPresentationArtifact } from '@/lib/artifacts/presentation-artifact'
import { requireAuth } from '@/lib/auth-guard'
import { loadCloudWorkspaceRoot, loadOwnedWorkspace } from '@/lib/workspace/workspace-api'
import { NextResponse } from 'next/server'

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
    const result = await createPresentationArtifact({
      db,
      userId: user.id,
      workspaceId,
      workspaceRoot: cloud.root,
      sessionId,
      title,
      prompt,
      sourcePath,
      sourceMessageId: typeof body.source_message_id === 'string' ? body.source_message_id : null,
    })
    return NextResponse.json({ artifact: result.artifact, pptxPath: result.pptxPath }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'PPTX 生成失败' }, { status: 500 })
  }
}
