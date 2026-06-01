import type { ExecutionDomain } from '@agenthub/shared'
import { createClient } from '@/lib/app-db-client'
import { createSession, resolveEndpoint } from '@/lib/runtime/gateway'
import { enqueue, isWorkerAlive } from '@/lib/runtime/redis-client'

type AppDb = Awaited<ReturnType<typeof createClient>>

export type ActionDispatchStatus = 'queued' | 'unavailable' | 'unsupported'

export interface ActionDispatchResult {
  status: ActionDispatchStatus
  runtimeSessionId?: string
  error?: string
}

export interface ActionRecordForDispatch {
  id: string
  session_id: string
  owner_id: string
  plan_node_id?: string | null
  action_type: string
  command: string
  cwd?: string | null
}

function buildActionPrompt(action: ActionRecordForDispatch): string {
  const cwd = action.cwd ? `\nWorking directory: ${action.cwd}` : ''
  return [
    'AgentHub action execution request.',
    `Action type: ${action.action_type}`,
    `Command: ${action.command}${cwd}`,
    '',
    'Execute the requested action in the workspace context. Stream useful progress and final output.',
  ].join('\n')
}

async function recordDispatchFailure(
  db: AppDb,
  action: ActionRecordForDispatch,
  status: ActionDispatchStatus,
  error: string,
): Promise<ActionDispatchResult> {
  const result = { dispatch: status, error, at: new Date().toISOString() }
  await db.from('actions').update({ result }).eq('id', action.id)
  if (action.plan_node_id) {
    await db.from('plan_nodes').update({ result }).eq('id', action.plan_node_id)
  }
  await db.from('notifications').insert({
    user_id: action.owner_id,
    type: 'action_dispatch_failed',
    title: '动作暂未执行',
    body: error,
    ref_type: 'action',
    ref_id: action.id,
  })
  return { status, error }
}

export async function dispatchApprovedAction(
  db: AppDb,
  action: ActionRecordForDispatch,
): Promise<ActionDispatchResult> {
  const { data: session } = await db
    .from('sessions')
    .select('workspace_id')
    .eq('id', action.session_id)
    .single()

  if (!session?.workspace_id) {
    return recordDispatchFailure(db, action, 'unavailable', '动作所属会话不存在，无法投递执行。')
  }

  const { data: workspace } = await db
    .from('workspaces')
    .select('id, owner_id, execution_domain')
    .eq('id', session.workspace_id)
    .eq('owner_id', action.owner_id)
    .single()

  if (!workspace?.id) {
    return recordDispatchFailure(db, action, 'unavailable', '动作所属工作区不存在或无权限，无法投递执行。')
  }

  const executionDomain = workspace.execution_domain as ExecutionDomain
  if (executionDomain !== 'cloud') {
    return recordDispatchFailure(db, action, 'unsupported', '本地 Desktop 动作执行尚未接入队列执行器，未执行任何命令。')
  }

  const endpoint = await resolveEndpoint({
    userId: action.owner_id,
    workspaceId: workspace.id,
    executionDomain,
  })
  if (endpoint.status === 'unconfigured' || endpoint.id === null) {
    return recordDispatchFailure(db, action, 'unavailable', '公共云端 Runtime 尚未配置，动作未投递执行。')
  }
  if (!process.env.REDIS_URL || !(await isWorkerAlive())) {
    return recordDispatchFailure(db, action, 'unavailable', 'Runtime 执行器未就绪，动作已授权但未投递执行。')
  }

  const runtimeSession = await createSession({
    sessionId: action.session_id,
    endpoint,
  })
  const now = new Date().toISOString()
  await db.from('actions').update({
    status: 'running',
    executed_at: now,
    result: { dispatch: 'queued', runtimeSessionId: runtimeSession.id, at: now },
  }).eq('id', action.id)
  if (action.plan_node_id) {
    await db.from('plan_nodes').update({
      status: 'running',
      started_at: now,
      result: { dispatch: 'queued', runtimeSessionId: runtimeSession.id },
    }).eq('id', action.plan_node_id)
  }

  await enqueue({
    runtimeSessionId: runtimeSession.id,
    endpointId: endpoint.id ?? undefined,
    prompt: buildActionPrompt(action),
    actionId: action.id,
    planNodeId: action.plan_node_id ?? undefined,
  })

  return { status: 'queued', runtimeSessionId: runtimeSession.id }
}
