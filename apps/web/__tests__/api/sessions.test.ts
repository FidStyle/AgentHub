/**
 * API route tests for /api/sessions and /api/sessions/[id]
 *
 * L0 unit tests: API route handlers with mocked Supabase client.
 * Tests auth checks, input validation, ownership checks, and response shapes.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  setupMockClient,
  createSupabaseChain,
  createNoAuthChain,
  createErrorChain,
  resetMockClient,
  mockUser,
} from '../utils'

// ---------------------------------------------------------------------------
// Helper: call a route handler and extract status + body
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function callRoute<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: any,
  method: 'GET' | 'POST' | 'PATCH',
  options: {
    body?: unknown
    params?: { id: string }
    query?: Record<string, string>
  } = {},
): Promise<{ status: number; data: unknown }> {
  const { body, params, query } = options

  const url = new URL(
    params ? `/api/sessions/${params.id}` : '/api/sessions',
    'http://localhost',
  )
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      url.searchParams.set(k, v)
    }
  }

  let request: Request
  if (method === 'GET') {
    request = new Request(url, { method: 'GET' })
  } else if (method === 'POST') {
    request = new Request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    })
  } else {
    request = new Request(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    })
  }

  const context = params ? { params: Promise.resolve(params) } : undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await handler(request, context as any)

  if (result && typeof result === 'object' && 'status' in (result as { status?: number })) {
    const r = result as unknown as { status: number; json: () => Promise<unknown> }
    return { status: r.status, data: await r.json() }
  }

  return { status: 200, data: result }
}

// ---------------------------------------------------------------------------
// Custom chain factories for specific scenarios
// ---------------------------------------------------------------------------

/** Workspace lookup returns empty (no ownership), supports chained .eq().eq() */
function noWorkspaceChain() {
  function makeEq() {
    return {
      eq: makeEq,
      single: () => ({ data: null, error: { message: 'Not found' } }),
    }
  }
  return vi.fn(() => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
    from: vi.fn((table: string) => {
      if (table === 'workspaces') {
        return {
          select: () => ({ eq: makeEq }),
        }
      }
      if (table === 'sessions') {
        return {
          select: () => ({ eq: () => ({ order: () => ({ data: [], error: null }) }) }),
          insert: () => ({
            select: () => ({
              single: () => ({ data: null, error: { message: 'Not called' } }),
            }),
          }),
        }
      }
      return {
        select: () => ({ eq: () => ({ single: () => ({ data: null, error: null }) }) }),
      }
    }),
  }))
}

/** GET sessions/[id]: session found but workspace not owned by user */
function sessionWorkspaceNotOwnedChain() {
  return vi.fn(() => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
    from: vi.fn((table: string) => {
      if (table === 'sessions') {
        return {
          select: () => ({
            eq: () => ({
              single: () => ({
                data: {
                  id: 'session-001',
                  workspace_id: 'ws-001',
                  name: '测试会话',
                  status: 'active',
                  workspaces: { owner_id: 'other-user' },
                },
                error: null,
              }),
            }),
          }),
        }
      }
      return {
        select: () => ({ eq: () => ({ single: () => ({ data: null, error: null }) }) }),
      }
    }),
  }))
}

/** PATCH sessions/[id]: session found, workspace lookup fails, supports chained .eq().eq() */
function sessionWorkspaceNotOwnedChainForUpdate() {
  function makeEq() {
    return {
      eq: makeEq,
      single: () => ({ data: null, error: { message: 'Not found' } }),
    }
  }
  return vi.fn(() => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
    from: vi.fn((table: string) => {
      if (table === 'sessions') {
        return {
          select: () => ({
            eq: () => ({
              single: () => ({
                data: { id: 'session-001', workspace_id: 'ws-001', name: '测试会话', status: 'active' },
                error: null,
              }),
            }),
          }),
          update: () => ({ eq: makeEq }),
        }
      }
      if (table === 'workspaces') {
        return {
          select: () => ({ eq: makeEq }),
        }
      }
      return {
        select: () => ({ eq: () => ({ single: () => ({ data: null, error: null }) }) }),
      }
    }),
  }))
}

// ---------------------------------------------------------------------------
// GET /api/sessions
// ---------------------------------------------------------------------------

