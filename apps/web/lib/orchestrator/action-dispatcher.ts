import type { ExecutionDomain } from '@agenthub/shared'
import type { CliRuntimeType } from '@agenthub/shared'
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
  runtime_type?: CliRuntimeType | null
  role_agent_id?: string | null
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
    roleAgentId: action.role_agent_id ?? undefined,
    runtimeType: action.runtime_type ?? 'claude_code',
    cwd: action.cwd ?? process.env.RUNTIME_CWD ?? null,
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
    runtimeType: action.runtime_type ?? 'claude_code',
    nativeSessionId: runtimeSession.nativeSessionId ?? null,
    cwd: runtimeSession.cwd ?? process.env.RUNTIME_CWD ?? null,
    prompt: buildActionPrompt(action),
    actionId: action.id,
    planNodeId: action.plan_node_id ?? undefined,
  })

  return { status: 'queued', runtimeSessionId: runtimeSession.id }
}

export interface RuntimeInvokeNodeForDispatch {
  id: string
  plan_id: string
  label: string
  agent_id?: string | null
  action_payload?: Record<string, unknown> | null
}

type AttemptRow = {
  id: string
  attempt_number: number
}

async function latestPlanNodeAttempt(db: AppDb, planNodeId: string) {
  const { data } = await db
    .from('plan_node_attempts')
    .select('id, attempt_number')
    .eq('plan_node_id', planNodeId)
    .order('attempt_number', { ascending: false })
    .limit(1)
  const rows = Array.isArray(data) ? data as unknown as AttemptRow[] : []
  return rows[0] ?? null
}

async function markAttemptAndMailbox(
  db: AppDb,
  input: {
    attemptId?: string | null
    mailboxItemId?: string | null
    status: 'running' | 'dead_letter'
    runtimeSessionId?: string | null
    error?: string
  },
) {
  if (input.attemptId) {
    await db.from('plan_node_attempts').update({
      status: input.status,
      runtime_session_id: input.runtimeSessionId ?? null,
      error: input.error ?? null,
      updated_at: new Date().toISOString(),
    }).eq('id', input.attemptId)
  }
  if (input.mailboxItemId) {
    await db.from('agent_mailbox_items').update({
      status: input.status,
      error: input.error ?? null,
      updated_at: new Date().toISOString(),
    }).eq('id', input.mailboxItemId)
  }
}

function buildRuntimeInvokePrompt(input: {
  label: string
  userMessage: string
  phase?: string
  handoffs?: unknown
}) {
  const handoffText = input.handoffs ? `\n\nContext handoffs:\n${JSON.stringify(input.handoffs, null, 2)}` : ''
  return [
    'AgentHub orchestrated runtime node.',
    `Node: ${input.label}`,
    input.phase ? `Phase: ${input.phase}` : null,
    '',
    input.userMessage,
    handoffText,
  ].filter(Boolean).join('\n')
}

