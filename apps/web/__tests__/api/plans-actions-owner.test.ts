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
})
