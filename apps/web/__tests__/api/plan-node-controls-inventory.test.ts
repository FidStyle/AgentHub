import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  resetMockAuth,
  resetMockClient,
  setupMockAuth,
  setupMockClient,
} from '../utils'

const { detectCliRuntimeCapabilitiesMock } = vi.hoisted(() => ({
  detectCliRuntimeCapabilitiesMock: vi.fn(() => [
    {
      type: 'claude_code',
      available: true,
      authenticated: true,
      launchable: true,
      supportsResume: true,
      supportsContinue: true,
      version: 'claude 1.0.0',
      cliPath: '/usr/local/bin/claude',
      diagnostic: 'authenticated',
    },
    {
      type: 'codex',
      available: false,
      authenticated: false,
      launchable: false,
      supportsResume: true,
      supportsContinue: true,
      diagnostic: 'codex CLI not found',
    },
  ]),
}))

vi.mock('@/lib/runtime/executor', () => ({
  detectCliRuntimeCapabilities: () => detectCliRuntimeCapabilitiesMock(),
}))

async function callDynamicPost(
  handler: (_request: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>,
  id = 'node-001',
) {
  const response = await handler(new Request(`http://localhost/api/plan-nodes/${id}`, { method: 'POST' }), {
    params: Promise.resolve({ id }),
  })
  return { status: response.status, data: await response.json() }
}

async function callTimeline(planId = 'plan-001') {
  const { GET } = await import('@/app/api/plans/[planId]/timeline/route')
  const response = await GET(new Request(`http://localhost/api/plans/${planId}/timeline`), {
    params: Promise.resolve({ planId }),
  })
  return { status: response.status, data: await response.json() }
}

async function callInventory(workspaceId?: string) {
  const { GET } = await import('@/app/api/runtime/inventory/route')
  const url = new URL('http://localhost/api/runtime/inventory')
  if (workspaceId) url.searchParams.set('workspace_id', workspaceId)
  const response = await GET(new Request(url))
  return { status: response.status, data: await response.json() }
}

function controlChain() {
  const writes: Array<{ table: string; values: Record<string, unknown>; id?: string }> = []
  const node = {
    id: 'node-001',
    plan_id: 'plan-001',
    label: '后端工程师执行',
    agent_id: 'agent-be',
    status: 'failed',
    action_payload: { userMessage: '修复 API' },
  }
  const plan = { id: 'plan-001', session_id: 'session-001', owner_id: 'user-001', title: '完整编排' }
  const session = { id: 'session-001', workspace_id: 'ws-001' }
  const role = { id: 'agent-be', name: '后端工程师', runtime_type: 'codex' }
  const previousAttempt = { id: 'attempt-001', attempt_number: 1, runtime_session_id: 'runtime-prev-001' }
  const planNodesForProgress = [
    { ...node, status: 'cancelled', depends_on: [], action_type: 'runtime_invoke' },
    { id: 'node-downstream', plan_id: 'plan-001', label: '架构师汇总', agent_id: 'agent-arch', status: 'waiting', depends_on: ['node-001'], action_type: 'runtime_invoke' },
  ]

  const chainFactory = vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'plan_nodes') {
        return {
          select: () => ({
            eq: (field: string) => {
              if (field === 'plan_id') return { data: planNodesForProgress, error: null }
              return { single: () => ({ data: node, error: null }) }
            },
          }),
          update: (values: Record<string, unknown>) => ({
            eq: (_field: string, id: string) => {
              writes.push({ table, values, id })
              return { data: null, error: null }
            },
          }),
        }
      }
      if (table === 'plans') {
        return {
          select: () => ({ eq: () => ({ eq: () => ({ single: () => ({ data: plan, error: null }) }) }) }),
          update: (values: Record<string, unknown>) => ({
            eq: (_field: string, id: string) => {
              writes.push({ table, values, id })
              return { data: null, error: null }
            },
          }),
        }
      }
      if (table === 'sessions') {
        return { select: () => ({ eq: () => ({ single: () => ({ data: session, error: null }) }) }) }
      }
      if (table === 'role_agents') {
        return { select: () => ({ eq: () => ({ single: () => ({ data: role, error: null }) }) }) }
      }
      if (table === 'plan_node_attempts') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({ data: [previousAttempt], error: null }),
              }),
            }),
          }),
          insert: (values: Record<string, unknown>) => {
            writes.push({ table, values })
            return { select: () => ({ single: () => ({ data: { id: 'attempt-002', ...values }, error: null }) }) }
          },
          update: (values: Record<string, unknown>) => ({
            eq: (_field: string, id: string) => {
              writes.push({ table, values, id })
              return { data: null, error: null }
            },
          }),
        }
      }
      if (table === 'agent_mailbox_items') {
        return {
          insert: (values: Record<string, unknown>) => {
            writes.push({ table, values })
            return { select: () => ({ single: () => ({ data: { id: 'mailbox-001', ...values }, error: null }) }) }
          },
        }
      }
      return { select: () => ({ eq: () => ({ single: () => ({ data: null, error: null }) }) }) }
    }),
  }))

  return { chainFactory, writes }
}

