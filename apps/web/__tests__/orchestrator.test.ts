import { describe, it, expect } from 'vitest'
import { getReadyNodes, advanceDAG, isPlanComplete, hasPlanFailed, validateDAG, evaluatePlanProgress } from '../lib/orchestrator/dag-scheduler'
import { generateOrchestration, type OrchestratedRole } from '../lib/orchestrator/dag-generator'
import { classifyRisk, requiresApproval } from '../lib/orchestrator/permission-engine'
import { DEFAULT_POLICIES } from '@agenthub/shared'
import type { PlanNode } from '@agenthub/shared'

describe('DAG Scheduler', () => {
  const makeNode = (id: string, status: PlanNode['status'], depends_on: string[] = []): PlanNode => ({
    id, plan_id: 'p1', label: `Task ${id}`, status, depends_on,
    started_at: undefined, completed_at: undefined,
  })

  it('should find nodes with no dependencies as ready', () => {
    const nodes = [makeNode('a', 'pending'), makeNode('b', 'pending', ['a'])]
    const ready = getReadyNodes(nodes)
    expect(ready.map(n => n.id)).toEqual(['a'])
  })

  it('should find nodes whose deps are completed', () => {
    const nodes = [makeNode('a', 'completed'), makeNode('b', 'pending', ['a']), makeNode('c', 'pending', ['a', 'b'])]
    const ready = getReadyNodes(nodes)
    expect(ready.map(n => n.id)).toEqual(['b'])
  })

  it('advanceDAG marks ready nodes', () => {
    const nodes = [makeNode('a', 'completed'), makeNode('b', 'pending', ['a'])]
    const advanced = advanceDAG(nodes)
    expect(advanced[1].status).toBe('ready')
  })

  it('isPlanComplete returns true when all terminal', () => {
    expect(isPlanComplete([makeNode('a', 'completed'), makeNode('b', 'failed')])).toBe(true)
    expect(isPlanComplete([makeNode('a', 'completed'), makeNode('b', 'running')])).toBe(false)
  })

  it('hasPlanFailed detects failures', () => {
    expect(hasPlanFailed([makeNode('a', 'completed'), makeNode('b', 'failed')])).toBe(true)
    expect(hasPlanFailed([makeNode('a', 'completed')])).toBe(false)
  })

  it('validates missing, self, and cyclic dependencies', () => {
    const issues = validateDAG([
      makeNode('a', 'pending', ['missing']),
      makeNode('b', 'pending', ['b']),
      makeNode('c', 'pending', ['d']),
      makeNode('d', 'pending', ['c']),
    ])

    expect(issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'missing_dependency',
      'self_dependency',
      'cycle',
    ]))
  })

  it('waits for all fan-in dependencies before marking a node ready', () => {
    const waiting = evaluatePlanProgress([
      makeNode('a', 'completed'),
      makeNode('b', 'running'),
      makeNode('c', 'pending', ['a', 'b']),
    ])
    expect(waiting.readyNodeIds).toEqual([])

    const ready = evaluatePlanProgress([
      makeNode('a', 'completed'),
      makeNode('b', 'completed'),
      {
        ...makeNode('c', 'waiting', ['a', 'b']),
        result: { scheduler: 'waiting', reason: 'dependencies still waiting' },
      },
    ])
    expect(ready.readyNodeIds).toEqual(['c'])
    expect(ready.transitions).toContainEqual(expect.objectContaining({ nodeId: 'c', from: 'waiting', to: 'ready' }))
  })

  it('does not auto-ready a node waiting on a runtime permission boundary', () => {
    const result = evaluatePlanProgress([
      makeNode('planner', 'completed'),
      makeNode('backend', 'completed', ['planner']),
      {
        ...makeNode('frontend', 'waiting', ['planner', 'backend']),
        result: {
          terminal: 'failed',
          error: 'Runtime 工具已进入权限审批，未执行该操作。',
          runtimeSessionId: 'runtime-front-permission',
        },
      },
    ])

    expect(result.readyNodeIds).toEqual([])
    expect(result.transitions).toEqual([])
  })

  it('blocks downstream nodes when an upstream dependency fails or is cancelled', () => {
    const failed = evaluatePlanProgress([
      makeNode('a', 'failed'),
      makeNode('b', 'pending', ['a']),
      makeNode('c', 'cancelled'),
      makeNode('d', 'waiting', ['c']),
    ])

    expect(failed.blockedNodeIds).toEqual(['b', 'd'])
    expect(failed.transitions).toEqual(expect.arrayContaining([
      expect.objectContaining({ nodeId: 'b', to: 'blocked', reason: expect.stringContaining('a') }),
      expect.objectContaining({ nodeId: 'd', to: 'blocked', reason: expect.stringContaining('c') }),
    ]))
  })

  it('recovers unrun downstream failures after the upstream approval continuation completes', () => {
    const result = evaluatePlanProgress([
      makeNode('planner', 'completed'),
      {
        ...makeNode('backend', 'failed', ['planner']),
        started_at: undefined,
        result: { error: '上游角色执行失败，节点未运行' },
      },
      {
        ...makeNode('frontend', 'failed', ['planner', 'backend']),
        started_at: undefined,
        result: { error: '上游角色执行失败，节点未运行' },
      },
    ])

    expect(result.readyNodeIds).toEqual(['backend'])
    expect(result.blockedNodeIds).toEqual([])
    expect(result.transitions).toEqual([
      expect.objectContaining({ nodeId: 'backend', from: 'failed', to: 'ready' }),
      expect.objectContaining({ nodeId: 'frontend', from: 'failed', to: 'waiting' }),
    ])
  })

  it('does not recover a node that actually started and failed', () => {
    const result = evaluatePlanProgress([
      makeNode('planner', 'completed'),
      {
        ...makeNode('backend', 'failed', ['planner']),
        started_at: '2026-06-05T00:00:00.000Z',
        result: { error: 'runtime crashed' },
      },
    ])

    expect(result.readyNodeIds).toEqual([])
    expect(result.transitions).toEqual([])
  })

  it('blocks runnable nodes when the DAG is invalid instead of dispatching malformed work', () => {
    const result = evaluatePlanProgress([
      makeNode('a', 'pending', ['missing']),
      makeNode('b', 'ready'),
    ])

    expect(result.readyNodeIds).toEqual([])
    expect(result.blockedNodeIds).toEqual(['a', 'b'])
    expect(result.transitions[0].reason).toContain('invalid DAG')
  })
})

