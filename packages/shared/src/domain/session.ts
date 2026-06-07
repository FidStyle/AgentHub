import type { ExecutionDomain } from './workspace'

export type SessionStatus = 'active' | 'archived'
export type RoutingMode = 'direct' | 'orchestrated'
export type ChatKind = 'group' | 'direct'

export interface Session {
  id: string
  workspaceId: string
  executionDomain: ExecutionDomain
  status: SessionStatus
  routingMode: RoutingMode
  chatKind?: ChatKind
  directRoleAgentId?: string | null
  isPinned?: boolean
  pinnedAt?: Date | null
  lastActivityAt?: Date | null
  createdAt: Date
}

export interface SessionParticipant {
  sessionId: string
  roleAgentId: string
}
