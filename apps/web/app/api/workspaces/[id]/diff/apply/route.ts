import path from 'node:path'
import { createClient } from '@/lib/app-db-client'
import { requireAuth } from '@/lib/auth-guard'
import { classifyRisk } from '@/lib/orchestrator/permission-engine'
import { loadCloudWorkspaceRoot, loadOwnedWorkspace } from '@/lib/workspace/workspace-api'
import { NextResponse } from 'next/server'

function diffPaths(diff: string) {
  const paths = new Set<string>()
  for (const match of diff.matchAll(/^(?:---|\+\+\+) [ab]\/(.+)$/gm)) {
    const value = match[1]?.trim()
    if (value && value !== '/dev/null') paths.add(value)
  }
  return [...paths]
}

function isUnifiedDiff(value: string) {
  return /^--- .+\n\+\+\+ .+\n@@ /m.test(value)
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: workspaceId } = await params
  const { user, error: authError } = await requireAuth()
  if (authError) return authError
  const body = await request.json()
  const sessionId = typeof body.session_id === 'string' ? body.session_id : ''
  const messageId = typeof body.message_id === 'string' ? body.message_id : null
  const diff = typeof body.diff === 'string' ? body.diff : ''
  if (!sessionId) return NextResponse.json({ error: '缺少 session_id' }, { status: 400 })
  if (!isUnifiedDiff(diff)) return NextResponse.json({ error: '不是合法 unified diff，无法创建应用审批' }, { status: 400 })

  const db = await createClient()
  const owned = await loadOwnedWorkspace(db, workspaceId, user)
  if (!owned.ok) return NextResponse.json({ error: owned.error }, { status: owned.status })
  const { data: session } = await db.from('sessions').select('workspace_id').eq('id', sessionId).single()
  if (!session || (session as { workspace_id?: string }).workspace_id !== workspaceId) {
    return NextResponse.json({ error: '会话不存在或不属于当前工作区' }, { status: 403 })
  }
  const cloud = await loadCloudWorkspaceRoot(db, owned.workspace, user)
  if (!cloud.ok) return NextResponse.json({ error: cloud.error }, { status: cloud.status })
  const targets = diffPaths(diff)
  const outside = targets.find((target) => {
    const full = path.resolve(cloud.root, target)
    return full !== cloud.root && !full.startsWith(`${cloud.root}${path.sep}`)
  })
  if (outside) return NextResponse.json({ error: `Diff 包含 workspace 外路径：${outside}` }, { status: 400 })

  const riskLevel = classifyRisk('apply_diff', targets.join(' '))
  const { data: action, error } = await db.from('actions').insert({
    session_id: sessionId,
    plan_node_id: null,
    owner_id: user.id,
    action_type: 'apply_diff',
    command: 'git apply --index=false',
    cwd: cloud.root,
    risk_level: riskLevel,
    status: 'pending',
    requires_approval: true,
    result: {
      source: 'im_diff_apply',
      messageId,
      diff,
      targetPaths: targets,
      workspaceRoot: cloud.root,
      requestedAt: new Date().toISOString(),
    },
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await db.from('messages').insert({
    session_id: sessionId,
    content: '应用 Diff 需要授权。允许后 AgentHub 会在当前 workspace 内执行补丁应用；拒绝则不会修改文件。',
    sender_type: 'agent',
    role_agent_id: null,
    message_type: 'approval',
    metadata: {
      visibleStatus: '等待授权',
      runtimeParts: [{
        id: `apply-diff-${action.id}`,
        type: 'permission',
        status: 'pending',
        actionId: action.id,
        title: '应用 Diff 需要授权',
        description: `将尝试应用 ${targets.length} 个文件的 unified diff。`,
        riskLevel,
        actionKind: 'apply_diff',
        workspaceRoot: cloud.root,
        cwd: cloud.root,
        targetPaths: targets,
        commandPreview: 'git apply --check .agenthub-last-apply.patch && git apply .agenthub-last-apply.patch',
      }],
    },
  })
  await db.from('notifications').insert({
    user_id: user.id,
    type: 'approval_required',
    title: '应用 Diff 需要授权',
    body: `将尝试应用 ${targets.length} 个文件的 unified diff。`,
    ref_type: 'action',
    ref_id: action.id,
  })
  return NextResponse.json(action, { status: 201 })
}
