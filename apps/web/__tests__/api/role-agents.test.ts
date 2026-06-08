/**
 * API route tests for /api/role-agents and /api/role-agents/[id]
 *
 * L0 unit tests: API route handlers with mocked Postgres client.
 * Tests auth checks, ownership checks, CRUD, and response shapes.
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
  mockUser,
  mockWorkspace,
} from '../utils'

// ---------------------------------------------------------------------------
// Helper
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

  const base = params ? `/api/role-agents/${params.id}` : '/api/role-agents'
  const url = new URL(base, 'http://localhost')
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
// GET /api/role-agents
// ---------------------------------------------------------------------------

describe('GET /api/role-agents', () => {
  beforeEach(() => {
    resetMockClient()
    resetMockAuth()
    setupMockAuth()
  })

  it('AT-A001: returns 401 when not authenticated', async () => {
    const { GET } = await import('@/app/api/role-agents/route')
    setupMockAuth(null)
    setupMockClient(createNoAuthChain())
    const result = await callRoute(GET, 'GET', { query: { workspace_id: 'ws-001' } })
    expect(result.status).toBe(401)
    expect(result.data).toEqual({ error: '未授权' })
  })

  it('AT-A002: returns 400 when workspace_id is missing', async () => {
    const { GET } = await import('@/app/api/role-agents/route')
    setupMockClient(createPostgresChain())
    const result = await callRoute(GET, 'GET', {})
    expect(result.status).toBe(400)
    expect((result.data as { error: string }).error).toBe('缺少 workspace_id')
  })

  it('AT-A003: returns agent list for authenticated user with workspace_id', async () => {
    const { GET } = await import('@/app/api/role-agents/route')
    setupMockClient(createPostgresChain())
    const result = await callRoute(GET, 'GET', { query: { workspace_id: 'ws-001' } })
    expect(result.status).toBe(200)
    expect(result.data).toBeInstanceOf(Array)
  })

  it('AT-A004: returns 403 when workspace not owned by user', async () => {
    const { GET } = await import('@/app/api/role-agents/route')
    setupMockClient(createErrorChain())
    const result = await callRoute(GET, 'GET', { query: { workspace_id: 'ws-001' } })
    expect(result.status).toBe(403)
  })
})

// ---------------------------------------------------------------------------
// POST /api/role-agents
// ---------------------------------------------------------------------------

describe('POST /api/role-agents', () => {
  beforeEach(() => {
    resetMockClient()
    resetMockAuth()
    setupMockAuth()
  })

  it('AT-A005: returns 401 when not authenticated', async () => {
    const { POST } = await import('@/app/api/role-agents/route')
    setupMockAuth(null)
    setupMockClient(createNoAuthChain())
    const result = await callRoute(POST, 'POST', {
      body: { workspace_id: 'ws-001', name: 'Test Agent', role_type: 'analyzer' },
    })
    expect(result.status).toBe(401)
    expect(result.data).toEqual({ error: '未授权' })
  })

  it('AT-A006: returns 400 when workspace_id is missing', async () => {
    const { POST } = await import('@/app/api/role-agents/route')
    setupMockClient(createPostgresChain())
    const result = await callRoute(POST, 'POST', { body: { name: 'Test Agent', role_type: 'analyzer' } })
    expect(result.status).toBe(400)
    expect((result.data as { error: string }).error).toBe('缺少 workspace_id')
  })

  it('AT-A007: returns 400 when name is missing', async () => {
    const { POST } = await import('@/app/api/role-agents/route')
    setupMockClient(createPostgresChain())
    const result = await callRoute(POST, 'POST', { body: { workspace_id: 'ws-001', role_type: 'analyzer' } })
    expect(result.status).toBe(400)
    expect((result.data as { error: string }).error).toBe('缺少 name')
  })

  it('AT-A008: returns 403 when workspace does not belong to user', async () => {
    const { POST } = await import('@/app/api/role-agents/route')
    setupMockClient(createErrorChain())
    const result = await callRoute(POST, 'POST', {
      body: { workspace_id: 'ws-001', name: 'Test Agent', role_type: 'analyzer' },
    })
    expect(result.status).toBe(403)
  })

  it('AT-A009: returns created agent on valid input', async () => {
    const { POST } = await import('@/app/api/role-agents/route')
    setupMockClient(createPostgresChain())
    const result = await callRoute(POST, 'POST', {
      body: { workspace_id: 'ws-001', name: 'Analyzer Agent', role_type: 'analyzer', system_prompt: 'You analyze things.', runtime_type: 'codex' },
    })
    expect(result.status).toBe(201)
    const agent = result.data as Record<string, unknown>
    expect(agent.id).toBeTruthy()
    expect(agent.name).toBe('Analyzer Agent')
    expect(agent.role_type).toBe('analyzer')
    expect(agent.runtime_type).toBe('codex')
    expect(agent.workspace_id).toBe('ws-001')
  })

  it('AT-A009a: rejects invalid runtime_type', async () => {
    const { POST } = await import('@/app/api/role-agents/route')
    setupMockClient(createPostgresChain())
    const result = await callRoute(POST, 'POST', {
      body: { workspace_id: 'ws-001', name: 'Analyzer Agent', runtime_type: 'runtime:codex' },
    })
    expect(result.status).toBe(400)
    expect((result.data as { error: string }).error).toBe('runtime_type 必须是 claude_code 或 codex')
  })

  it('AT-A009b: rejects legacy runtime capability tags on POST', async () => {
    const { POST } = await import('@/app/api/role-agents/route')
    setupMockClient(createPostgresChain())
    const result = await callRoute(POST, 'POST', {
      body: { workspace_id: 'ws-001', name: 'Analyzer Agent', capabilities: ['runtime:codex', 'api'] },
    })
    expect(result.status).toBe(400)
    expect((result.data as { error: string }).error).toBe('capabilities 已废弃，请使用 capability_tags')
  })

  it('AT-A010: returns 403 when workspace not owned on insert', async () => {
    const { POST } = await import('@/app/api/role-agents/route')
    setupMockClient(createErrorChain())
    const result = await callRoute(POST, 'POST', {
      body: { workspace_id: 'ws-001', name: 'Test Agent', role_type: 'analyzer' },
    })
    expect(result.status).toBe(403)
  })
})

// ---------------------------------------------------------------------------
// GET /api/role-agents/[id]
// ---------------------------------------------------------------------------

describe('GET /api/role-agents/[id]', () => {
  beforeEach(() => {
    resetMockClient()
    resetMockAuth()
    setupMockAuth()
  })

  it('AT-A011: returns 401 when not authenticated', async () => {
    const { GET } = await import('@/app/api/role-agents/[id]/route')
    setupMockAuth(null)
    setupMockClient(createNoAuthChain())
    const result = await callRoute(GET, 'GET', { params: { id: 'agent-001' } })
    expect(result.status).toBe(401)
    expect(result.data).toEqual({ error: '未授权' })
  })

  it('AT-A012: returns agent detail for valid id', async () => {
    const { GET } = await import('@/app/api/role-agents/[id]/route')
    setupMockClient(createPostgresChain())
    const result = await callRoute(GET, 'GET', { params: { id: 'agent-001' } })
    expect(result.status).toBe(200)
    const agent = result.data as Record<string, unknown>
    expect(agent.id).toBeTruthy()
  })

  it('AT-A013: returns 404 when agent not owned', async () => {
    const { GET } = await import('@/app/api/role-agents/[id]/route')
    setupMockClient(createErrorChain())
    const result = await callRoute(GET, 'GET', { params: { id: 'agent-001' } })
    expect(result.status).toBe(404)
  })
})

// ---------------------------------------------------------------------------
// PATCH /api/role-agents/[id]
// ---------------------------------------------------------------------------

describe('PATCH /api/role-agents/[id]', () => {
  beforeEach(() => {
    resetMockClient()
    resetMockAuth()
    setupMockAuth()
  })

  it('AT-A014: returns 401 when not authenticated', async () => {
    const { PATCH } = await import('@/app/api/role-agents/[id]/route')
    setupMockAuth(null)
    setupMockClient(createNoAuthChain())
    const result = await callRoute(PATCH, 'PATCH', {
      params: { id: 'agent-001' },
      body: { name: 'Updated Agent' },
    })
    expect(result.status).toBe(401)
    expect(result.data).toEqual({ error: '未授权' })
  })

  it('AT-A015: returns updated agent on valid PATCH', async () => {
    const { PATCH } = await import('@/app/api/role-agents/[id]/route')
    setupMockClient(createPostgresChain())
    const result = await callRoute(PATCH, 'PATCH', {
      params: { id: 'agent-001' },
      body: { name: 'Updated Agent Name', system_prompt: 'New prompt', runtime_type: 'codex' },
    })
    expect(result.status).toBe(200)
    const agent = result.data as Record<string, unknown>
    expect(agent.name).toBe('Updated Agent Name')
    expect(agent.system_prompt).toBe('New prompt')
    expect(agent.runtime_type).toBe('codex')
  })

  it('AT-A015a: rejects invalid runtime_type on PATCH', async () => {
    const { PATCH } = await import('@/app/api/role-agents/[id]/route')
    setupMockClient(createPostgresChain())
    const result = await callRoute(PATCH, 'PATCH', {
      params: { id: 'agent-001' },
      body: { runtime_type: 'hosted' },
    })
    expect(result.status).toBe(400)
    expect((result.data as { error: string }).error).toBe('runtime_type 必须是 claude_code 或 codex')
  })

  it('AT-A015b: rejects legacy runtime capability tags on PATCH', async () => {
    const { PATCH } = await import('@/app/api/role-agents/[id]/route')
    setupMockClient(createPostgresChain())
    const result = await callRoute(PATCH, 'PATCH', {
      params: { id: 'agent-001' },
      body: { capabilities: ['runtime:claude_code', 'review'] },
    })
    expect(result.status).toBe(400)
    expect((result.data as { error: string }).error).toBe('capabilities 已废弃，请使用 capability_tags')
  })

  it('AT-A016: returns 404 when agent not owned on update', async () => {
    const { PATCH } = await import('@/app/api/role-agents/[id]/route')
    setupMockClient(createErrorChain())
    const result = await callRoute(PATCH, 'PATCH', {
      params: { id: 'agent-001' },
      body: { name: 'Updated' },
    })
    expect(result.status).toBe(404)
  })
})

// ---------------------------------------------------------------------------
// DELETE /api/role-agents/[id]
// ---------------------------------------------------------------------------

describe('DELETE /api/role-agents/[id]', () => {
  beforeEach(() => {
    resetMockClient()
    resetMockAuth()
    setupMockAuth()
  })

  it('AT-A017: returns 401 when not authenticated', async () => {
    const { DELETE } = await import('@/app/api/role-agents/[id]/route')
    setupMockAuth(null)
    setupMockClient(createNoAuthChain())
    const result = await callRoute(DELETE, 'DELETE', { params: { id: 'agent-001' } })
    expect(result.status).toBe(401)
    expect(result.data).toEqual({ error: '未授权' })
  })

  it('AT-A018: returns 200 on successful delete', async () => {
    const { DELETE } = await import('@/app/api/role-agents/[id]/route')
    setupMockClient(createPostgresChain())
    const result = await callRoute(DELETE, 'DELETE', { params: { id: 'agent-001' } })
    expect(result.status).toBe(200)
    expect(result.data).toEqual({ success: true })
  })

  it('AT-A019: returns 404 when agent not owned on delete', async () => {
    const { DELETE } = await import('@/app/api/role-agents/[id]/route')
    setupMockClient(createErrorChain())
    const result = await callRoute(DELETE, 'DELETE', { params: { id: 'agent-001' } })
    expect(result.status).toBe(404)
  })
})