describe('GET /api/sessions', () => {
  beforeEach(() => {
    resetMockClient()
  })

  it('AT-S001: returns 401 when not authenticated', async () => {
    const { GET } = await import('@/app/api/sessions/route')
    setupMockClient(createNoAuthChain())
    const result = await callRoute(GET, 'GET', { query: { workspace_id: 'ws-001' } })
    expect(result.status).toBe(401)
    expect(result.data).toEqual({ error: '未授权' })
  })

  it('AT-S002: returns 400 when workspace_id is missing', async () => {
    const { GET } = await import('@/app/api/sessions/route')
    setupMockClient(createSupabaseChain())
    const result = await callRoute(GET, 'GET', {})
    expect(result.status).toBe(400)
    expect((result.data as { error: string }).error).toBe('缺少 workspace_id')
  })

  it('AT-S003: returns 403 when workspace does not belong to user', async () => {
    const { GET } = await import('@/app/api/sessions/route')
    setupMockClient(noWorkspaceChain())
    const result = await callRoute(GET, 'GET', { query: { workspace_id: 'ws-other' } })
    expect(result.status).toBe(403)
    expect((result.data as { error: string }).error).toBe('无权限')
  })

  it('AT-S004: returns session list for valid workspace', async () => {
    const { GET } = await import('@/app/api/sessions/route')
    setupMockClient(createSupabaseChain())
    const result = await callRoute(GET, 'GET', { query: { workspace_id: 'ws-001' } })
    expect(result.status).toBe(200)
    expect(result.data).toBeInstanceOf(Array)
  })

  it('AT-S005: returns 403 when workspace not found (ownership check precedes DB query)', async () => {
    const { GET } = await import('@/app/api/sessions/route')
    // Sessions route checks workspace ownership first. The error chain returns null workspace
    // (no data), which triggers the 403 response before any sessions DB query executes.
    setupMockClient(createErrorChain())
    const result = await callRoute(GET, 'GET', { query: { workspace_id: 'ws-001' } })
    expect(result.status).toBe(403)
    expect((result.data as { error: string }).error).toBe('无权限')
  })
})

// ---------------------------------------------------------------------------
// POST /api/sessions
// ---------------------------------------------------------------------------

describe('POST /api/sessions', () => {
  beforeEach(() => {
    resetMockClient()
  })

  it('AT-S006: returns 401 when not authenticated', async () => {
    const { POST } = await import('@/app/api/sessions/route')
    setupMockClient(createNoAuthChain())
    const result = await callRoute(POST, 'POST', { body: { workspace_id: 'ws-001' } })
    expect(result.status).toBe(401)
    expect(result.data).toEqual({ error: '未授权' })
  })

  it('AT-S007: returns 400 when workspace_id is missing', async () => {
    const { POST } = await import('@/app/api/sessions/route')
    setupMockClient(createSupabaseChain())
    const result = await callRoute(POST, 'POST', { body: {} })
    expect(result.status).toBe(400)
    expect((result.data as { error: string }).error).toBe('缺少 workspace_id')
  })

  it('AT-S008: returns 403 when workspace does not belong to user', async () => {
    const { POST } = await import('@/app/api/sessions/route')
    setupMockClient(noWorkspaceChain())
    const result = await callRoute(POST, 'POST', {
      body: { workspace_id: 'ws-other', name: '新会话' },
    })
    expect(result.status).toBe(403)
    expect((result.data as { error: string }).error).toBe('工作区不存在或无权限')
  })

  it('AT-S009: returns 201 with created session on valid input', async () => {
    const { POST } = await import('@/app/api/sessions/route')
    setupMockClient(createSupabaseChain())
    const result = await callRoute(POST, 'POST', {
      body: { workspace_id: 'ws-001', name: '新会话' },
    })
    expect(result.status).toBe(201)
    const session = result.data as Record<string, unknown>
    expect(session.id).toBeTruthy()
    expect(session.workspace_id).toBe('ws-001')
    expect(session.name).toBe('新会话')
  })

  it('AT-S010: uses default name "新会话" when name not provided', async () => {
    const { POST } = await import('@/app/api/sessions/route')
    setupMockClient(createSupabaseChain())
    const result = await callRoute(POST, 'POST', {
      body: { workspace_id: 'ws-001' },
    })
    expect(result.status).toBe(201)
    const session = result.data as Record<string, unknown>
    expect(session.name).toBe('新会话')
  })

  it('AT-S011: returns 403 when workspace not found (ownership check precedes insert)', async () => {
    const { POST } = await import('@/app/api/sessions/route')
    // POST sessions checks workspace ownership before inserting. Error chain returns null workspace,
    // triggering 403 before the insert DB call would execute.
    setupMockClient(createErrorChain())
    const result = await callRoute(POST, 'POST', {
      body: { workspace_id: 'ws-001', name: '测试' },
    })
    expect(result.status).toBe(403)
    expect((result.data as { error: string }).error).toBe('工作区不存在或无权限')
  })
})

// ---------------------------------------------------------------------------
// GET /api/sessions/[id]
// ---------------------------------------------------------------------------

