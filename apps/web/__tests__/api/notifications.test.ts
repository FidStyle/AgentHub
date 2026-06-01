import { beforeEach, describe, expect, it } from 'vitest'
import {
  createErrorChain,
  createNoAuthChain,
  createPostgresChain,
  resetMockAuth,
  resetMockClient,
  setupMockAuth,
  setupMockClient,
} from '../utils'

async function callRoute(
  handler: (request: Request) => Promise<Response>,
  method: 'GET' | 'PATCH',
  options: { body?: unknown; query?: Record<string, string> } = {},
) {
  const url = new URL('/api/notifications', 'http://localhost')
  for (const [key, value] of Object.entries(options.query ?? {})) {
    url.searchParams.set(key, value)
  }
  const request = new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: method === 'PATCH' ? JSON.stringify(options.body ?? {}) : undefined,
  })
  const response = await handler(request)
  return { status: response.status, data: await response.json() }
}

describe('/api/notifications', () => {
  beforeEach(() => {
    resetMockClient()
    resetMockAuth()
    setupMockAuth()
  })

  it('lists unread user notifications through the real route contract', async () => {
    const { GET } = await import('@/app/api/notifications/route')
    setupMockClient(createPostgresChain())

    const result = await callRoute(GET, 'GET', { query: { unread: 'true' } })

    expect(result.status).toBe(200)
    expect(result.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'notification-001', type: 'approval_required', read: false }),
    ]))
  })

  it('rejects unauthenticated notification access', async () => {
    const { GET } = await import('@/app/api/notifications/route')
    setupMockAuth(null)
    setupMockClient(createNoAuthChain())

    const result = await callRoute(GET, 'GET')

    expect(result.status).toBe(401)
  })

  it('validates mark-read ids as a non-empty string array', async () => {
    const { PATCH } = await import('@/app/api/notifications/route')
    setupMockClient(createPostgresChain())

    const result = await callRoute(PATCH, 'PATCH', { body: { ids: 'notification-001' } })

    expect(result.status).toBe(400)
    expect((result.data as { error: string }).error).toBe('ids 必须是非空字符串数组')
  })

  it('marks notifications read only after auth and DB success', async () => {
    const { PATCH } = await import('@/app/api/notifications/route')
    setupMockClient(createPostgresChain())

    const result = await callRoute(PATCH, 'PATCH', { body: { ids: ['notification-001'] } })

    expect(result.status).toBe(200)
    expect(result.data).toEqual({ marked: 1 })
  })

  it('surfaces DB errors instead of returning a fake empty notification list', async () => {
    const { GET } = await import('@/app/api/notifications/route')
    setupMockClient(createErrorChain('notification db failed'))

    const result = await callRoute(GET, 'GET')

    expect(result.status).toBe(500)
    expect((result.data as { error: string }).error).toBe('notification db failed')
  })
})
