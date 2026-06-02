import { selectReadyMailboxItems, type AgentMailboxItem } from '@agenthub/shared'
import type { CliRuntimeType } from '@agenthub/shared'
import type { AppDbClient } from '@/lib/postgres-query-client'
import { dispatchMailboxRuntimeInvokeItem } from '@/lib/orchestrator/action-dispatcher'

type MailboxRow = AgentMailboxItem & {
  created_at: string
}

type WorkspaceRow = {
  id: string
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

type PlanNodeRow = {
  id: string
  plan_id: string
  label: string
  agent_id?: string | null
  action_type?: string | null
  action_payload?: Record<string, unknown> | null
}

async function assertWorkspaceOwner(db: AppDbClient, workspaceId: string, userId: string) {
  const { data: workspace, error } = await db
    .from('workspaces')
    .select('id, owner_id')
    .eq('id', workspaceId)
    .eq('owner_id', userId)
    .single()

  if (error || !workspace) return false
  return Boolean((workspace as unknown as WorkspaceRow).id)
}

async function loadMailboxItemForOwner(db: AppDbClient, mailboxItemId: string, userId: string) {
  const { data: item, error } = await db
    .from('agent_mailbox_items')
    .select('*')
    .eq('id', mailboxItemId)
    .single()

  if (error || !item) return { ok: false as const, status: 404, error: 'Mailbox 项不存在' }
  const mailboxItem = item as unknown as MailboxRow
  const owner = await assertWorkspaceOwner(db, mailboxItem.workspace_id, userId)
  if (!owner) return { ok: false as const, status: 404, error: 'Mailbox 项不存在或无权限' }
  return { ok: true as const, item: mailboxItem }
}

async function loadSessionForOwner(db: AppDbClient, sessionId: string, userId: string) {
  const { data: session, error } = await db
    .from('sessions')
    .select('id, workspace_id')
    .eq('id', sessionId)
    .single()

  if (error || !session) return { ok: false as const, status: 404, error: '会话不存在' }
  const sessionRow = session as unknown as SessionRow
  const owner = await assertWorkspaceOwner(db, sessionRow.workspace_id, userId)
  if (!owner) return { ok: false as const, status: 404, error: '会话不存在或无权限' }
  return { ok: true as const, session: sessionRow }
}

async function loadRole(db: AppDbClient, roleId: string, workspaceId: string) {
  const { data: role, error } = await db
    .from('role_agents')
    .select('id, name, runtime_type')
    .eq('id', roleId)
    .eq('workspace_id', workspaceId)
    .single()

  if (error || !role) return null
  return role as unknown as RoleRow
}

function textBody(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback
}

export async function replyToMailboxItem(input: {
  db: AppDbClient
  mailboxItemId: string
  userId: string
  body: Record<string, unknown>
}) {
  const loaded = await loadMailboxItemForOwner(input.db, input.mailboxItemId, input.userId)
  if (!loaded.ok) return loaded

  const original = loaded.item
  const replyTargetId = original.from_role_agent_id ?? (typeof input.body.to_role_agent_id === 'string' ? input.body.to_role_agent_id : null)
  if (!replyTargetId) {
    return { ok: false as const, status: 400, error: '回复目标角色必填' }
  }

  const targetRole = await loadRole(input.db, replyTargetId, original.workspace_id)
  if (!targetRole) return { ok: false as const, status: 404, error: '回复目标角色不存在或无权限' }

  const originalPackage = original.context_package as unknown as Record<string, unknown>
  const summary = textBody(input.body.summary, '角色已完成 mailbox 任务并提交回复。')
  const createdAt = new Date().toISOString()
  const contextPackage = {
    fromRoleAgentId: original.to_role_agent_id,
    fromRoleName: String(originalPackage.toRoleName ?? '角色'),
    toRoleAgentId: targetRole.id,
    toRoleName: targetRole.name,
    sessionId: original.session_id,
    summary,
    sourceMessageId: typeof input.body.source_message_id === 'string' ? input.body.source_message_id : null,
    target: 'reply',
    phase: originalPackage.phase ?? 'worker',
    runtimeType: targetRole.runtime_type,
    metadata: {
      planId: original.plan_id,
      planNodeId: original.plan_node_id,
      attemptId: original.attempt_id,
      replyToMailboxItemId: original.id,
      payload: input.body.payload ?? null,
    },
    createdAt,
  }

  const { data: reply, error: replyError } = await input.db
    .from('agent_mailbox_items')
    .insert({
      workspace_id: original.workspace_id,
      session_id: original.session_id,
      plan_id: original.plan_id,
      plan_node_id: original.plan_node_id,
      direction: 'reply',
      from_role_agent_id: original.to_role_agent_id,
      to_role_agent_id: targetRole.id,
      attempt_id: original.attempt_id,
      parent_attempt_id: original.parent_attempt_id,
      lineage_root_id: original.lineage_root_id,
      runtime_type: targetRole.runtime_type,
      status: 'completed',
      context_package: contextPackage,
      reply_to_mailbox_item_id: original.id,
      error: null,
    })
    .select()
    .single()

  if (replyError || !reply) {
    return { ok: false as const, status: 500, error: replyError?.message ?? '创建 mailbox 回复失败' }
  }

  await input.db
    .from('agent_mailbox_items')
    .update({ status: 'completed', error: null, updated_at: createdAt })
    .eq('id', original.id)

  if (original.attempt_id) {
    await input.db
      .from('plan_node_attempts')
      .update({ status: 'completed', error: null, updated_at: createdAt })
      .eq('id', original.attempt_id)
  }

  return {
    ok: true as const,
    status: 200,
    data: {
      mailbox_item: reply,
      completed_mailbox_item_id: original.id,
      attempt_id: original.attempt_id,
    },
  }
}

export async function deadLetterMailboxItem(input: {
  db: AppDbClient
  mailboxItemId: string
  userId: string
  body: Record<string, unknown>
}) {
  const loaded = await loadMailboxItemForOwner(input.db, input.mailboxItemId, input.userId)
  if (!loaded.ok) return loaded

  const item = loaded.item
  const error = textBody(input.body.error, 'Mailbox 项已进入 dead-letter。')
  const now = new Date().toISOString()

  await input.db
    .from('agent_mailbox_items')
    .update({ status: 'dead_letter', error, updated_at: now })
    .eq('id', item.id)

  if (item.attempt_id) {
    await input.db
      .from('plan_node_attempts')
      .update({ status: 'dead_letter', error, updated_at: now })
      .eq('id', item.attempt_id)
  }

  if (item.plan_node_id) {
    await input.db
      .from('plan_nodes')
      .update({
        status: 'failed',
        result: {
          error,
          mailboxItemId: item.id,
          attemptId: item.attempt_id,
          deadLetteredAt: now,
        },
      })
      .eq('id', item.plan_node_id)
  }

  return {
    ok: true as const,
    status: 200,
    data: {
      mailbox_item_id: item.id,
      attempt_id: item.attempt_id,
      plan_node_id: item.plan_node_id,
      status: 'dead_letter',
      error,
    },
  }
}

export async function getReadyMailboxItems(input: {
  db: AppDbClient
  sessionId: string
  userId: string
}) {
  const loaded = await loadSessionForOwner(input.db, input.sessionId, input.userId)
  if (!loaded.ok) return loaded

  const { data: items, error } = await input.db
    .from('agent_mailbox_items')
    .select('*')
    .eq('session_id', input.sessionId)
    .order('created_at', { ascending: true })

  if (error) return { ok: false as const, status: 500, error: error.message }

  const mailboxItems = Array.isArray(items) ? items as unknown as AgentMailboxItem[] : []
  return {
    ok: true as const,
    status: 200,
    data: {
      session_id: input.sessionId,
      ready_items: selectReadyMailboxItems(mailboxItems),
    },
  }
}

async function loadPlanNode(db: AppDbClient, nodeId: string) {
  const { data: node, error } = await db
    .from('plan_nodes')
    .select('id, plan_id, label, agent_id, action_type, action_payload')
    .eq('id', nodeId)
    .single()

  if (error || !node) return null
  return node as unknown as PlanNodeRow
}

export async function dispatchReadyMailboxItems(input: {
  db: AppDbClient
  sessionId: string
  userId: string
}) {
  const ready = await getReadyMailboxItems(input)
  if (!ready.ok) return ready

  const readyItems = ready.data.ready_items as AgentMailboxItem[]
  const results = []
  for (const item of readyItems) {
    if (!item.plan_node_id) {
      results.push({
        mailbox_item_id: item.id,
        status: 'unavailable',
        error: 'Mailbox 缺少 plan_node_id，无法调度。',
      })
      continue
    }

    const node = await loadPlanNode(input.db, item.plan_node_id)
    if (!node) {
      results.push({
        mailbox_item_id: item.id,
        plan_node_id: item.plan_node_id,
        status: 'unavailable',
        error: 'Mailbox 对应计划节点不存在，无法调度。',
      })
      continue
    }

    const result = await dispatchMailboxRuntimeInvokeItem(input.db as never, {
      userId: input.userId,
      mailboxItem: item,
      node,
    })
    results.push({
      mailbox_item_id: item.id,
      plan_node_id: item.plan_node_id,
      status: result.status,
      runtime_session_id: result.runtimeSessionId ?? null,
      error: result.error ?? null,
    })
  }

  return {
    ok: true as const,
    status: 200,
    data: {
      session_id: input.sessionId,
      dispatched: results,
    },
  }
}
