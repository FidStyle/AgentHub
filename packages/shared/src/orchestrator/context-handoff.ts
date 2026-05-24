/** Context Handoff: passes context between role agents */

export interface ContextPackage {
  from_agent_id: string
  to_agent_id: string
  session_id: string
  summary: string
  pinned_message_ids: string[]
  artifacts: { type: string; content: string }[]
  metadata?: Record<string, unknown>
  created_at: string
}
