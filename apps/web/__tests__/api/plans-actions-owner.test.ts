import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  resetMockAuth,
  resetMockClient,
  setupMockAuth,
  setupMockClient,
  mockSession,
} from '../utils'

async function callRoute(
  handler: (request: Request) => Promise<Response>,
  method: 'GET' | 'POST',
  path: string,
  options: { query?: Record<string, string>; body?: unknown } = {},
) {
  const url = new URL(path, 'http://localhost')
  for (const [key, value] of Object.entries(options.query ?? {})) {
    url.searchParams.set(key, value)
  }
  const request = new Request(url, {
    method,
    headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
    body: method === 'POST' ? JSON.stringify(options.body ?? {}) : undefined,
  })
  const response = await handler(request)
  return { status: response.status, data: await response.json() }
}

async function callConfirmPlan(planId: string) {
  const { POST } = await import('@/app/api/plans/[planId]/confirm/route')
  const response = await POST(new Request('http://localhost/api/plans/plan-001/confirm', { method: 'POST' }), {
    params: Promise.resolve({ planId }),
  })
  return { status: response.status, data: await response.json() }
}

function sessionOwnedByOtherUserChain() {
  const targetTableCalls: string[] = []
  const sessionQuery = {
    eq: () => sessionQuery,
    single: () => ({ data: mockSession, error: null }),
  }
  const workspaceQuery = {
    eq: () => workspaceQuery,
    single: () => ({ data: null, error: { message: 'Not found' } }),
  }

  const chainFactory = vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'sessions') {
        return { select: () => sessionQuery }
      }
      if (table === 'workspaces') {
        return { select: () => workspaceQuery }
      }
      targetTableCalls.push(table)
      return {
        select: () => ({ eq: () => ({ order: () => ({ data: [], error: null }) }) }),
        insert: () => ({
          select: () => ({
            single: () => ({ data: null, error: { message: 'Should not write target table' } }),
          }),
        }),
      }
    }),
  }))

  return { chainFactory, targetTableCalls }
}

function confirmPlanCreatesActionsChain() {
  const writes: Array<{ table: string; values: Record<string, unknown> }> = []
  const plan = { id: 'plan-001', session_id: 'session-001', owner_id: 'user-001', title: '测试计划', status: 'pending_confirm' }
  const nodes = [
    {
      id: '00000000-0000-4000-8000-000000000101',
      plan_id: 'plan-001',
      label: '运行测试',
      status: 'pending',
      depends_on: [],
      action_type: 'shell',
      action_payload: { command: 'rm -rf dist', cwd: '/workspace' },
    },
  ]
  const chainFactory = vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'plans') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({ single: () => ({ data: plan, error: null }) }),
            }),
          }),
          update: (values: Record<string, unknown>) => {
            writes.push({ table, values })
            return { eq: () => ({ data: null, error: null }) }
          },
        }
      }
      if (table === 'plan_nodes') {
        return {
          select: () => ({ eq: () => ({ data: nodes, error: null }) }),
          update: (values: Record<string, unknown>) => {
            writes.push({ table, values })
            return { eq: () => ({ data: null, error: null }) }
          },
        }
      }
      if (table === 'actions') {
        return {
          insert: (values: Record<string, unknown>) => {
            writes.push({ table, values })
            return { select: () => ({ single: () => ({ data: { id: 'action-001', ...values }, error: null }) }) }
          },
        }
      }
      if (table === 'notifications') {
        return {
          insert: (values: Record<string, unknown>) => {
            writes.push({ table, values })
            return { data: { id: 'notification-001', ...values }, error: null }
          },
        }
      }
      return {
        select: () => ({ eq: () => ({ single: () => ({ data: null, error: null }) }) }),
      }
    }),
  }))
  return { chainFactory, writes }
}

describe('plans/actions API session ownership', () => {
  beforeEach(() => {
    resetMockAuth()
    resetMockClient()
    setupMockAuth()
  })

  it('rejects GET /api/plans for a session outside the current user workspace', async () => {
    const { GET } = await import('@/app/api/plans/route')
    const { chainFactory, targetTableCalls } = sessionOwnedByOtherUserChain()
    setupMockClient(chainFactory)

    const result = await callRoute(GET, 'GET', '/api/plans', { query: { session_id: 'session-001' } })

    expect(result.status).toBe(403)
    expect(result.data).toEqual({ error: '无权限' })
    expect(targetTableCalls).not.toContain('plans')
  })

  it('rejects POST /api/plans for a session outside the current user workspace', async () => {
    const { POST } = await import('@/app/api/plans/route')
    const { chainFactory, targetTableCalls } = sessionOwnedByOtherUserChain()
    setupMockClient(chainFactory)

    const result = await callRoute(POST, 'POST', '/api/plans', {
      body: {
        session_id: 'session-001',
        title: '越权计划',
        nodes: [{ id: '00000000-0000-4000-8000-000000000101', label: 'step' }],
      },
    })

    expect(result.status).toBe(403)
    expect(result.data).toEqual({ error: '无权限' })
    expect(targetTableCalls).not.toContain('plans')
    expect(targetTableCalls).not.toContain('plan_nodes')
  })

  it('rejects GET /api/actions for a session outside the current user workspace', async () => {
    const { GET } = await import('@/app/api/actions/route')
    const { chainFactory, targetTableCalls } = sessionOwnedByOtherUserChain()
    setupMockClient(chainFactory)

    const result = await callRoute(GET, 'GET', '/api/actions', { query: { session_id: 'session-001' } })

    expect(result.status).toBe(403)
    expect(result.data).toEqual({ error: '无权限' })
    expect(targetTableCalls).not.toContain('actions')
  })

  it('rejects POST /api/actions for a session outside the current user workspace', async () => {
    const { POST } = await import('@/app/api/actions/route')
    const { chainFactory, targetTableCalls } = sessionOwnedByOtherUserChain()
    setupMockClient(chainFactory)

    const result = await callRoute(POST, 'POST', '/api/actions', {
      body: { session_id: 'session-001', action_type: 'shell', command: 'echo should-not-run' },
    })

    expect(result.status).toBe(403)
    expect(result.data).toEqual({ error: '无权限' })
    expect(targetTableCalls).not.toContain('actions')
    expect(targetTableCalls).not.toContain('notifications')
  })

  it('confirming a plan marks ready nodes and creates action authorization records', async () => {
    const { chainFactory, writes } = confirmPlanCreatesActionsChain()
    setupMockClient(chainFactory)

    const result = await callConfirmPlan('plan-001')

    expect(result.status).toBe(200)
    expect(result.data).toEqual({ status: 'running', ready_nodes: 1, created_actions: 1 })
    expect(writes).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: 'plans', values: expect.objectContaining({ status: 'running' }) }),
      expect.objectContaining({ table: 'plan_nodes', values: expect.objectContaining({ status: 'ready' }) }),
      expect.objectContaining({ table: 'actions', values: expect.objectContaining({ command: 'rm -rf dist', risk_level: 'high', status: 'pending', requires_approval: true }) }),
      expect.objectContaining({ table: 'notifications', values: expect.objectContaining({ type: 'approval_required', ref_type: 'action', ref_id: 'action-001' }) }),
    ]))
  })
})
