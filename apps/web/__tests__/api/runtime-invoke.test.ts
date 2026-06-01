import { beforeEach, describe, expect, it } from 'vitest'
import {
  resetMockAuth,
  resetMockClient,
  setupMockAuth,
} from '../utils'

async function callPost() {
  const { POST } = await import('@/app/api/runtime/invoke/route')
  const response = await POST()
  return { status: response.status, data: await response.json() }
}

describe('/api/runtime/invoke', () => {
  beforeEach(() => {
    resetMockClient()
    resetMockAuth()
    setupMockAuth()
  })

  it('rejects unauthenticated access before reporting deprecation', async () => {
    setupMockAuth(null)

    const result = await callPost()

    expect(result.status).toBe(401)
    expect(result.data).toEqual({ error: '未授权' })
  })

  it('returns 410 instead of pretending a local runtime request was invoked', async () => {
    const result = await callPost()

    expect(result.status).toBe(410)
    expect((result.data as { error: string }).error).toContain('旧本地 Runtime invoke 入口已停用')
    expect((result.data as { error: string }).error).toContain('/api/chat')
  })
})
