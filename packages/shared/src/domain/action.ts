import type { ExecutionDomain } from './workspace'

export type ActionType = 'preview' | 'test' | 'build' | 'shell'
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'
export type ActionStatus = 'pending' | 'approved' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface ActionRequest {
  id: string
  sessionId: string
  type: ActionType
  executionDomain: ExecutionDomain
  workingDir: string
  riskLevel: RiskLevel
  status: ActionStatus
  command?: string
}
