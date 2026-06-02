/**
 * API route tests for /api/workspaces and /api/workspaces/[id]
 *
 * L0 unit tests: API route handlers with mocked Postgres client.
 * Tests auth checks, input validation, business logic, and response shapes.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  setupMockAuth,
  resetMockAuth,
  setupMockClient,
  createPostgresChain,
  createNoAuthChain,
  createErrorChain,
  resetMockClient,
  mockWorkspace,
} from '../utils'

const { removeCloudWorkspaceProjectMock } = vi.hoisted(() => ({
  removeCloudWorkspaceProjectMock: vi.fn(async (_owner: unknown, _workspace: unknown) => undefined),
}))

vi.mock('@/lib/workspace/cloud-workspace-fs', () => ({
  ensureCloudWorkspaceProject: vi.fn(async () => '/tmp/agenthub/ws-new'),
  removeCloudWorkspaceProject: (owner: unknown, workspace: unknown) => removeCloudWorkspaceProjectMock(owner, workspace),
}))

function createDeleteErrorChain() {
  return vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'workspaces') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () => ({ data: mockWorkspace, error: null }),
              }),
            }),
          }),
          delete: () => ({
            eq: () => ({
              eq: () => ({ data: null, error: { message: 'Database error' } }),
            }),
          }),
        }
      }
      return {
        select: () => ({
          eq: () => ({
            single: () => ({ data: null, error: null }),
          }),
        }),
      }
    }),
  }))
}

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
  } = {},
): Promise<{ status: number; data: unknown }> {
  const { body, params } = options

  const url = new URL(
    params ? `/api/workspaces/${params.id}` : '/api/workspaces',
    'http://localhost',
  )

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
// GET /api/workspaces
// ---------------------------------------------------------------------------

describe('GET /api/workspaces', () => {
  beforeEach(() => {
    process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://unit-test'
    resetMockClient()
    resetMockAuth()
    removeCloudWorkspaceProjectMock.mockClear()
    setupMockAuth()
  })

  it('AT-W001: returns 401 when not authenticated', async () => {
    const { GET } = await import('@/app/api/workspaces/route')
    setupMockAuth(null)
    setupMockClient(createNoAuthChain())
    const result = await callRoute(GET, 'GET', {})
    expect(result.status).toBe(401)
    expect(result.data).toEqual({ error: '未授权' })
  })

  it('AT-W002: returns workspace list for authenticated user', async () => {
    const { GET } = await import('@/app/api/workspaces/route')
    setupMockClient(createPostgresChain())
    const result = await callRoute(GET, 'GET', {})
    expect(result.status).toBe(200)
    expect(result.data).toBeInstanceOf(Array)
  })

  it('AT-W003: returns 500 on database error', async () => {
    const { GET } = await import('@/app/api/workspaces/route')
    setupMockClient(createErrorChain())
    const result = await callRoute(GET, 'GET', {})
    expect(result.status).toBe(500)
    expect((result.data as { error: string }).error).toBe('Database error')
  })
})

// ---------------------------------------------------------------------------
// POST /api/workspaces
// ---------------------------------------------------------------------------

describe('POST /api/workspaces', () => {
  beforeEach(() => {
    process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://unit-test'
    resetMockClient()
    resetMockAuth()
    setupMockAuth()
  })

  it('AT-W004: returns 401 when not authenticated', async () => {
    const { POST } = await import('@/app/api/workspaces/route')
    setupMockAuth(null)
    setupMockClient(createNoAuthChain())
    const result = await callRoute(POST, 'POST', {
      body: { name: 'Test', execution_domain: 'cloud' },
    })
    expect(result.status).toBe(401)
    expect(result.data).toEqual({ error: '未授权' })
  })

  it('AT-W005: returns 400 when name is missing', async () => {
    const { POST } = await import('@/app/api/workspaces/route')
    setupMockClient(createPostgresChain())
    const result = await callRoute(POST, 'POST', {
      body: { execution_domain: 'cloud' },
    })
    expect(result.status).toBe(400)
    expect((result.data as { error: string }).error).toBe('名称和执行域为必填项')
  })

  it('AT-W006: returns 400 when execution_domain is missing', async () => {
    const { POST } = await import('@/app/api/workspaces/route')
    setupMockClient(createPostgresChain())
    const result = await callRoute(POST, 'POST', {
      body: { name: '测试工作区' },
    })
    expect(result.status).toBe(400)
    expect((result.data as { error: string }).error).toBe('名称和执行域为必填项')
  })

  it('AT-W007: returns 400 for invalid execution_domain', async () => {
    const { POST } = await import('@/app/api/workspaces/route')
    setupMockClient(createPostgresChain())
    const result = await callRoute(POST, 'POST', {
      body: { name: '测试', execution_domain: 'invalid' },
    })
    expect(result.status).toBe(400)
    expect((result.data as { error: string }).error).toBe('执行域必须为 cloud 或 local_desktop')
  })

  it('AT-W008: returns 201 with created workspace on valid input', async () => {
    const { POST } = await import('@/app/api/workspaces/route')
    setupMockClient(createPostgresChain())
    const result = await callRoute(POST, 'POST', {
      body: { name: '新工作区', execution_domain: 'cloud', description: '描述' },
    })
    expect(result.status).toBe(201)
    const ws = result.data as Record<string, unknown>
    expect(ws.name).toBe('新工作区')
    expect(ws.execution_domain).toBe('cloud')
    expect(ws.id).toBeTruthy()
  })

  it('AT-W009: returns 500 on database error during insert', async () => {
    const { POST } = await import('@/app/api/workspaces/route')
    setupMockClient(createErrorChain())
    const result = await callRoute(POST, 'POST', {
      body: { name: '测试', execution_domain: 'cloud' },
    })
    expect(result.status).toBe(500)
    expect((result.data as { error: string }).error).toBe('Database error')
  })
})

// ---------------------------------------------------------------------------
// GET /api/workspaces/[id]
// ---------------------------------------------------------------------------

describe('GET /api/workspaces/[id]', () => {
  beforeEach(() => {
    resetMockClient()
    resetMockAuth()
    removeCloudWorkspaceProjectMock.mockClear()
    setupMockAuth()
  })

  it('AT-W010: returns 401 when not authenticated', async () => {
    const { GET } = await import('@/app/api/workspaces/[id]/route')
    setupMockAuth(null)
    setupMockClient(createNoAuthChain())
    const result = await callRoute(GET, 'GET', { params: { id: 'ws-001' } })
    expect(result.status).toBe(401)
    expect(result.data).toEqual({ error: '未授权' })
  })

  it('AT-W011: returns workspace detail for valid workspace', async () => {
    const { GET } = await import('@/app/api/workspaces/[id]/route')
    setupMockClient(createPostgresChain())
    const result = await callRoute(GET, 'GET', { params: { id: 'ws-001' } })
    expect(result.status).toBe(200)
    const ws = result.data as Record<string, unknown>
    expect(ws.id).toBeTruthy()
  })

  it('AT-W012: returns 404 when workspace not found', async () => {
    const { GET } = await import('@/app/api/workspaces/[id]/route')
    setupMockClient(createPostgresChain(undefined, []))
    const result = await callRoute(GET, 'GET', { params: { id: 'nonexistent' } })
    expect(result.status).toBe(404)
    expect((result.data as { error: string }).error).toBe('工作区不存在')
  })
})

// ---------------------------------------------------------------------------
// PATCH /api/workspaces/[id]
// ---------------------------------------------------------------------------

describe('PATCH /api/workspaces/[id]', () => {
  beforeEach(() => {
    resetMockClient()
    resetMockAuth()
    removeCloudWorkspaceProjectMock.mockClear()
    setupMockAuth()
  })

  it('AT-W013: returns 401 when not authenticated', async () => {
    const { PATCH } = await import('@/app/api/workspaces/[id]/route')
    setupMockAuth(null)
    setupMockClient(createNoAuthChain())
    const result = await callRoute(PATCH, 'PATCH', {
      params: { id: 'ws-001' },
      body: { name: '新名称' },
    })
    expect(result.status).toBe(401)
    expect(result.data).toEqual({ error: '未授权' })
  })

  it('AT-W014: returns 400 when name is empty string', async () => {
    const { PATCH } = await import('@/app/api/workspaces/[id]/route')
    setupMockClient(createPostgresChain())
    const result = await callRoute(PATCH, 'PATCH', {
      params: { id: 'ws-001' },
      body: { name: '' },
    })
    expect(result.status).toBe(400)
    expect((result.data as { error: string }).error).toBe('名称不能为空')
  })

  it('AT-W015: returns 400 when name exceeds 200 characters', async () => {
    const { PATCH } = await import('@/app/api/workspaces/[id]/route')
    setupMockClient(createPostgresChain())
    const result = await callRoute(PATCH, 'PATCH', {
      params: { id: 'ws-001' },
      body: { name: 'a'.repeat(201) },
    })
    expect(result.status).toBe(400)
    expect((result.data as { error: string }).error).toBe('名称不能超过 200 字符')
  })

  it('AT-W016: returns updated workspace on valid PATCH', async () => {
    const { PATCH } = await import('@/app/api/workspaces/[id]/route')
    setupMockClient(createPostgresChain())
    const result = await callRoute(PATCH, 'PATCH', {
      params: { id: 'ws-001' },
      body: { name: '更新后的名称' },
    })
    expect(result.status).toBe(200)
    const ws = result.data as Record<string, unknown>
    expect(ws.name).toBe('更新后的名称')
  })

  it('AT-W017: returns 500 on database error during update', async () => {
    const { PATCH } = await import('@/app/api/workspaces/[id]/route')
    setupMockClient(createErrorChain())
    const result = await callRoute(PATCH, 'PATCH', {
      params: { id: 'ws-001' },
      body: { name: '新名称' },
    })
    expect(result.status).toBe(500)
    expect((result.data as { error: string }).error).toBe('Database error')
  })
})

// ---------------------------------------------------------------------------
// DELETE /api/workspaces/[id]
// ---------------------------------------------------------------------------

describe('DELETE /api/workspaces/[id]', () => {
  beforeEach(() => {
    resetMockClient()
    resetMockAuth()
    removeCloudWorkspaceProjectMock.mockClear()
    setupMockAuth()
  })

  it('AT-W018: returns 401 when not authenticated', async () => {
    const { DELETE } = await import('@/app/api/workspaces/[id]/route')
    setupMockAuth(null)
    setupMockClient(createNoAuthChain())
    const result = await callRoute(DELETE, 'DELETE', { params: { id: 'ws-001' } })
    expect(result.status).toBe(401)
    expect(result.data).toEqual({ error: '未授权' })
  })

  it('AT-W019: deletes owned workspace and removes cloud project', async () => {
    const { DELETE } = await import('@/app/api/workspaces/[id]/route')
    setupMockClient(createPostgresChain())
    const result = await callRoute(DELETE, 'DELETE', { params: { id: 'ws-001' } })
    expect(result.status).toBe(200)
    expect(result.data).toEqual({ ok: true })
    expect(removeCloudWorkspaceProjectMock).toHaveBeenCalledTimes(1)
  })

  it('AT-W020: returns 404 when workspace is not found or not owned', async () => {
    const { DELETE } = await import('@/app/api/workspaces/[id]/route')
    setupMockClient(createPostgresChain(undefined, []))
    const result = await callRoute(DELETE, 'DELETE', { params: { id: 'missing-ws' } })
    expect(result.status).toBe(404)
    expect((result.data as { error: string }).error).toBe('工作区不存在')
    expect(removeCloudWorkspaceProjectMock).not.toHaveBeenCalled()
  })

  it('AT-W021: returns 500 on database error during delete', async () => {
    const { DELETE } = await import('@/app/api/workspaces/[id]/route')
    setupMockClient(createDeleteErrorChain())
    const result = await callRoute(DELETE, 'DELETE', { params: { id: 'ws-001' } })
    expect(result.status).toBe(500)
    expect((result.data as { error: string }).error).toBe('Database error')
    expect(removeCloudWorkspaceProjectMock).not.toHaveBeenCalled()
  })
})
