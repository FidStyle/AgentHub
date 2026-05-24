import type { RiskLevel } from './action'

export type ApprovalSource = 'action' | 'plan' | 'permission_escalation' | 'retry'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

export interface PendingApproval {
  id: string
  sourceType: ApprovalSource
  sourceId: string
  riskLevel: RiskLevel
  status: ApprovalStatus
  decidedAt?: Date
}