export async function dispatchRuntimeInvokeNode(
  db: AppDb,
  input: {
    userId: string
    sessionId: string
    node: RuntimeInvokeNodeForDispatch
  },
): Promise<ActionDispatchResult> {
  const payload = input.node.action_payload ?? {}
  const { data: session } = await db
    .from('sessions')
    .select('workspace_id')
    .eq('id', input.sessionId)
    .single()
  if (!session?.workspace_id) {
    await db.from('plan_nodes').update({ status: 'failed', result: { error: '节点所属会话不存在，无法投递 Runtime。' } }).eq('id', input.node.id)
    return { status: 'unavailable', error: '节点所属会话不存在，无法投递 Runtime。' }
  }

  const { data: workspace } = await db
    .from('workspaces')
    .select('id, owner_id, execution_domain')
    .eq('id', session.workspace_id)
    .eq('owner_id', input.userId)
    .single()
  if (!workspace?.id) {
    await db.from('plan_nodes').update({ status: 'failed', result: { error: '节点所属工作区不存在或无权限，无法投递 Runtime。' } }).eq('id', input.node.id)
    return { status: 'unavailable', error: '节点所属工作区不存在或无权限，无法投递 Runtime。' }
  }
  const executionDomain = workspace.execution_domain as ExecutionDomain
  if (executionDomain !== 'cloud') {
    await db.from('plan_nodes').update({ status: 'failed', result: { error: '当前完整线路只支持 cloud runtime_invoke。' } }).eq('id', input.node.id)
    return { status: 'unsupported', error: '当前完整线路只支持 cloud runtime_invoke。' }
  }

  const { data: role } = input.node.agent_id
    ? await db
      .from('role_agents')
      .select('id, name, system_prompt, runtime_type')
      .eq('id', input.node.agent_id)
      .eq('workspace_id', workspace.id)
      .single()
    : { data: null }
  const runtimeType = role?.runtime_type === 'codex' ? 'codex' : 'claude_code'
  const previousAttempt = await latestPlanNodeAttempt(db, input.node.id)
  const { data: attempt, error: attemptError } = await db
    .from('plan_node_attempts')
    .insert({
      plan_node_id: input.node.id,
      attempt_number: (previousAttempt?.attempt_number ?? 0) + 1,
      control: 'initial',
      previous_attempt_id: previousAttempt?.id ?? null,
      runtime_session_id: null,
      mailbox_item_id: null,
      status: 'queued',
      error: null,
    })
    .select()
    .single()
  if (attemptError || !attempt) {
    await db.from('plan_nodes').update({ status: 'failed', result: { error: attemptError?.message ?? '创建节点尝试失败。' } }).eq('id', input.node.id)
    return { status: 'unavailable', error: attemptError?.message ?? '创建节点尝试失败。' }
  }
  const attemptId = (attempt as unknown as { id: string }).id
  let mailboxItemId: string | null = null
  if (role?.id) {
    const { data: mailbox, error: mailboxError } = await db
      .from('agent_mailbox_items')
      .insert({
        workspace_id: workspace.id,
        session_id: input.sessionId,
        plan_id: input.node.plan_id,
        plan_node_id: input.node.id,
        direction: 'inbound',
        from_role_agent_id: null,
        to_role_agent_id: role.id,
        attempt_id: attemptId,
        parent_attempt_id: previousAttempt?.id ?? null,
        lineage_root_id: previousAttempt?.id ?? attemptId,
        runtime_type: runtimeType,
        status: 'queued',
        context_package: {
          fromRoleAgentId: null,
          fromRoleName: 'Orchestrator',
          toRoleAgentId: role.id,
          toRoleName: role.name,
          sessionId: input.sessionId,
          summary: typeof payload.userMessage === 'string' ? payload.userMessage : `执行编排节点「${input.node.label}」。`,
          sourceMessageId: null,
          target: 'initial',
          phase: typeof payload.phase === 'string' ? payload.phase : 'worker',
          runtimeType,
          metadata: { planId: input.node.plan_id, planNodeId: input.node.id, attemptId },
          createdAt: new Date().toISOString(),
        },
        reply_to_mailbox_item_id: null,
        error: null,
      })
      .select()
      .single()
    if (mailboxError || !mailbox) {
      await db.from('plan_nodes').update({ status: 'failed', result: { error: mailboxError?.message ?? '创建节点 mailbox 失败。' } }).eq('id', input.node.id)
      return { status: 'unavailable', error: mailboxError?.message ?? '创建节点 mailbox 失败。' }
    }
    mailboxItemId = (mailbox as unknown as { id: string }).id
    await db.from('plan_node_attempts').update({ mailbox_item_id: mailboxItemId }).eq('id', attemptId)
  }

  const endpoint = await resolveEndpoint({
    userId: input.userId,
    workspaceId: workspace.id,
    executionDomain,
  })
  if (endpoint.status === 'unconfigured' || endpoint.id === null) {
    await markAttemptAndMailbox(db, { attemptId, mailboxItemId, status: 'dead_letter', error: '公共云端 Runtime 尚未配置，节点未投递。' })
    await db.from('plan_nodes').update({ status: 'failed', result: { error: '公共云端 Runtime 尚未配置，节点未投递。' } }).eq('id', input.node.id)
    return { status: 'unavailable', error: '公共云端 Runtime 尚未配置，节点未投递。' }
  }
  if (!process.env.REDIS_URL || !(await isWorkerAlive())) {
    await markAttemptAndMailbox(db, { attemptId, mailboxItemId, status: 'dead_letter', error: 'Runtime 执行器未就绪，节点未投递。' })
    await db.from('plan_nodes').update({ status: 'failed', result: { error: 'Runtime 执行器未就绪，节点未投递。' } }).eq('id', input.node.id)
    return { status: 'unavailable', error: 'Runtime 执行器未就绪，节点未投递。' }
  }

  const cwd = typeof payload.cwd === 'string' ? payload.cwd : process.env.RUNTIME_CWD ?? null
  const runtimeSession = await createSession({
    sessionId: input.sessionId,
    endpoint,
    roleAgentId: role?.id ?? undefined,
    runtimeType,
    cwd,
  })
  await markAttemptAndMailbox(db, { attemptId, mailboxItemId, status: 'running', runtimeSessionId: runtimeSession.id })
  const now = new Date().toISOString()
  await db.from('plan_nodes').update({
    status: 'running',
    started_at: now,
    result: { dispatch: 'queued', runtimeSessionId: runtimeSession.id, runtimeType, attemptId, mailboxItemId, at: now },
  }).eq('id', input.node.id)
  await enqueue({
    runtimeSessionId: runtimeSession.id,
    endpointId: endpoint.id ?? undefined,
    runtimeType,
    nativeSessionId: runtimeSession.nativeSessionId ?? null,
    cwd: runtimeSession.cwd ?? cwd,
    prompt: buildRuntimeInvokePrompt({
      label: input.node.label,
      userMessage: typeof payload.userMessage === 'string' ? payload.userMessage : '继续执行该编排节点。',
      phase: typeof payload.phase === 'string' ? payload.phase : undefined,
      handoffs: payload.handoffs,
    }),
    systemPrompt: typeof role?.system_prompt === 'string' ? role.system_prompt : undefined,
    planNodeId: input.node.id,
  })
  return { status: 'queued', runtimeSessionId: runtimeSession.id }
}
