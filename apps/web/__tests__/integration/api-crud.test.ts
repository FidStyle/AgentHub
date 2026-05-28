import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

if (!process.env.DATABASE_URL) {
  throw new Error('集成测试需要 DATABASE_URL 指向测试数据库，不允许 skip')
}

const TEST_USER = { id: 'test-user-1', name: 'Test User', email: 'test@test.com', image: null }
const OTHER_USER = { id: 'test-user-2', name: 'Other User', email: 'other@test.com', image: null }

vi.mock('@/lib/auth-guard', () => ({
  requireAuth: vi.fn().mockResolvedValue({ user: TEST_USER, error: null }),
}))

const { requireAuth } = await import('@/lib/auth-guard')
const { createClient } = await import('@/lib/app-db-client')

async function callRoute(handler: Function, options: { method?: string; body?: object; url?: string } = {}) {
  const url = options.url || 'http://localhost:3000/api/test'
  const req = new NextRequest(url, {
    method: options.method || 'GET',
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  })
  return handler(req)
}

describe('API 集成测试（真实 DB）', () => {
  let db: Awaited<ReturnType<typeof createClient>>

  beforeAll(async () => {
    db = await createClient()
  })

  beforeEach(async () => {
    await db.from('messages').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await db.from('sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await db.from('workspaces').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    vi.mocked(requireAuth).mockResolvedValue({ user: TEST_USER, error: null })
  })

  describe('Workspace CRUD', () => {
    it('POST 创建后 DB 可查', async () => {
      const { POST } = await import('@/app/api/workspaces/route')
      const res = await callRoute(POST, {
        method: 'POST',
        body: { name: 'test-ws', execution_domain: 'cloud' },
      })
      expect(res.status).toBe(201)
      const ws = await res.json()

      const { data } = await db.from('workspaces').select('*').eq('id', ws.id)
      expect(data).toHaveLength(1)
      expect(data![0].name).toBe('test-ws')
    })
  })

  describe('Session CRUD', () => {
    it('POST 创建后 DB 可查', async () => {
      const { POST: createWs } = await import('@/app/api/workspaces/route')
      const wsRes = await callRoute(createWs, { method: 'POST', body: { name: 'ws-for-session', execution_domain: 'cloud' } })
      const ws = await wsRes.json()

      const { POST } = await import('@/app/api/sessions/route')
      const res = await callRoute(POST, { method: 'POST', body: { workspace_id: ws.id, name: 'test-session' } })
      expect(res.status).toBe(201)
      const session = await res.json()

      const { data } = await db.from('sessions').select('*').eq('id', session.id)
      expect(data).toHaveLength(1)
      expect(data![0].name).toBe('test-session')
    })
  })

  describe('Message CRUD', () => {
    it('POST 创建后 DB 可查', async () => {
      const { POST: createWs } = await import('@/app/api/workspaces/route')
      const wsRes = await callRoute(createWs, { method: 'POST', body: { name: 'ws-for-msg', execution_domain: 'cloud' } })
      const ws = await wsRes.json()

      const { POST: createSession } = await import('@/app/api/sessions/route')
      const sessRes = await callRoute(createSession, { method: 'POST', body: { workspace_id: ws.id } })
      const session = await sessRes.json()

      const { POST } = await import('@/app/api/messages/route')
      const res = await callRoute(POST, { method: 'POST', body: { session_id: session.id, content: 'hello world' } })
      expect(res.status).toBe(201)
      const msg = await res.json()

      const { data } = await db.from('messages').select('*').eq('id', msg.id)
      expect(data).toHaveLength(1)
      expect(data![0].content).toBe('hello world')
    })
  })

  describe('权限', () => {
    it('非 owner 返回 403', async () => {
      const { POST: createWs } = await import('@/app/api/workspaces/route')
      const wsRes = await callRoute(createWs, { method: 'POST', body: { name: 'private-ws', execution_domain: 'cloud' } })
      const ws = await wsRes.json()

      vi.mocked(requireAuth).mockResolvedValue({ user: OTHER_USER, error: null })

      const { GET } = await import('@/app/api/sessions/route')
      const res = await callRoute(GET, { url: `http://localhost:3000/api/sessions?workspace_id=${ws.id}` })
      expect(res.status).toBe(403)
    })
  })

  describe('鉴权', () => {
    it('未认证返回 401', async () => {
      const { NextResponse } = await import('next/server')
      vi.mocked(requireAuth).mockResolvedValue({
        user: null,
        error: NextResponse.json({ error: '未授权' }, { status: 401 }),
      } as any)

      const { GET } = await import('@/app/api/workspaces/route')
      const res = await callRoute(GET)
      expect(res.status).toBe(401)
    })
  })
})
