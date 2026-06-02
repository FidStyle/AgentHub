import type { PlanNode, PlanNodeStatus } from '@agenthub/shared'

export type DagValidationCode = 'duplicate_node' | 'missing_dependency' | 'self_dependency' | 'cycle'

export interface DagValidationIssue {
  code: DagValidationCode
  nodeId: string
  dependencyId?: string
  message: string
}

export interface PlanNodeTransition {
  nodeId: string
  from: PlanNodeStatus
  to: 'ready' | 'blocked'
  reason?: string
}

export interface PlanProgressEvaluation {
  validationIssues: DagValidationIssue[]
  transitions: PlanNodeTransition[]
  readyNodeIds: string[]
  blockedNodeIds: string[]
}

const SUCCESS_DEPENDENCY_STATUSES = new Set<PlanNodeStatus>(['completed'])
const FAILED_DEPENDENCY_STATUSES = new Set<PlanNodeStatus>(['failed', 'cancelled', 'blocked'])
const ADVANCEABLE_STATUSES = new Set<PlanNodeStatus>(['pending', 'waiting', 'blocked'])
const TERMINAL_STATUSES = new Set<PlanNodeStatus>(['completed', 'failed', 'skipped', 'cancelled', 'blocked'])
const FAILED_PLAN_STATUSES = new Set<PlanNodeStatus>(['failed', 'cancelled', 'blocked'])

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

export function validateDAG(nodes: PlanNode[]): DagValidationIssue[] {
  const issues: DagValidationIssue[] = []
  const seen = new Set<string>()
  const nodeIds = new Set<string>()

  for (const node of nodes) {
    if (seen.has(node.id)) {
      issues.push({
        code: 'duplicate_node',
        nodeId: node.id,
        message: `Duplicate DAG node "${node.id}"`,
      })
    }
    seen.add(node.id)
    nodeIds.add(node.id)
  }

  for (const node of nodes) {
    for (const dependencyId of node.depends_on) {
      if (dependencyId === node.id) {
        issues.push({
          code: 'self_dependency',
          nodeId: node.id,
          dependencyId,
          message: `DAG node "${node.id}" cannot depend on itself`,
        })
      } else if (!nodeIds.has(dependencyId)) {
        issues.push({
          code: 'missing_dependency',
          nodeId: node.id,
          dependencyId,
          message: `DAG node "${node.id}" depends on missing node "${dependencyId}"`,
        })
      }
    }
  }

  const visiting = new Set<string>()
  const visited = new Set<string>()
  const cyclic = new Set<string>()
  const byId = new Map(nodes.map((node) => [node.id, node]))

  const visit = (node: PlanNode): boolean => {
    if (visited.has(node.id)) return false
    if (visiting.has(node.id)) {
      cyclic.add(node.id)
      return true
    }
    visiting.add(node.id)
    let hasCycle = false
    for (const dependencyId of node.depends_on) {
      const dependency = byId.get(dependencyId)
      if (!dependency) continue
      if (visit(dependency)) {
        cyclic.add(node.id)
        hasCycle = true
      }
    }
    visiting.delete(node.id)
    visited.add(node.id)
    return hasCycle
  }

  for (const node of nodes) visit(node)

  for (const nodeId of cyclic) {
    issues.push({
      code: 'cycle',
      nodeId,
      message: `DAG node "${nodeId}" participates in a dependency cycle`,
    })
  }

  return issues
}

export function evaluatePlanProgress(nodes: PlanNode[]): PlanProgressEvaluation {
  const validationIssues = validateDAG(nodes)
  const transitions: PlanNodeTransition[] = []

  if (validationIssues.length > 0) {
    const reason = `invalid DAG: ${validationIssues.map((issue) => issue.message).join('; ')}`
    for (const node of nodes) {
      if (ADVANCEABLE_STATUSES.has(node.status) || node.status === 'ready') {
        transitions.push({ nodeId: node.id, from: node.status, to: 'blocked', reason })
      }
    }
    return {
      validationIssues,
      transitions,
      readyNodeIds: [],
      blockedNodeIds: transitions.map((transition) => transition.nodeId),
    }
  }

  const byId = new Map(nodes.map((node) => [node.id, node]))

  for (const node of nodes) {
    if (!ADVANCEABLE_STATUSES.has(node.status)) continue

    const dependencies = node.depends_on.map((dependencyId) => byId.get(dependencyId)).filter((item): item is PlanNode => Boolean(item))
    const failedDependency = dependencies.find((dependency) => FAILED_DEPENDENCY_STATUSES.has(dependency.status))
    if (failedDependency) {
      transitions.push({
        nodeId: node.id,
        from: node.status,
        to: 'blocked',
        reason: `dependency "${failedDependency.id}" is ${failedDependency.status}`,
      })
      continue
    }

    if (dependencies.every((dependency) => SUCCESS_DEPENDENCY_STATUSES.has(dependency.status))) {
      transitions.push({ nodeId: node.id, from: node.status, to: 'ready' })
    }
  }

  return {
    validationIssues,
    transitions,
    readyNodeIds: transitions.filter((transition) => transition.to === 'ready').map((transition) => transition.nodeId),
    blockedNodeIds: transitions.filter((transition) => transition.to === 'blocked').map((transition) => transition.nodeId),
  }
}

/** Check if all nodes are in terminal state */
export function isPlanComplete(nodes: PlanNode[]): boolean {
  return nodes.every(n => TERMINAL_STATUSES.has(n.status))
}

/** Check if plan has any failed nodes */
export function hasPlanFailed(nodes: PlanNode[]): boolean {
  return nodes.some(n => FAILED_PLAN_STATUSES.has(n.status))
}
