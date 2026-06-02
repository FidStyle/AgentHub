import type { CliRuntimeType } from '../domain/runtime'
import type { ContextPackage } from './context-handoff'
import type { MailboxDirection, MailboxStatus, PlanNodeAttemptControl } from './plan'

export interface AgentMailboxItem {
  id: string
  workspace_id: string
  session_id: string
  plan_id: string | null
  plan_node_id: string | null
  direction: MailboxDirection
  from_role_agent_id: string | null
  to_role_agent_id: string
  attempt_id: string | null
  parent_attempt_id: string | null
  lineage_root_id: string
  runtime_type: CliRuntimeType
  status: MailboxStatus
  context_package: ContextPackage
  reply_to_mailbox_item_id: string | null
  error: string | null
  created_at: string
  updated_at: string
}

export interface PlanNodeAttempt {
  id: string
  plan_node_id: string
  attempt_number: number
  control: PlanNodeAttemptControl
  previous_attempt_id: string | null
  runtime_session_id: string | null
  mailbox_item_id: string | null
  status: MailboxStatus
  error: string | null
  created_at: string
  updated_at: string
}

export interface PlanNodeAttemptDraft {
  plan_node_id: string
  attempt_number: number
  control: PlanNodeAttemptControl
  previous_attempt_id: string | null
  status: MailboxStatus
}

const ACTIVE_MAILBOX_STATUSES = new Set<MailboxStatus>(['running', 'waiting'])

function timestampMillis(value: string | Date): number {
  if (value instanceof Date) return value.getTime()
  return Date.parse(value)
}

export function selectReadyMailboxItems(items: AgentMailboxItem[]): AgentMailboxItem[] {
  const ordered = [...items].sort((a, b) => timestampMillis(a.created_at) - timestampMillis(b.created_at))
  const activeSessions = new Set(
    ordered
      .filter((item) => item.direction === 'inbound' && ACTIVE_MAILBOX_STATUSES.has(item.status))
      .map((item) => item.session_id),
  )
  const selectedSessions = new Set<string>()

  return ordered.filter((item) => {
    if (item.direction !== 'inbound' || item.status !== 'queued') return false
    if (activeSessions.has(item.session_id)) return false
    if (selectedSessions.has(item.session_id)) return false
    selectedSessions.add(item.session_id)
    return true
  })
}

export function nextPlanNodeAttemptDraft(input: {
  planNodeId: string
  control: PlanNodeAttemptControl
  attempts: PlanNodeAttempt[]
}): PlanNodeAttemptDraft {
  const previous = input.attempts
    .filter((attempt) => attempt.plan_node_id === input.planNodeId)
    .sort((a, b) => b.attempt_number - a.attempt_number)[0]

  return {
    plan_node_id: input.planNodeId,
    attempt_number: (previous?.attempt_number ?? 0) + 1,
    control: input.control,
    previous_attempt_id: previous?.id ?? null,
    status: input.control === 'cancel' ? 'cancelled' : 'queued',
  }
}
