import type { PlanNode } from '@agenthub/shared'

/**
 * DAG Scheduler: determines which nodes are ready to execute.
 * A node is "ready" when all its dependencies are completed.
 */
export function getReadyNodes(nodes: PlanNode[]): PlanNode[] {
  const completedIds = new Set(nodes.filter(n => n.status === 'completed').map(n => n.id))
  return nodes.filter(n =>
    n.status === 'pending' &&
    n.depends_on.every(dep => completedIds.has(dep))
  )
}

/** Mark ready nodes' status to 'ready' */
export function advanceDAG(nodes: PlanNode[]): PlanNode[] {
  const completedIds = new Set(nodes.filter(n => n.status === 'completed').map(n => n.id))
  return nodes.map(n => {
    if (n.status === 'pending' && n.depends_on.every(dep => completedIds.has(dep))) {
      return { ...n, status: 'ready' as const }
    }
    return n
  })
}

/** Check if all nodes are in terminal state */
export function isPlanComplete(nodes: PlanNode[]): boolean {
  return nodes.every(n => ['completed', 'failed', 'skipped'].includes(n.status))
}

/** Check if plan has any failed nodes */
export function hasPlanFailed(nodes: PlanNode[]): boolean {
  return nodes.some(n => n.status === 'failed')
}
