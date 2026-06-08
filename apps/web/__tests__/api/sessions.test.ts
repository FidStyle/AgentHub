/**
 * API route tests for /api/sessions and /api/sessions/[id]
 *
 * L0 unit tests: API route handlers with mocked Postgres client.
 * Tests auth checks, input validation, ownership checks, and response shapes.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  setupMockClient,
  setupMockAuth,
  createPostgresChain,
  createNoAuthChain,
  createErrorChain,
  resetMockClient,
  resetMockAuth,
  mockUser,
} from '../utils'

// ---------------------------------------------------------------------------
// Helper: call a route handler and extract status + body
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function callRoute<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: any,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
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
  } else if (method === 'PATCH') {
    request = new Request(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    })
  } else {
    request = new Request(url, { method: 'DELETE' })
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
  const noWorkspaceQuery = {
    eq: () => noWorkspaceQuery,
    single: () => ({ data: null, error: { message: 'Not found' } }),
  }

  return vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'workspaces') {
        return {
          select: () => noWorkspaceQuery,
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
        select: () => ({ eq: () => ({ eq: () => ({ single: () => ({ data: null, error: null }) }) }) }),
      }
    }),
  }))
}

/** GET sessions/[id]: session found but workspace not owned by user */
function sessionWorkspaceNotOwnedChain() {
  const notOwnedWorkspaceQuery = {
    eq: () => notOwnedWorkspaceQuery,
    single: () => ({ data: null, error: { message: 'Not found' } }),
  }

  return vi.fn(() => ({
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
      if (table === 'workspaces') {
        return {
          select: () => notOwnedWorkspaceQuery,
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
  const notOwnedWorkspaceQuery = {
    eq: () => notOwnedWorkspaceQuery,
    single: () => ({ data: null, error: { message: 'Not found' } }),
  }

  const updateQuery = {
    eq: () => updateQuery,
    select: () => ({
      single: () => ({ data: null, error: { message: 'Not called' } }),
    }),
  }

  return vi.fn(() => ({
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
          update: () => updateQuery,
        }
      }
      if (table === 'workspaces') {
        return {
          select: () => notOwnedWorkspaceQuery,
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
    resetMockAuth()
    setupMockAuth()
  })

  it('AT-S001: returns 401 when not authenticated', async () => {
    const { GET } = await import('@/app/api/sessions/route')
    setupMockAuth(null)
    setupMockClient(createNoAuthChain())
    const result = await callRoute(GET, 'GET', { query: { workspace_id: 'ws-001' } })
    expect(result.status).toBe(401)
    expect(result.data).toEqual({ error: '未授权' })
  })

  it('AT-S002: returns 400 when workspace_id is missing', async () => {
    const { GET } = await import('@/app/api/sessions/route')
    setupMockClient(createPostgresChain())
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
    setupMockClient(createPostgresChain())
    const result = await callRoute(GET, 'GET', { query: { workspace_id: 'ws-001' } })
    expect(result.status).toBe(200)
    expect(result.data).toBeInstanceOf(Array)
  })

  it('AT-S004b: includes latest message summary for the session list', async () => {
    const { GET } = await import('@/app/api/sessions/route')
    setupMockClient(createPostgresChain(
      mockUser,
      undefined,
      undefined,
      [{ id: 'msg-latest', session_id: 'session-001', content: '最新会话摘要', sender_type: 'agent', created_at: '2026-01-02T00:00:00.000Z' }],
    ))
    const result = await callRoute(GET, 'GET', { query: { workspace_id: 'ws-001' } })
    expect(result.status).toBe(200)
    const sessions = result.data as Array<Record<string, unknown>>
    expect(sessions[0].last_message).toBe('最新会话摘要')
    expect(sessions[0].last_message_sender_type).toBe('agent')
    expect(sessions[0].last_message_at).toBe('2026-01-02T00:00:00.000Z')
  })

  it('AT-S004c: hides archived sessions by default and can list archived sessions', async () => {
    const { GET } = await import('@/app/api/sessions/route')
    setupMockClient(createPostgresChain(
      mockUser,
      undefined,
      [
        { id: 'session-active', workspace_id: 'ws-001', name: '活跃会话', status: 'active', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
        { id: 'session-archived', workspace_id: 'ws-001', name: '归档会话', status: 'archived', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z' },
      ],
      [],
    ))

    const activeResult = await callRoute(GET, 'GET', { query: { workspace_id: 'ws-001' } })
    expect(activeResult.status).toBe(200)
    expect((activeResult.data as Array<Record<string, unknown>>).map((session) => session.id)).toEqual(['session-active'])

    const archivedResult = await callRoute(GET, 'GET', { query: { workspace_id: 'ws-001', status: 'archived' } })
    expect(archivedResult.status).toBe(200)
    expect((archivedResult.data as Array<Record<string, unknown>>).map((session) => session.id)).toEqual(['session-archived'])
  })

  it('AT-S004d: returns 400 for invalid status filter', async () => {
    const { GET } = await import('@/app/api/sessions/route')
    setupMockClient(createPostgresChain())
    const result = await callRoute(GET, 'GET', { query: { workspace_id: 'ws-001', status: 'deleted' } })
    expect(result.status).toBe(400)
    expect((result.data as { error: string }).error).toBe('无效的会话状态')
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
    resetMockAuth()
    setupMockAuth()
  })

  it('AT-S006: returns 401 when not authenticated', async () => {
    const { POST } = await import('@/app/api/sessions/route')
    setupMockAuth(null)
    setupMockClient(createNoAuthChain())
    const result = await callRoute(POST, 'POST', { body: { workspace_id: 'ws-001' } })
    expect(result.status).toBe(401)
    expect(result.data).toEqual({ error: '未授权' })
  })

  it('AT-S007: returns 400 when workspace_id is missing', async () => {
    const { POST } = await import('@/app/api/sessions/route')
    setupMockClient(createPostgresChain())
    const result = await callRoute(POST, 'POST', { body: {} })
    expect(result.status).toBe(400)
    expect((result.data as { error: string }).error).toBe('缺少 workspace_id')
  })

  it('AT-S008: returns 403 when workspace does not belong to user', async () => {
    const { POST } = await import('@/app/api/sessions/route')
    setupMockClient(noWorkspaceChain())
    const result = await callRoute(POST, 'POST', {
      body: { workspace_id: 'ws-other', name: '新聊天' },
    })
    expect(result.status).toBe(403)
    expect((result.data as { error: string }).error).toBe('工作区不存在或无权限')
  })

  it('AT-S009: returns 201 with created session on valid input', async () => {
    const { POST } = await import('@/app/api/sessions/route')
    setupMockClient(createPostgresChain())
    const result = await callRoute(POST, 'POST', {
      body: { workspace_id: 'ws-001', name: '新聊天' },
    })
    expect(result.status).toBe(201)
    const session = result.data as Record<string, unknown>
    expect(session.id).toBeTruthy()
    expect(session.workspace_id).toBe('ws-001')
    expect(session.name).toBe('新聊天')
  })

  it('AT-S010: uses default name "新聊天" when name not provided', async () => {
    const { POST } = await import('@/app/api/sessions/route')
    setupMockClient(createPostgresChain())
    const result = await callRoute(POST, 'POST', {
      body: { workspace_id: 'ws-001' },
    })
    expect(result.status).toBe(201)
    const session = result.data as Record<string, unknown>
    expect(session.name).toBe('新聊天')
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
    resetMockAuth()
    setupMockAuth()
  })

  it('AT-S012: returns 401 when not authenticated', async () => {
    const { GET } = await import('@/app/api/sessions/[id]/route')
    setupMockAuth(null)
    setupMockClient(createNoAuthChain())
    const result = await callRoute(GET, 'GET', { params: { id: 'session-001' } })
    expect(result.status).toBe(401)
    expect(result.data).toEqual({ error: '未授权' })
  })

  it('AT-S013: returns 404 when session not found', async () => {
    const { GET } = await import('@/app/api/sessions/[id]/route')
    setupMockClient(createPostgresChain(mockUser, [{ id: 'ws-001' }], []))
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
    resetMockAuth()
    setupMockAuth()
  })

  it('AT-S015: returns 401 when not authenticated', async () => {
    const { PATCH } = await import('@/app/api/sessions/[id]/route')
    setupMockAuth(null)
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
    setupMockClient(createPostgresChain())
    const result = await callRoute(PATCH, 'PATCH', {
      params: { id: 'session-001' },
      body: { status: 'invalid-status' },
    })
    expect(result.status).toBe(400)
    expect((result.data as { error: string }).error).toBe('无效的会话状态')
  })

  it('AT-S017: returns 404 when session not found for update', async () => {
    const { PATCH } = await import('@/app/api/sessions/[id]/route')
    setupMockClient(createPostgresChain(mockUser, [{ id: 'ws-001' }], []))
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
    setupMockClient(createPostgresChain())
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
    setupMockClient(createPostgresChain())
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
    setupMockClient(createPostgresChain())
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

// ---------------------------------------------------------------------------
// DELETE /api/sessions/[id]
// ---------------------------------------------------------------------------

describe('DELETE /api/sessions/[id]', () => {
  beforeEach(() => {
    resetMockClient()
    resetMockAuth()
    setupMockAuth()
  })

  it('AT-S023: returns 401 when not authenticated', async () => {
    const { DELETE } = await import('@/app/api/sessions/[id]/route')
    setupMockAuth(null)
    setupMockClient(createNoAuthChain())
    const result = await callRoute(DELETE, 'DELETE', { params: { id: 'session-001' } })
    expect(result.status).toBe(401)
    expect(result.data).toEqual({ error: '未授权' })
  })

  it('AT-S024: returns 404 when session not found for delete', async () => {
    const { DELETE } = await import('@/app/api/sessions/[id]/route')
    setupMockClient(createPostgresChain(mockUser, [{ id: 'ws-001' }], []))
    const result = await callRoute(DELETE, 'DELETE', { params: { id: 'nonexistent' } })
    expect(result.status).toBe(404)
    expect((result.data as { error: string }).error).toBe('会话不存在')
  })

  it('AT-S025: returns 403 when session workspace is not owned by user', async () => {
    const { DELETE } = await import('@/app/api/sessions/[id]/route')
    setupMockClient(sessionWorkspaceNotOwnedChainForUpdate())
    const result = await callRoute(DELETE, 'DELETE', { params: { id: 'session-001' } })
    expect(result.status).toBe(403)
    expect((result.data as { error: string }).error).toBe('无权限')
  })

  it('AT-S026: deletes an owned session', async () => {
    const { DELETE } = await import('@/app/api/sessions/[id]/route')
    setupMockClient(createPostgresChain())
    const result = await callRoute(DELETE, 'DELETE', { params: { id: 'session-001' } })
    expect(result.status).toBe(200)
    expect(result.data).toEqual({ ok: true })
  })
})
