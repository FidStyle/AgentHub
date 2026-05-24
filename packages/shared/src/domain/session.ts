import type { ExecutionDomain } from './workspace'

export type SessionStatus = 'active' | 'archived'
export type RoutingMode = 'direct' | 'orchestrated'

export interface Session {
  id: string
  workspaceId: string
  executionDomain: ExecutionDomain
  status: SessionStatus
  routingMode: RoutingMode
  createdAt: Date
}
