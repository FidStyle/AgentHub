/**
 * Supabase Database Types (手动维护，与 migration 同步)
 * 生产环境应使用 supabase gen types typescript 自动生成
 */

export type ExecutionDomain = 'cloud' | 'local_desktop'
export type SessionStatus = 'active' | 'archived'
export type RoutingMode = 'orchestrated' | 'direct'
export type SenderType = 'user' | 'agent' | 'system'
export type MessageType = 'text' | 'plan_card' | 'result_card' | 'approval' | 'system_event'
export type StreamingStatus = 'idle' | 'streaming' | 'complete'

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

export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Omit<Profile, 'created_at' | 'updated_at'>; Update: Partial<Omit<Profile, 'id' | 'created_at'>> }
      workspaces: { Row: Workspace; Insert: Omit<Workspace, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Workspace, 'id' | 'owner_id' | 'execution_domain' | 'created_at'>> }
      sessions: { Row: Session; Insert: Omit<Session, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Session, 'id' | 'workspace_id' | 'created_at'>> }
      role_agents: { Row: RoleAgent; Insert: Omit<RoleAgent, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<RoleAgent, 'id' | 'workspace_id' | 'created_at'>> }
      messages: { Row: Message; Insert: Omit<Message, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Message, 'id' | 'session_id' | 'created_at'>> }
    }
  }
}
