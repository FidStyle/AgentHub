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
  const actionId = typeof body.action_id === 'string' ? body.action_id : null
  const confirm = body.confirm === true
  if (!filePath) return NextResponse.json({ error: 'path 必填' }, { status: 400 })

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
    if (!confirm) {
      if (!sessionId) {
        return NextResponse.json({ error: '丢弃改动需要明确确认', approvalRequired: true }, { status: 409 })
      }
      const { data: action } = await db.from('actions').insert({
        session_id: sessionId,
        owner_id: user.id,
        action_type: 'git_discard',
        command: `git discard -- ${filePath}`,
        cwd: cloud.root,
        risk_level: 'high',
        status: 'pending',
        requires_approval: true,
        result: { path: filePath, operation: 'git_discard', state: 'waiting_approval' },
      }).select('*').single()
      if (action?.id) {
        await db.from('notifications').insert({
          user_id: user.id,
          type: 'approval_required',
          title: `丢弃改动需要授权: ${filePath}`,
          body: '该操作会丢弃真实 Git 工作区中的未暂存改动。',
          ref_type: 'action',
          ref_id: action.id,
        })
      }
      return NextResponse.json({ error: '丢弃改动需要明确确认', approvalRequired: true, action }, { status: 409 })
    }

    type GitDiscardActionRow = {
      id?: string
      session_id?: string
      status?: string
      action_type?: string
      command?: string
      result?: { path?: string } | null
    }
    let action: GitDiscardActionRow | null = null
    if (sessionId && actionId) {
      const { data } = await db.from('actions')
        .select('id, session_id, status, action_type, command, result')
        .eq('id', actionId)
        .eq('owner_id', user.id)
        .single()
      action = data as unknown as GitDiscardActionRow | null
      if (!action || action.action_type !== 'git_discard') {
        return NextResponse.json({ error: '授权动作不存在' }, { status: 404 })
      }
      if (action.status !== 'approved') {
        return NextResponse.json({ error: '丢弃改动尚未授权' }, { status: 409 })
      }
      if (action.session_id !== sessionId || action.command !== `git discard -- ${filePath}`) {
        return NextResponse.json({ error: '授权动作与当前丢弃目标不匹配' }, { status: 409 })
      }
    } else if (sessionId) {
      const { data } = await db.from('actions').insert({
          session_id: sessionId,
          owner_id: user.id,
          action_type: 'git_discard',
          command: `git discard -- ${filePath}`,
          cwd: cloud.root,
          risk_level: 'high',
          status: 'approved',
          requires_approval: true,
          approved_at: new Date().toISOString(),
        }).select('id, status').single()
      action = data as { id?: string; status?: string } | null
    }
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