function timelineChain(owner = true) {
  const plan = owner ? { id: 'plan-001', session_id: 'session-001', owner_id: 'user-001', title: '完整编排' } : null
  const nodes = [{ id: 'node-001', plan_id: 'plan-001', label: '后端工程师执行' }]
  const attempts = [{ id: 'attempt-001', plan_node_id: 'node-001', runtime_session_id: 'runtime-001' }]
  const mailbox = [{ id: 'mailbox-001', plan_id: 'plan-001', plan_node_id: 'node-001' }]
  const runtimeSessions = [{ id: 'runtime-001', status: 'completed' }]
  const logs = [{ id: 'log-001', runtime_session_id: 'runtime-001', seq: 1 }]
  const artifacts = [{ id: 'artifact-001', session_id: 'session-001' }]

  const chainFactory = vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'plans') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({ single: () => ({ data: plan, error: plan ? null : { message: 'Not found' } }) }),
            }),
          }),
        }
      }
      if (table === 'plan_nodes') return { select: () => ({ eq: () => ({ order: () => ({ data: nodes, error: null }) }) }) }
      if (table === 'plan_node_attempts') return { select: () => ({ in: () => ({ order: () => ({ data: attempts, error: null }) }) }) }
      if (table === 'agent_mailbox_items') return { select: () => ({ eq: () => ({ order: () => ({ data: mailbox, error: null }) }) }) }
      if (table === 'runtime_sessions') return { select: () => ({ in: () => ({ data: runtimeSessions, error: null }) }) }
      if (table === 'runtime_logs') return { select: () => ({ in: () => ({ order: () => ({ data: logs, error: null }) }) }) }
      if (table === 'artifacts') return { select: () => ({ eq: () => ({ order: () => ({ data: artifacts, error: null }) }) }) }
      return { select: () => ({ eq: () => ({ single: () => ({ data: null, error: null }) }) }) }
    }),
  }))
  return { chainFactory }
}

function inventoryChain(owner = true) {
  const workspace = owner ? { id: 'ws-001' } : null
  const roles = [
    { id: 'agent-fe', name: '前端工程师', runtime_type: 'claude_code' },
    { id: 'agent-be', name: '后端工程师', runtime_type: 'codex' },
  ]
  const chainFactory = vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'workspaces') {
        return { select: () => ({ eq: () => ({ eq: () => ({ single: () => ({ data: workspace, error: workspace ? null : { message: 'Not found' } }) }) }) }) }
      }
      if (table === 'role_agents') {
        return { select: () => ({ eq: () => ({ order: () => ({ data: roles, error: null }) }) }) }
      }
      return { select: () => ({ eq: () => ({ single: () => ({ data: null, error: null }) }) }) }
    }),
  }))
  return { chainFactory }
}