describe('DAG Generator', () => {
  const roles: OrchestratedRole[] = [
    { id: 'agent-arch', name: '架构师', role_type: 'orchestrator', capability_tags: ['规划'], is_orchestrator: true },
    { id: 'agent-fe', name: '前端工程师', role_type: 'frontend', capability_tags: ['UI'], is_orchestrator: false },
    { id: 'agent-be', name: '后端工程师', role_type: 'backend', capability_tags: ['API'], is_orchestrator: false },
    { id: 'agent-artifact', name: '产物助手', role_type: 'assistant', capability_tags: ['产物', '预览', '发布'], is_orchestrator: false },
  ]

  it('generates planner, parallel workers, and summarizer fan-in for general collaboration tasks', () => {
    const result = generateOrchestration(roles, '请前后端一起完成页面和服务', false)

    expect(result.useOrchestratedRun).toBe(true)
    expect(result.planNodes.map((node) => node.label)).toEqual(['架构师规划', '前端工程师执行', '后端工程师执行', '产物助手执行', '架构师汇总'])

    const [planner, frontend, backend, artifactAssistant, summarizer] = result.planNodes
    expect(frontend.depends_on).toEqual([planner.id])
    expect(backend.depends_on).toEqual([planner.id])
    expect(artifactAssistant.depends_on).toEqual([planner.id])
    expect(summarizer.depends_on).toEqual([frontend.id, backend.id, artifactAssistant.id])
    expect(result.dag.edges).toEqual(expect.arrayContaining([
      { from: planner.id, to: frontend.id },
      { from: planner.id, to: backend.id },
      { from: planner.id, to: artifactAssistant.id },
      { from: frontend.id, to: summarizer.id },
      { from: backend.id, to: summarizer.id },
      { from: artifactAssistant.id, to: summarizer.id },
    ]))
  })

  it('adds artifact assistant closure after workers for product delivery tasks', () => {
    const result = generateOrchestration(roles, '做一个加减乘除的简单网站，使用 sqlite 存储历史记录', true)

    expect(result.planNodes.map((node) => node.label)).toEqual(['架构师规划', '前端工程师执行', '后端工程师执行', '产物助手收口', '架构师汇总'])
    const frontend = result.planNodes.find((node) => node.label === '前端工程师执行')
    const backend = result.planNodes.find((node) => node.label === '后端工程师执行')
    const artifactClosure = result.planNodes.find((node) => node.label === '产物助手收口')
    const summarizer = result.planNodes.find((node) => node.label === '架构师汇总')

    expect(artifactClosure?.depends_on).toEqual(expect.arrayContaining([frontend?.id, backend?.id]))
    expect(summarizer?.depends_on).toEqual([artifactClosure?.id])
  })

  it('runs presentation engineer before artifact assistant closure for PPT delivery tasks', () => {
    const result = generateOrchestration([
      roles[0]!,
      { id: 'agent-ppt', name: '演示稿工程师', role_type: 'engineer', capability_tags: ['演示稿', 'PPT'], is_orchestrator: false },
      roles[3]!,
    ], '生成一份项目汇报 PPT，并提供预览', true)

    expect(result.planNodes.map((node) => node.label)).toEqual(['架构师规划', '演示稿工程师执行', '产物助手收口', '架构师汇总'])
    const presentation = result.planNodes.find((node) => node.label === '演示稿工程师执行')
    const artifactClosure = result.planNodes.find((node) => node.label === '产物助手收口')
    const summarizer = result.planNodes.find((node) => node.label === '架构师汇总')

    expect(artifactClosure?.depends_on).toContain(presentation?.id)
    expect(summarizer?.depends_on).toEqual([artifactClosure?.id])
  })

  it('routes document plus PPT delivery prompts to presentation engineer without backend workers', () => {
    const result = generateOrchestration([
      roles[0]!,
      { id: 'agent-ppt', name: '演示稿工程师', role_type: 'engineer', capability_tags: ['演示稿', 'PPT', '文档'], is_orchestrator: false },
      roles[3]!,
    ], '帮我生成一个文档和一个PPT。内容简单介绍一下字节跳动', true)

    expect(result.planNodes.map((node) => node.label)).toEqual(['架构师规划', '演示稿工程师执行', '产物助手收口', '架构师汇总'])
    expect(result.planNodes.some((node) => node.label === '后端工程师执行')).toBe(false)
  })

  it('serializes frontend after backend when the task requires API or database contract first', () => {
    const result = generateOrchestration(roles, '先定义后端接口和数据库 schema，再让前端调用后端 API', false)

    const frontend = result.planNodes.find((node) => node.label === '前端工程师执行')
    const backend = result.planNodes.find((node) => node.label === '后端工程师执行')

    expect(frontend?.depends_on).toEqual(expect.arrayContaining([backend?.id]))
  })
})

describe('Permission Engine', () => {
  it('classifies rm -rf as high risk', () => {
    expect(classifyRisk('shell', 'rm -rf /tmp/test')).toBe('high')
  })

  it('classifies git push as medium risk', () => {
    expect(classifyRisk('shell', 'git push origin main')).toBe('medium')
  })

  it('classifies ls as low risk', () => {
    expect(classifyRisk('shell', 'ls -la')).toBe('low')
  })

  it('deploy is always high', () => {
    expect(classifyRisk('deploy', 'deploy to prod')).toBe('high')
  })

  it('high risk requires approval', () => {
    expect(requiresApproval('shell', 'high', DEFAULT_POLICIES)).toBe(true)
  })

  it('low risk shell does not require approval', () => {
    expect(requiresApproval('shell', 'low', DEFAULT_POLICIES)).toBe(false)
  })

  it('git_push requires approval by default', () => {
    expect(requiresApproval('git_push', 'medium', DEFAULT_POLICIES)).toBe(true)
  })
})
