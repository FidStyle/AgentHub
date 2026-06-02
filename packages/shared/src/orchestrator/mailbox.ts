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
