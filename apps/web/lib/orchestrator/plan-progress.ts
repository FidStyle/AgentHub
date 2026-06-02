import type { PlanNode, PlanNodeStatus } from '@agenthub/shared'
import type { CliRuntimeType } from '@agenthub/shared'
import type { AppDbClient } from '@/lib/postgres-query-client'
import { evaluatePlanProgress, type PlanNodeTransition } from './dag-scheduler'

const ACTIVE_STATUSES = new Set<PlanNodeStatus>(['pending', 'ready', 'waiting', 'running'])
const FAILED_STATUSES = new Set<PlanNodeStatus>(['failed', 'cancelled', 'blocked'])

export interface PlanProgressResult {
  planId: string | null
  transitions: PlanNodeTransition[]
  queuedMailboxItemIds: string[]
  planStatus: 'completed' | 'failed' | null
}

type PlanRow = {
  id: string
  session_id: string
  owner_id: string
}

type SessionRow = {
  id: string
  workspace_id: string
}

type RoleRow = {
  id: string
  name: string
  runtime_type: CliRuntimeType
}

type AttemptRow = {
  id: string
  attempt_number: number
}

async function resolvePlanId(db: AppDbClient, input: { planId?: string | null; planNodeId?: string | null }) {
  if (input.planId) return input.planId
  if (!input.planNodeId) return null

  const { data: node } = await db
    .from('plan_nodes')
    .select('plan_id')
    .eq('id', input.planNodeId)
    .single()

  return (node as unknown as { plan_id?: string } | null)?.plan_id ?? null
}

export async function advancePlanProgress(db: AppDbClient, input: {
  planId?: string | null
  planNodeId?: string | null
}): Promise<PlanProgressResult> {
  const planId = await resolvePlanId(db, input)
  if (!planId) return { planId: null, transitions: [], queuedMailboxItemIds: [], planStatus: null }

  const { data: nodes } = await db.from('plan_nodes').select('*').eq('plan_id', planId)
  const planNodes = (nodes ?? []) as unknown as PlanNode[]
  if (planNodes.length === 0) return { planId, transitions: [], queuedMailboxItemIds: [], planStatus: null }

  const evaluation = evaluatePlanProgress(planNodes)
  const now = new Date().toISOString()
  const updatedStatuses = new Map(planNodes.map((item) => [item.id, item.status]))
  const nodesById = new Map(planNodes.map((item) => [item.id, item]))
  const queuedMailboxItemIds: string[] = []

  for (const transition of evaluation.transitions) {
    const patch: Record<string, unknown> = { status: transition.to }
    if (transition.to === 'blocked') {
      patch.completed_at = now
      patch.result = { scheduler: 'blocked', reason: transition.reason ?? 'dependency blocked', at: now }
    }
    await db.from('plan_nodes').update(patch).eq('id', transition.nodeId)
    updatedStatuses.set(transition.nodeId, transition.to)
    if (transition.to === 'ready') {
      const queuedMailboxId = await createReadyRuntimeMailbox(db, {
        planId,
        node: nodesById.get(transition.nodeId) ?? null,
        now,
      })
      if (queuedMailboxId) queuedMailboxItemIds.push(queuedMailboxId)
    }
  }

  const statuses = Array.from(updatedStatuses.values())
  if (statuses.some((status) => ACTIVE_STATUSES.has(status))) {
    return { planId, transitions: evaluation.transitions, queuedMailboxItemIds, planStatus: null }
  }

  const planStatus = statuses.some((status) => FAILED_STATUSES.has(status)) ? 'failed' : 'completed'
  await db.from('plans').update({ status: planStatus, updated_at: now }).eq('id', planId)

  return { planId, transitions: evaluation.transitions, queuedMailboxItemIds, planStatus }
}

async function latestPlanNodeAttempt(db: AppDbClient, planNodeId: string) {
  const { data } = await db
    .from('plan_node_attempts')
    .select('id, attempt_number')
    .eq('plan_node_id', planNodeId)
    .order('attempt_number', { ascending: false })
    .limit(1)
  const rows = Array.isArray(data) ? data as unknown as AttemptRow[] : []
  return rows[0] ?? null
}

function payloadString(payload: Record<string, unknown> | null | undefined, key: string) {
  const value = payload?.[key]
  return typeof value === 'string' ? value : undefined
}

async function loadPlanExecutionContext(db: AppDbClient, planId: string, roleId: string) {
  const { data: plan } = await db.from('plans').select('id, session_id, owner_id').eq('id', planId).single()
  const planRow = plan as unknown as PlanRow | null
  if (!planRow?.session_id) return null

  const { data: session } = await db.from('sessions').select('id, workspace_id').eq('id', planRow.session_id).single()
  const sessionRow = session as unknown as SessionRow | null
  if (!sessionRow?.workspace_id) return null

  const { data: role } = await db
    .from('role_agents')
    .select('id, name, runtime_type')
    .eq('id', roleId)
    .eq('workspace_id', sessionRow.workspace_id)
    .single()
  const roleRow = role as unknown as RoleRow | null
  if (!roleRow?.id) return null

  return { plan: planRow, session: sessionRow, role: roleRow }
}

async function createReadyRuntimeMailbox(db: AppDbClient, input: {
  planId: string
  node: PlanNode | null
  now: string
}) {
  const node = input.node
  if (!node?.agent_id || (node.action_type && node.action_type !== 'runtime_invoke')) return null

  const context = await loadPlanExecutionContext(db, input.planId, node.agent_id)
  if (!context) return null

  const previousAttempt = await latestPlanNodeAttempt(db, node.id)
  const { data: attempt, error: attemptError } = await db
    .from('plan_node_attempts')
    .insert({
      plan_node_id: node.id,
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
  if (attemptError || !attempt) return null

  const attemptId = (attempt as unknown as { id: string }).id
  const payload = node.action_payload ?? {}
  const { data: mailbox, error: mailboxError } = await db
    .from('agent_mailbox_items')
    .insert({
      workspace_id: context.session.workspace_id,
      session_id: context.plan.session_id,
      plan_id: input.planId,
      plan_node_id: node.id,
      direction: 'inbound',
      from_role_agent_id: null,
      to_role_agent_id: context.role.id,
      attempt_id: attemptId,
      parent_attempt_id: previousAttempt?.id ?? null,
      lineage_root_id: previousAttempt?.id ?? attemptId,
      runtime_type: context.role.runtime_type,
      status: 'queued',
      context_package: {
        fromRoleAgentId: null,
        fromRoleName: 'Orchestrator',
        toRoleAgentId: context.role.id,
        toRoleName: context.role.name,
        sessionId: context.plan.session_id,
        summary: payloadString(payload, 'userMessage') ?? `执行编排节点「${node.label}」。`,
        sourceMessageId: null,
        target: 'auto-ready',
        phase: payloadString(payload, 'phase') ?? 'worker',
        runtimeType: context.role.runtime_type,
        metadata: { planId: input.planId, planNodeId: node.id, attemptId },
        createdAt: input.now,
      },
      reply_to_mailbox_item_id: null,
      error: null,
    })
    .select()
    .single()
  if (mailboxError || !mailbox) return null

  const mailboxId = (mailbox as unknown as { id: string }).id
  await db.from('plan_node_attempts').update({ mailbox_item_id: mailboxId }).eq('id', attemptId)
  return mailboxId
}
