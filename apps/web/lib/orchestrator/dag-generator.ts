import { randomUUID } from 'node:crypto'

export type OrchestratedPhase = 'direct' | 'planning' | 'worker' | 'summarizing'

export type OrchestratedRole = {
  id: string
  name: string
  role_type: string
  capabilities: unknown
  is_orchestrator: boolean
}

export type OrchestratedTarget<T extends OrchestratedRole> = {
  nodeId: string | null
  role: T | null
  phase: OrchestratedPhase
  dependsOn: string[]
}

export type GeneratedPlanNode = {
  id: string
  label: string
  depends_on: string[]
}

export type GeneratedOrchestration<T extends OrchestratedRole> = {
  useOrchestratedRun: boolean
  targets: Array<OrchestratedTarget<T>>
  planNodes: GeneratedPlanNode[]
  dag: {
    nodes: GeneratedPlanNode[]
    edges: Array<{ from: string; to: string }>
  }
}

function roleText(role: OrchestratedRole) {
  const capabilities = Array.isArray(role.capabilities) ? role.capabilities.join(' ') : ''
  return `${role.name} ${role.role_type} ${capabilities}`.toLowerCase()
}

function isFrontendRole(role: OrchestratedRole) {
  const text = roleText(role)
  return text.includes('front') || text.includes('ui') || text.includes('web') || text.includes('前端') || text.includes('界面')
}

function isBackendRole(role: OrchestratedRole) {
  const text = roleText(role)
  return text.includes('back') || text.includes('api') || text.includes('server') || text.includes('后端') || text.includes('接口') || text.includes('数据库')
}

function frontendDependsOnBackend(task: string) {
  const text = task.toLowerCase()
  return [
    '先后端',
    '后端先',
    'api first',
    '接口先',
    '数据库',
    'sqlite',
    '存储',
    'schema',
    'migration',
    '接口定义',
    '契约',
    '后端接口',
    '前端调用后端',
  ].some((keyword) => text.includes(keyword))
}

function labelForTarget(target: OrchestratedTarget<OrchestratedRole>) {
  if (target.phase === 'planning') return '架构师规划'
  if (target.phase === 'summarizing') return '架构师汇总'
  return `${target.role?.name ?? '角色'}执行`
}

export function generateOrchestration<T extends OrchestratedRole>(
  selectedRoles: T[],
  task: string,
): GeneratedOrchestration<T> {
  const orchestrator = selectedRoles.find((role) => role.is_orchestrator)
  const useOrchestratedRun = Boolean(orchestrator && selectedRoles.length > 1)

  if (!useOrchestratedRun || !orchestrator) {
    const targets = (selectedRoles.length > 0 ? selectedRoles : [null]).map((role) => ({
      nodeId: null,
      role,
      phase: 'direct' as const,
      dependsOn: [],
    }))
    return { useOrchestratedRun: false, targets, planNodes: [], dag: { nodes: [], edges: [] } }
  }

  const planner: OrchestratedTarget<T> = { nodeId: randomUUID(), role: orchestrator, phase: 'planning', dependsOn: [] }
  const workers: Array<OrchestratedTarget<T>> = selectedRoles
    .filter((role) => role.id !== orchestrator.id)
    .map((role) => ({ nodeId: randomUUID(), role, phase: 'worker' as const, dependsOn: [planner.nodeId as string] }))

  if (frontendDependsOnBackend(task)) {
    const backendWorkers = workers.filter((target) => target.role && isBackendRole(target.role))
    const frontendWorkers = workers.filter((target) => target.role && isFrontendRole(target.role))
    for (const frontend of frontendWorkers) {
      for (const backend of backendWorkers) {
        if (backend.nodeId && !frontend.dependsOn.includes(backend.nodeId)) frontend.dependsOn.push(backend.nodeId)
      }
    }
  }

  const summarizer: OrchestratedTarget<T> = {
    nodeId: randomUUID(),
    role: orchestrator,
    phase: 'summarizing',
    dependsOn: workers.map((target) => target.nodeId).filter((id): id is string => Boolean(id)),
  }

  const targets = [planner, ...workers, summarizer]
  const planNodes = targets.map((target) => ({
    id: target.nodeId as string,
    label: labelForTarget(target),
    depends_on: target.dependsOn,
  }))
  const dag = {
    nodes: planNodes,
    edges: planNodes.flatMap((node) => node.depends_on.map((dep) => ({ from: dep, to: node.id }))),
  }

  return { useOrchestratedRun: true, targets, planNodes, dag }
}
