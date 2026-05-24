import { describe, it, expect } from 'vitest'
import { getReadyNodes, advanceDAG, isPlanComplete, hasPlanFailed } from '../lib/orchestrator/dag-scheduler'
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