describe('plan node controls, timeline, and runtime inventory APIs', () => {
  beforeEach(() => {
    resetMockAuth()
    resetMockClient()
    setupMockAuth()
    detectCliRuntimeCapabilitiesMock.mockClear()
  })

  it('retry creates a new attempt, preserves lineage, and enqueues a target-role mailbox item', async () => {
    const { POST } = await import('@/app/api/plan-nodes/[id]/retry/route')
    const { chainFactory, writes } = controlChain()
    setupMockClient(chainFactory)

    const result = await callDynamicPost(POST)

    expect(result.status).toBe(200)
    expect(result.data.control).toBe('retry')
    expect(writes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: 'plan_node_attempts',
        values: expect.objectContaining({ control: 'retry', attempt_number: 2, previous_attempt_id: 'attempt-001', status: 'queued' }),
      }),
      expect.objectContaining({
        table: 'agent_mailbox_items',
        values: expect.objectContaining({ to_role_agent_id: 'agent-be', runtime_type: 'codex', attempt_id: 'attempt-002', parent_attempt_id: 'attempt-001' }),
      }),
      expect.objectContaining({
        table: 'plan_nodes',
        values: expect.objectContaining({ status: 'ready' }),
        id: 'node-001',
      }),
      expect.objectContaining({
        table: 'plans',
        values: expect.objectContaining({ status: 'running' }),
        id: 'plan-001',
      }),
    ]))
  })

  it('resume records previous runtime session evidence in the mailbox context', async () => {
    const { POST } = await import('@/app/api/plan-nodes/[id]/resume/route')
    const { chainFactory, writes } = controlChain()
    setupMockClient(chainFactory)

    const result = await callDynamicPost(POST)

    expect(result.status).toBe(200)
    expect(result.data.control).toBe('resume')
    expect(writes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: 'plan_node_attempts',
        values: expect.objectContaining({ control: 'resume', previous_attempt_id: 'attempt-001' }),
      }),
      expect.objectContaining({
        table: 'agent_mailbox_items',
        values: expect.objectContaining({
          context_package: expect.objectContaining({
            metadata: expect.objectContaining({
              control: 'resume',
              previousAttemptId: 'attempt-001',
              previousRuntimeSessionId: 'runtime-prev-001',
            }),
          }),
        }),
      }),
    ]))
  })

  it('cancel records a cancelled attempt without creating a fake mailbox dispatch', async () => {
    const { POST } = await import('@/app/api/plan-nodes/[id]/cancel/route')
    const { chainFactory, writes } = controlChain()
    setupMockClient(chainFactory)

    const result = await callDynamicPost(POST)

    expect(result.status).toBe(200)
    expect(result.data.control).toBe('cancel')
    expect(writes).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: 'plan_node_attempts',
        values: expect.objectContaining({ control: 'cancel', status: 'cancelled' }),
      }),
      expect.objectContaining({
        table: 'plan_nodes',
        values: expect.objectContaining({ status: 'cancelled' }),
      }),
      expect.objectContaining({
        table: 'plan_nodes',
        values: expect.objectContaining({ status: 'blocked', result: expect.objectContaining({ reason: expect.stringContaining('node-001') }) }),
        id: 'node-downstream',
      }),
      expect.objectContaining({
        table: 'plans',
        values: expect.objectContaining({ status: 'failed' }),
        id: 'plan-001',
      }),
    ]))
    expect(writes.some((write) => write.table === 'agent_mailbox_items')).toBe(false)
  })

  it('timeline returns durable nodes, attempts, mailbox items, runtime evidence, and artifacts', async () => {
    const { chainFactory } = timelineChain()
    setupMockClient(chainFactory)

    const result = await callTimeline()

    expect(result.status).toBe(200)
    expect(result.data.plan.id).toBe('plan-001')
    expect(result.data.nodes).toHaveLength(1)
    expect(result.data.attempts).toHaveLength(1)
    expect(result.data.mailbox_items).toHaveLength(1)
    expect(result.data.runtime_sessions).toHaveLength(1)
    expect(result.data.runtime_logs).toHaveLength(1)
    expect(result.data.artifacts).toHaveLength(1)
  })

  it('timeline rejects plans outside the current user', async () => {
    const { chainFactory } = timelineChain(false)
    setupMockClient(chainFactory)

    const result = await callTimeline()

    expect(result.status).toBe(404)
    expect(result.data).toEqual({ error: '计划不存在或无权限' })
  })

  it('runtime inventory maps machine CLI health to each role runtime binding', async () => {
    const { chainFactory } = inventoryChain()
    setupMockClient(chainFactory)

    const result = await callInventory('ws-001')

    expect(result.status).toBe(200)
    expect(result.data.inventory).toHaveLength(2)
    expect(result.data.roles).toEqual([
      expect.objectContaining({ name: '前端工程师', selected_runtime_health: expect.objectContaining({ runtimeType: 'claude_code', available: true }) }),
      expect.objectContaining({ name: '后端工程师', selected_runtime_health: expect.objectContaining({ runtimeType: 'codex', available: false }) }),
    ])
  })

  it('runtime inventory rejects workspace access outside the current user', async () => {
    const { chainFactory } = inventoryChain(false)
    setupMockClient(chainFactory)

    const result = await callInventory('ws-other')

    expect(result.status).toBe(404)
    expect(result.data).toEqual({ error: '工作区不存在或无权限' })
  })
})
