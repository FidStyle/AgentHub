/**
 * API route tests for /api/messages and /api/messages/[id]
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
  mockSession,
} from '../utils'

// ---------------------------------------------------------------------------
// Helper
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
    params ? `/api/messages/${params.id}` : '/api/messages',
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
// GET /api/messages
// ---------------------------------------------------------------------------

describe('GET /api/messages', () => {
  beforeEach(() => {
    resetMockClient()
    resetMockAuth()
    setupMockAuth()
  })

  it('AT-M001: returns 401 when not authenticated', async () => {
    const { GET } = await import('@/app/api/messages/route')
    setupMockAuth(null)
    setupMockClient(createNoAuthChain())
    const result = await callRoute(GET, 'GET', { query: { session_id: 'session-001' } })
    expect(result.status).toBe(401)
    expect(result.data).toEqual({ error: '未授权' })
  })

  it('AT-M002: returns 400 when session_id is missing', async () => {
    const { GET } = await import('@/app/api/messages/route')
    setupMockClient(createPostgresChain())
    const result = await callRoute(GET, 'GET', {})
    expect(result.status).toBe(400)
    expect((result.data as { error: string }).error).toBe('Missing session_id')
  })

  it('AT-M003: returns 404 when session not found', async () => {
    const { GET } = await import('@/app/api/messages/route')
    setupMockClient(createErrorChain())
    const result = await callRoute(GET, 'GET', { query: { session_id: 'session-001' } })
    expect(result.status).toBe(404)
    expect((result.data as { error: string }).error).toBe('Not found')
  })

  it('AT-M004: returns message list for valid session', async () => {
    const { GET } = await import('@/app/api/messages/route')
    setupMockClient(createPostgresChain())
    const result = await callRoute(GET, 'GET', { query: { session_id: 'session-001' } })
    expect(result.status).toBe(200)
    expect(result.data).toBeInstanceOf(Array)
  })

  it('AT-M005: returns 404 when session not found on DB error', async () => {
    const { GET } = await import('@/app/api/messages/route')
    setupMockClient(createErrorChain())
    const result = await callRoute(GET, 'GET', { query: { session_id: 'session-001' } })
    expect(result.status).toBe(404)
  })
})

// ---------------------------------------------------------------------------
// POST /api/messages
// ---------------------------------------------------------------------------

describe('POST /api/messages', () => {
  beforeEach(() => {
    resetMockClient()
    resetMockAuth()
    setupMockAuth()
  })

  it('AT-M006: returns 401 when not authenticated', async () => {
    const { POST } = await import('@/app/api/messages/route')
    setupMockAuth(null)
    setupMockClient(createNoAuthChain())
    const result = await callRoute(POST, 'POST', {
      body: { session_id: 'session-001', content: 'Hello' },
    })
    expect(result.status).toBe(401)
    expect(result.data).toEqual({ error: '未授权' })
  })

  it('AT-M007: returns 400 when session_id is missing', async () => {
    const { POST } = await import('@/app/api/messages/route')
    setupMockClient(createPostgresChain())
    const result = await callRoute(POST, 'POST', { body: { content: 'Hello' } })
    expect(result.status).toBe(400)
    expect((result.data as { error: string }).error).toBe('Missing session_id or content')
  })

  it('AT-M008: returns 400 when content is missing', async () => {
    const { POST } = await import('@/app/api/messages/route')
    setupMockClient(createPostgresChain())
    const result = await callRoute(POST, 'POST', { body: { session_id: 'session-001' } })
    expect(result.status).toBe(400)
    expect((result.data as { error: string }).error).toBe('Missing session_id or content')
  })

  it('AT-M009: returns 404 when session not found', async () => {
    const { POST } = await import('@/app/api/messages/route')
    setupMockClient(createErrorChain())
    const result = await callRoute(POST, 'POST', {
      body: { session_id: 'session-001', content: 'Hello' },
    })
    expect(result.status).toBe(404)
  })

  it('AT-M010: returns created message on valid input', async () => {
    const { POST } = await import('@/app/api/messages/route')
    setupMockClient(createPostgresChain())
    const result = await callRoute(POST, 'POST', {
      body: { session_id: 'session-001', content: 'Hello world' },
    })
    expect(result.status).toBe(201)
    const msg = result.data as Record<string, unknown>
    expect(msg.id).toBeTruthy()
    expect(msg.session_id).toBe('session-001')
    expect(msg.content).toBe('Hello world')
    expect(msg.sender_type).toBe('user')
    expect(msg.message_type).toBe('text')
    expect(msg.is_pinned).toBe(false)
  })

  it('AT-M011: returns 404 when session not found on insert', async () => {
    const { POST } = await import('@/app/api/messages/route')
    setupMockClient(createErrorChain())
    const result = await callRoute(POST, 'POST', {
      body: { session_id: 'session-001', content: 'Hello' },
    })
    expect(result.status).toBe(404)
  })
})

// ---------------------------------------------------------------------------
// PATCH /api/messages/[id]
// ---------------------------------------------------------------------------

describe('PATCH /api/messages/[id]', () => {
  beforeEach(() => {
    resetMockClient()
    resetMockAuth()
    setupMockAuth()
  })

  it('AT-M012: returns 401 when not authenticated', async () => {
    const { PATCH } = await import('@/app/api/messages/[id]/route')
    setupMockAuth(null)
    setupMockClient(createNoAuthChain())
    const result = await callRoute(PATCH, 'PATCH', {
      params: { id: 'msg-001' },
      body: { is_pinned: true },
    })
    expect(result.status).toBe(401)
    expect(result.data).toEqual({ error: '未授权' })
  })

  it('AT-M013: returns 404 when message not found', async () => {
    const { PATCH } = await import('@/app/api/messages/[id]/route')
    setupMockClient(createErrorChain())
    const result = await callRoute(PATCH, 'PATCH', {
      params: { id: 'msg-001' },
      body: { is_pinned: true },
    })
    expect(result.status).toBe(404)
  })

  it('AT-M014: returns updated message with is_pinned on valid PATCH', async () => {
    const { PATCH } = await import('@/app/api/messages/[id]/route')
    setupMockClient(createPostgresChain())
    const result = await callRoute(PATCH, 'PATCH', {
      params: { id: 'msg-001' },
      body: { is_pinned: true },
    })
    expect(result.status).toBe(200)
    const msg = result.data as Record<string, unknown>
    expect(msg.id).toBeTruthy()
    expect(msg.is_pinned).toBe(true)
  })

  it('AT-M014a: rejects unsupported PATCH fields instead of empty update', async () => {
    const { PATCH } = await import('@/app/api/messages/[id]/route')
    setupMockClient(createPostgresChain())
    const result = await callRoute(PATCH, 'PATCH', {
      params: { id: 'msg-001' },
      body: { content: 'should not update through this route' },
    })
    expect(result.status).toBe(400)
    expect((result.data as { error: string }).error).toBe('No supported fields to update')
  })

  it('AT-M014b: rejects non-boolean is_pinned values', async () => {
    const { PATCH } = await import('@/app/api/messages/[id]/route')
    setupMockClient(createPostgresChain())
    const result = await callRoute(PATCH, 'PATCH', {
      params: { id: 'msg-001' },
      body: { is_pinned: 'yes' },
    })
    expect(result.status).toBe(400)
    expect((result.data as { error: string }).error).toBe('is_pinned must be boolean')
  })

  it('AT-M015: returns 404 when message not found on update', async () => {
    const { PATCH } = await import('@/app/api/messages/[id]/route')
    setupMockClient(createErrorChain())
    const result = await callRoute(PATCH, 'PATCH', {
      params: { id: 'msg-001' },
      body: { is_pinned: true },
    })
    expect(result.status).toBe(404)
  })
})
