import { randomUUID } from 'node:crypto'

export type OrchestratedPhase = 'direct' | 'planning' | 'worker' | 'artifact_closure' | 'summarizing'

export type OrchestratedRole = {
  id: string
  name: string
  role_type: string
  capability_tags: unknown
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
  const tags = Array.isArray(role.capability_tags) ? role.capability_tags.join(' ') : ''
  return `${role.name} ${role.role_type} ${tags}`.toLowerCase()
}

function isFrontendRole(role: OrchestratedRole) {
  const text = roleText(role)
  return text.includes('front') || text.includes('ui') || text.includes('web') || text.includes('前端') || text.includes('界面')
}

function isBackendRole(role: OrchestratedRole) {
  const text = roleText(role)
  return text.includes('back') || text.includes('api') || text.includes('server') || text.includes('后端') || text.includes('接口') || text.includes('数据库')
}

function isArtifactAssistantRole(role: OrchestratedRole) {
  const text = roleText(role)
  return role.name === '产物助手' || text.includes('artifact') || text.includes('产物') || text.includes('发布') || text.includes('预览')
}

function isProductDeliveryIntent(task: string) {
  const explicitDelivery = /(全自动|完整权限|完全控制|自动完成|直到交付|交付产物)/.test(task)
  const canonicalProductPrompt = /sqlite|SQLite|历史记录/.test(task)
    && /(网站|网页|页面|应用|服务)/.test(task)
    && /(加减乘除|计算器|生成姓名|姓名生成|姓名)/.test(task)
  const generatedProductPrompt = /(生成|做一个|创建|实现|开发).*(网页|网站|应用|服务|文档|markdown|Markdown|PPT|ppt|演示稿)/.test(task)
  return explicitDelivery || canonicalProductPrompt || generatedProductPrompt
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
  if (target.phase === 'artifact_closure') return `${target.role?.name ?? '产物助手'}收口`
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
  const productDelivery = isProductDeliveryIntent(task)
  const artifactAssistant = productDelivery
    ? selectedRoles.find((role) => role.id !== orchestrator.id && isArtifactAssistantRole(role))
    : null
  const workers: Array<OrchestratedTarget<T>> = selectedRoles
    .filter((role) => role.id !== orchestrator.id && role.id !== artifactAssistant?.id)
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

  const workerNodeIds = workers.map((target) => target.nodeId).filter((id): id is string => Boolean(id))
  const artifactClosure: OrchestratedTarget<T> | null = artifactAssistant
    ? {
        nodeId: randomUUID(),
        role: artifactAssistant,
        phase: 'artifact_closure',
        dependsOn: workerNodeIds.length > 0 ? workerNodeIds : [planner.nodeId as string],
      }
    : null

  const summarizer: OrchestratedTarget<T> = {
    nodeId: randomUUID(),
    role: orchestrator,
    phase: 'summarizing',
    dependsOn: artifactClosure?.nodeId
      ? [artifactClosure.nodeId]
      : workerNodeIds,
  }

  const targets = [planner, ...workers, ...(artifactClosure ? [artifactClosure] : []), summarizer]
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
