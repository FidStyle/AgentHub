/**
 * Postgres Database Types (手动维护，与 migration 同步)
 * 生产环境应使用 db gen types typescript 自动生成
 */

export type ExecutionDomain = 'cloud' | 'local_desktop'
export type SessionStatus = 'active' | 'archived'
export type RoutingMode = 'orchestrated' | 'direct'
export type SenderType = 'user' | 'agent' | 'system'
export type MessageType = 'text' | 'plan_card' | 'result_card' | 'approval' | 'system_event' | 'role_acknowledgement'
export type StreamingStatus = 'idle' | 'streaming' | 'complete'
export type CliRuntimeType = 'claude_code' | 'codex'
export type PlanNodeStatus = 'pending' | 'ready' | 'waiting' | 'running' | 'completed' | 'failed' | 'skipped' | 'cancelled' | 'blocked'
export type MailboxStatus = 'queued' | 'running' | 'waiting' | 'completed' | 'failed' | 'cancelled' | 'dead_letter'
export type PlanNodeAttemptControl = 'initial' | 'retry' | 'resume' | 'cancel' | 'requeue'
export type MailboxDirection = 'outbound' | 'inbound' | 'reply'

export interface Profile {
  id: string
  github_username: string | null
  avatar_url: string | null
  display_name: string | null
  created_at: string
  updated_at: string
}

export interface Workspace {
  id: string
  owner_id: string
  name: string
  description: string
  execution_domain: ExecutionDomain
  cloud_project_dir: string | null
  local_root_display: string | null
  created_at: string
  updated_at: string
}

export interface Session {
  id: string
  workspace_id: string
  name: string
  status: SessionStatus
  routing_mode: RoutingMode
  auto_advance: boolean
  created_at: string
  updated_at: string
}

export interface RoleAgent {
  id: string
  workspace_id: string
  name: string
  role_type: string
  system_prompt: string
  capabilities: string[]
  runtime_type: 'claude_code' | 'codex'
  is_orchestrator: boolean
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  session_id: string
  sender_type: SenderType
  sender_id: string | null
  role_agent_id: string | null
  content: string
  message_type: MessageType
  streaming_status: StreamingStatus
  metadata: Record<string, unknown> | null
  is_pinned: boolean
  created_at: string
  updated_at: string
}

export interface RuntimeSession {
  id: string
  session_id: string
  endpoint_id: string | null
  role_agent_id: string | null
  runtime_type: CliRuntimeType
  native_session_id: string | null
  cwd: string | null
  capability_snapshot: Record<string, unknown> | null
  status: 'idle' | 'running' | 'completed' | 'failed' | 'cancelled'
  started_at: string | null
  completed_at: string | null
  created_at: string
}

export interface Plan {
  id: string
  session_id: string
  owner_id: string
  title: string
  status: 'draft' | 'pending_confirm' | 'running' | 'completed' | 'failed' | 'cancelled'
  dag: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface PlanNode {
  id: string
  plan_id: string
  label: string
  agent_id: string | null
  status: PlanNodeStatus
  action_type: string | null
  action_payload: Record<string, unknown> | null
  result: Record<string, unknown> | null
  depends_on: string[]
  started_at: string | null
  completed_at: string | null
  created_at: string
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
  context_package: Record<string, unknown>
  reply_to_mailbox_item_id: string | null
  error: string | null
  created_at: string
  updated_at: string
}

export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Omit<Profile, 'created_at' | 'updated_at'>; Update: Partial<Omit<Profile, 'id' | 'created_at'>> }
      workspaces: { Row: Workspace; Insert: Omit<Workspace, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Workspace, 'id' | 'owner_id' | 'execution_domain' | 'created_at'>> }
      sessions: { Row: Session; Insert: Omit<Session, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Session, 'id' | 'workspace_id' | 'created_at'>> }
      role_agents: { Row: RoleAgent; Insert: Omit<RoleAgent, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<RoleAgent, 'id' | 'workspace_id' | 'created_at'>> }
      messages: { Row: Message; Insert: Omit<Message, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Message, 'id' | 'session_id' | 'created_at'>> }
      plans: { Row: Plan; Insert: Omit<Plan, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Plan, 'id' | 'session_id' | 'owner_id' | 'created_at'>> }
      plan_nodes: { Row: PlanNode; Insert: Omit<PlanNode, 'id' | 'created_at'>; Update: Partial<Omit<PlanNode, 'id' | 'plan_id' | 'created_at'>> }
      plan_node_attempts: { Row: PlanNodeAttempt; Insert: Omit<PlanNodeAttempt, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<PlanNodeAttempt, 'id' | 'plan_node_id' | 'created_at'>> }
      agent_mailbox_items: { Row: AgentMailboxItem; Insert: Omit<AgentMailboxItem, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<AgentMailboxItem, 'id' | 'workspace_id' | 'session_id' | 'created_at'>> }
      runtime_sessions: { Row: RuntimeSession; Insert: Omit<RuntimeSession, 'id' | 'created_at'>; Update: Partial<Omit<RuntimeSession, 'id' | 'session_id' | 'created_at'>> }
    }
  }
}
