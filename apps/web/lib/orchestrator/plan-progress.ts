import type { PlanNode, PlanNodeStatus } from '@agenthub/shared'
import type { AppDbClient } from '@/lib/postgres-query-client'
import { evaluatePlanProgress, type PlanNodeTransition } from './dag-scheduler'

const ACTIVE_STATUSES = new Set<PlanNodeStatus>(['pending', 'ready', 'waiting', 'running'])
const FAILED_STATUSES = new Set<PlanNodeStatus>(['failed', 'cancelled', 'blocked'])

export interface PlanProgressResult {
  planId: string | null
  transitions: PlanNodeTransition[]
  planStatus: 'completed' | 'failed' | null
}

async function resolvePlanId(db: AppDbClient, input: { planId?: string | null; planNodeId?: string | null }) {
  if (input.planId) return input.planId
  if (!input.planNodeId) return null

  const { data: node } = await db
    .from('plan_nodes')
    .select('plan_id')
    .eq('id', input.planNodeId)
    .single()

  return (node as unknown as { plan_id?: string } | null)?.plan_id ?? null
}

export async function advancePlanProgress(db: AppDbClient, input: {
  planId?: string | null
  planNodeId?: string | null
}): Promise<PlanProgressResult> {
  const planId = await resolvePlanId(db, input)
  if (!planId) return { planId: null, transitions: [], planStatus: null }

  const { data: nodes } = await db.from('plan_nodes').select('*').eq('plan_id', planId)
  const planNodes = (nodes ?? []) as unknown as PlanNode[]
  if (planNodes.length === 0) return { planId, transitions: [], planStatus: null }

  const evaluation = evaluatePlanProgress(planNodes)
  const now = new Date().toISOString()
  const updatedStatuses = new Map(planNodes.map((item) => [item.id, item.status]))

  for (const transition of evaluation.transitions) {
    const patch: Record<string, unknown> = { status: transition.to }
    if (transition.to === 'blocked') {
      patch.completed_at = now
      patch.result = { scheduler: 'blocked', reason: transition.reason ?? 'dependency blocked', at: now }
    }
    await db.from('plan_nodes').update(patch).eq('id', transition.nodeId)
    updatedStatuses.set(transition.nodeId, transition.to)
  }

  const statuses = Array.from(updatedStatuses.values())
  if (statuses.some((status) => ACTIVE_STATUSES.has(status))) {
    return { planId, transitions: evaluation.transitions, planStatus: null }
  }

  const planStatus = statuses.some((status) => FAILED_STATUSES.has(status)) ? 'failed' : 'completed'
  await db.from('plans').update({ status: planStatus, updated_at: now }).eq('id', planId)

  return { planId, transitions: evaluation.transitions, planStatus }
}
