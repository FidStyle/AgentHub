import type { RiskLevel, DEFAULT_POLICIES } from '@agenthub/shared'

/** Evaluate whether an action requires approval based on policies */
export function requiresApproval(
  actionType: string,
  riskLevel: RiskLevel,
  policies: typeof DEFAULT_POLICIES = []
): boolean {
  // High risk always requires approval
  if (riskLevel === 'high') return true

  // Check specific policy
  const policy = policies.find(p => p.action_type === actionType && p.risk_level === riskLevel)
  if (policy) return policy.requires_approval

  // Default: medium risk for destructive types requires approval
  if (['git_push', 'deploy'].includes(actionType)) return true

  return false
}

/** Classify risk level from command content */
export function classifyRisk(actionType: string, command: string): RiskLevel {
  const highRiskPatterns = [
    /rm\s+-rf/i, /drop\s+table/i, /drop\s+database/i,
    /--force/i, /--hard/i, /DELETE\s+FROM/i,
    /deploy/i, /production/i, /prod\b/i,
  ]
  const mediumRiskPatterns = [
    /git\s+push/i, /npm\s+publish/i, /install/i,
    /chmod/i, /chown/i, /sudo/i,
  ]

  if (actionType === 'deploy') return 'high'
  if (highRiskPatterns.some(p => p.test(command))) return 'high'
  if (mediumRiskPatterns.some(p => p.test(command))) return 'medium'
  return 'low'
}
