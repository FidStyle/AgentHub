import type { CliRuntimeType, PlanNodeControl } from '@agenthub/shared'
import type { AppDbClient } from '@/lib/postgres-query-client'
import { advancePlanProgress } from './plan-progress'

type Control = PlanNodeControl
type MailboxStatus = 'queued' | 'cancelled'

type PlanNodeRow = {
  id: string
  plan_id: string
  label: string
  agent_id?: string | null
  action_payload?: Record<string, unknown> | null
  status?: string
}

type PlanRow = {
  id: string
  session_id: string
  owner_id: string
  title: string
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
  runtime_session_id?: string | null
}

function controlToNodeStatus(control: Control) {
  if (control === 'cancel') return 'cancelled'
  if (control === 'requeue') return 'pending'
  return 'ready'
}

function controlToAttemptStatus(control: Control): MailboxStatus {
  return control === 'cancel' ? 'cancelled' : 'queued'
}

function controlTitle(control: Control) {
  const labels: Record<Control, string> = {
    retry: '重试',
    resume: '恢复',
    cancel: '取消',
    requeue: '重新入队',
  }
  return labels[control]
}

async function loadNodeContext(db: AppDbClient, nodeId: string, userId: string) {
  const { data: node, error: nodeError } = await db
    .from('plan_nodes')
    .select('*')
    .eq('id', nodeId)
    .single()
  if (nodeError || !node) return { ok: false as const, status: 404, error: '计划节点不存在' }
  const nodeRow = node as unknown as PlanNodeRow

  const { data: plan, error: planError } = await db
    .from('plans')
    .select('*')
    .eq('id', nodeRow.plan_id)
    .eq('owner_id', userId)
    .single()
  if (planError || !plan) return { ok: false as const, status: 404, error: '计划不存在或无权限' }
  const planRow = plan as unknown as PlanRow

  const { data: session, error: sessionError } = await db
    .from('sessions')
    .select('id, workspace_id')
    .eq('id', planRow.session_id)
    .single()
  if (sessionError || !session) return { ok: false as const, status: 404, error: '计划所属会话不存在' }

  return {
    ok: true as const,
    node: nodeRow,
    plan: planRow,
    session: session as unknown as SessionRow,
  }
}

async function loadLatestAttempt(db: AppDbClient, nodeId: string) {
  const { data } = await db
    .from('plan_node_attempts')
    .select('id, attempt_number, runtime_session_id')
    .eq('plan_node_id', nodeId)
    .order('attempt_number', { ascending: false })
    .limit(1)
  const rows = Array.isArray(data) ? data as unknown as AttemptRow[] : []
  return rows[0] ?? null
}

async function loadRole(db: AppDbClient, roleId?: string | null) {
  if (!roleId) return null
  const { data } = await db
    .from('role_agents')
    .select('id, name, runtime_type')
    .eq('id', roleId)
    .single()
  return data as unknown as RoleRow | null
}

export async function controlPlanNode(input: {
  db: AppDbClient
  nodeId: string
  userId: string
  control: Control
}) {
  const context = await loadNodeContext(input.db, input.nodeId, input.userId)
  if (!context.ok) return context

  const latestAttempt = await loadLatestAttempt(input.db, input.nodeId)
  const nextAttemptNumber = (latestAttempt?.attempt_number ?? 0) + 1
  const attemptStatus = controlToAttemptStatus(input.control)
  const { data: attempt, error: attemptError } = await input.db
    .from('plan_node_attempts')
    .insert({
      plan_node_id: input.nodeId,
      attempt_number: nextAttemptNumber,
      control: input.control,
      previous_attempt_id: latestAttempt?.id ?? null,
      runtime_session_id: null,
      mailbox_item_id: null,
      status: attemptStatus,
      error: null,
    })
    .select()
    .single()

  if (attemptError || !attempt) {
    return { ok: false as const, status: 500, error: attemptError?.message ?? '创建节点尝试失败' }
  }

  const role = await loadRole(input.db, context.node.agent_id)
  let mailboxItem = null as unknown
  if (role && input.control !== 'cancel') {
    const contextPackage = {
      fromRoleAgentId: null,
      fromRoleName: 'Orchestrator',
      toRoleAgentId: role.id,
      toRoleName: role.name,
      sessionId: context.plan.session_id,
      summary: `用户请求${controlTitle(input.control)}计划节点「${context.node.label}」。`,
      sourceMessageId: null,
      target: input.control,
      phase: 'worker',
      runtimeType: role.runtime_type,
      metadata: {
        planId: context.plan.id,
        planNodeId: context.node.id,
        attemptId: (attempt as { id: string }).id,
        previousAttemptId: latestAttempt?.id ?? null,
        previousRuntimeSessionId: latestAttempt?.runtime_session_id ?? null,
        control: input.control,
      },
      createdAt: new Date().toISOString(),
    }
    const { data: mailbox, error: mailboxError } = await input.db
      .from('agent_mailbox_items')
      .insert({
        workspace_id: context.session.workspace_id,
        session_id: context.plan.session_id,
        plan_id: context.plan.id,
        plan_node_id: context.node.id,
        direction: 'inbound',
        from_role_agent_id: null,
        to_role_agent_id: role.id,
        attempt_id: (attempt as { id: string }).id,
        parent_attempt_id: latestAttempt?.id ?? null,
        lineage_root_id: latestAttempt?.id ?? (attempt as { id: string }).id,
        runtime_type: role.runtime_type,
        status: 'queued',
        context_package: contextPackage,
        reply_to_mailbox_item_id: null,
        error: null,
      })
      .select()
      .single()
    if (mailboxError || !mailbox) {
      return { ok: false as const, status: 500, error: mailboxError?.message ?? '创建 mailbox 失败' }
    }
    mailboxItem = mailbox
    await input.db
      .from('plan_node_attempts')
      .update({ mailbox_item_id: (mailbox as { id: string }).id })
      .eq('id', (attempt as { id: string }).id)
  }

  const now = new Date().toISOString()
  await input.db
    .from('plan_nodes')
    .update({
      status: controlToNodeStatus(input.control),
      result: {
        control: input.control,
        attemptId: (attempt as { id: string }).id,
        mailboxItemId: (mailboxItem as { id?: string } | null)?.id ?? null,
        at: now,
      },
    })
    .eq('id', input.nodeId)

  if (input.control === 'cancel') {
    await advancePlanProgress(input.db, { planId: context.plan.id, planNodeId: input.nodeId })
  } else {
    await input.db.from('plans').update({ status: 'running', updated_at: now }).eq('id', context.plan.id)
  }

  return {
    ok: true as const,
    status: 200,
    data: {
      control: input.control,
      node_status: controlToNodeStatus(input.control),
      attempt,
      mailbox_item: mailboxItem,
    },
  }
}
