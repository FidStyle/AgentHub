/** Context Handoff: passes context between role agents */

export interface ContextPackage {
  fromRoleAgentId: string | null
  fromRoleName: string
  toRoleAgentId: string | null
  toRoleName: string
  sessionId: string
  summary: string
  sourceMessageId: string | null
  target?: string
  phase?: 'direct' | 'planning' | 'worker' | 'artifact_closure' | 'summarizing'
  runtimeType?: 'claude_code' | 'codex' | null
  pinnedMessageIds?: string[]
  artifacts?: { type: string; content: string }[]
  metadata?: Record<string, unknown>
  createdAt: string
}
