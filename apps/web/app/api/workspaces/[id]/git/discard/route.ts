import { createClient } from '@/lib/app-db-client'
import { requireAuth } from '@/lib/auth-guard'
import { discardWorkspaceGitPath, readWorkspaceGitStatus } from '@/lib/workspace/cloud-workspace-fs'
import { loadCloudWorkspaceRoot, loadOwnedWorkspace } from '@/lib/workspace/workspace-api'
import { NextResponse } from 'next/server'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const body = await request.json().catch(() => ({}))
  const filePath = typeof body.path === 'string' ? body.path : ''
  const sessionId = typeof body.session_id === 'string' ? body.session_id : null
  const confirm = body.confirm === true
  if (!filePath) return NextResponse.json({ error: 'path 必填' }, { status: 400 })
  if (!confirm) {
    return NextResponse.json({ error: '丢弃改动需要明确确认', approvalRequired: true }, { status: 409 })
  }

  const db = await createClient()
  const owned = await loadOwnedWorkspace(db, id, user)
  if (!owned.ok) return NextResponse.json({ error: owned.error }, { status: owned.status })
  if (sessionId) {
    const { data: session } = await db.from('sessions').select('workspace_id').eq('id', sessionId).single()
    if (!session || (session as { workspace_id?: string }).workspace_id !== id) {
      return NextResponse.json({ error: '会话不属于当前工作区' }, { status: 403 })
    }
  }
  const cloud = await loadCloudWorkspaceRoot(db, owned.workspace, user)
  if (!cloud.ok) return NextResponse.json({ error: cloud.error }, { status: cloud.status })

  try {
    const { data: action } = sessionId
      ? await db.from('actions').insert({
          session_id: sessionId,
          owner_id: user.id,
          action_type: 'git_discard',
          command: `git discard -- ${filePath}`,
          cwd: cloud.root,
          risk_level: 'high',
          status: 'approved',
          requires_approval: true,
          approved_at: new Date().toISOString(),
        }).select('id').single()
      : { data: null }
    await discardWorkspaceGitPath(cloud.root, filePath)
    if (action?.id) {
      await db.from('actions').update({
        status: 'completed',
        executed_at: new Date().toISOString(),
        result: { path: filePath, operation: 'git_discard' },
      }).eq('id', action.id)
    }
    return NextResponse.json({ ok: true, changes: await readWorkspaceGitStatus(cloud.root) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '丢弃工作区改动失败' }, { status: 400 })
  }
}