describe('GET /api/sessions/[id]', () => {
  beforeEach(() => {
    resetMockClient()
  })

  it('AT-S012: returns 401 when not authenticated', async () => {
    const { GET } = await import('@/app/api/sessions/[id]/route')
    setupMockClient(createNoAuthChain())
    const result = await callRoute(GET, 'GET', { params: { id: 'session-001' } })
    expect(result.status).toBe(401)
    expect(result.data).toEqual({ error: '未授权' })
  })

  it('AT-S013: returns 404 when session not found', async () => {
    const { GET } = await import('@/app/api/sessions/[id]/route')
    setupMockClient(createSupabaseChain(mockUser, [{ id: 'ws-001' }], []))
    const result = await callRoute(GET, 'GET', { params: { id: 'nonexistent' } })
    expect(result.status).toBe(404)
    expect((result.data as { error: string }).error).toBe('会话不存在')
  })

  it('AT-S014: returns 403 when session workspace is not owned by user', async () => {
    const { GET } = await import('@/app/api/sessions/[id]/route')
    setupMockClient(sessionWorkspaceNotOwnedChain())
    const result = await callRoute(GET, 'GET', { params: { id: 'session-001' } })
    expect(result.status).toBe(403)
    expect((result.data as { error: string }).error).toBe('无权限')
  })
})

// ---------------------------------------------------------------------------
// PATCH /api/sessions/[id]
// ---------------------------------------------------------------------------

describe('PATCH /api/sessions/[id]', () => {
  beforeEach(() => {
    resetMockClient()
  })

  it('AT-S015: returns 401 when not authenticated', async () => {
    const { PATCH } = await import('@/app/api/sessions/[id]/route')
    setupMockClient(createNoAuthChain())
    const result = await callRoute(PATCH, 'PATCH', {
      params: { id: 'session-001' },
      body: { name: '更新名称' },
    })
    expect(result.status).toBe(401)
    expect(result.data).toEqual({ error: '未授权' })
  })

  it('AT-S016: returns 400 for invalid status value', async () => {
    const { PATCH } = await import('@/app/api/sessions/[id]/route')
    setupMockClient(createSupabaseChain())
    const result = await callRoute(PATCH, 'PATCH', {
      params: { id: 'session-001' },
      body: { status: 'invalid-status' },
    })
    expect(result.status).toBe(400)
    expect((result.data as { error: string }).error).toBe('无效的会话状态')
  })

  it('AT-S017: returns 404 when session not found for update', async () => {
    const { PATCH } = await import('@/app/api/sessions/[id]/route')
    setupMockClient(createSupabaseChain(mockUser, [{ id: 'ws-001' }], []))
    const result = await callRoute(PATCH, 'PATCH', {
      params: { id: 'nonexistent' },
      body: { name: '测试' },
    })
    expect(result.status).toBe(404)
    expect((result.data as { error: string }).error).toBe('会话不存在')
  })

  it('AT-S018: returns 403 when session workspace is not owned by user', async () => {
    const { PATCH } = await import('@/app/api/sessions/[id]/route')
    setupMockClient(sessionWorkspaceNotOwnedChainForUpdate())
    const result = await callRoute(PATCH, 'PATCH', {
      params: { id: 'session-001' },
      body: { name: '更新名称' },
    })
    expect(result.status).toBe(403)
    expect((result.data as { error: string }).error).toBe('无权限')
  })

  it('AT-S019: returns updated session on valid PATCH with name', async () => {
    const { PATCH } = await import('@/app/api/sessions/[id]/route')
    setupMockClient(createSupabaseChain())
    const result = await callRoute(PATCH, 'PATCH', {
      params: { id: 'session-001' },
      body: { name: '更新后的会话' },
    })
    expect(result.status).toBe(200)
    const session = result.data as Record<string, unknown>
    expect(session.name).toBe('更新后的会话')
  })

  it('AT-S020: returns updated session on valid PATCH with status=active', async () => {
    const { PATCH } = await import('@/app/api/sessions/[id]/route')
    setupMockClient(createSupabaseChain())
    const result = await callRoute(PATCH, 'PATCH', {
      params: { id: 'session-001' },
      body: { status: 'active' },
    })
    expect(result.status).toBe(200)
    const session = result.data as Record<string, unknown>
    expect(session.status).toBe('active')
  })

  it('AT-S021: returns updated session on valid PATCH with status=archived', async () => {
    const { PATCH } = await import('@/app/api/sessions/[id]/route')
    setupMockClient(createSupabaseChain())
    const result = await callRoute(PATCH, 'PATCH', {
      params: { id: 'session-001' },
      body: { status: 'archived' },
    })
    expect(result.status).toBe(200)
    const session = result.data as Record<string, unknown>
    expect(session.status).toBe('archived')
  })

  it('AT-S022: returns 404 when session not found (lookup returns null from error chain)', async () => {
    const { PATCH } = await import('@/app/api/sessions/[id]/route')
    // Error chain returns data: null from sessions lookup, triggering 404 before update.
    setupMockClient(createErrorChain())
    const result = await callRoute(PATCH, 'PATCH', {
      params: { id: 'session-001' },
      body: { name: '测试' },
    })
    expect(result.status).toBe(404)
    expect((result.data as { error: string }).error).toBe('会话不存在')
  })
})
