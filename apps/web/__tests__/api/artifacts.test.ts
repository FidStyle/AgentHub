import { beforeEach, describe, expect, it } from 'vitest'
import {
  createPostgresChain,
  resetMockAuth,
  resetMockClient,
  setupMockAuth,
  setupMockClient,
} from '../utils'

async function callRoute<T>(
  handler: (request: Request) => Promise<Response>,
  method: 'GET' | 'POST',
  url: string,
  body?: unknown,
): Promise<{ status: number; data: T }> {
  const request = new Request(new URL(url, 'http://localhost'), {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
  })
  const response = await handler(request)
  return { status: response.status, data: await response.json() as T }
}

describe('/api/artifacts', () => {
  beforeEach(() => {
    resetMockClient()
    resetMockAuth()
    setupMockAuth()
    setupMockClient(createPostgresChain())
  })

  it('lists durable artifacts by workspace and session with ownership checks', async () => {
    const { GET } = await import('@/app/api/artifacts/route')
    const result = await callRoute<Array<{ id: string; title: string }>>(
      GET,
      'GET',
      '/api/artifacts?workspace_id=ws-001&session_id=session-001',
    )
    expect(result.status).toBe(200)
    expect(result.data.some((artifact) => artifact.title === '测试产物')).toBe(true)
  })

  it('creates a non-file artifact as a durable record', async () => {
    const { POST } = await import('@/app/api/artifacts/route')
    const result = await callRoute<{ title: string; artifact_type: string; content: string }>(
      POST,
      'POST',
      '/api/artifacts',
      {
        workspace_id: 'ws-001',
        session_id: 'session-001',
        title: 'Markdown 产物',
        artifact_type: 'markdown',
        content: '# Markdown 产物',
      },
    )
    expect(result.status).toBe(201)
    expect(result.data.title).toBe('Markdown 产物')
    expect(result.data.artifact_type).toBe('markdown')
    expect(result.data.content).toContain('Markdown 产物')
  })

  it('rejects artifact creation without workspace_id', async () => {
    const { POST } = await import('@/app/api/artifacts/route')
    const result = await callRoute<{ error: string }>(POST, 'POST', '/api/artifacts', {
      title: '缺工作区',
    })
    expect(result.status).toBe(400)
    expect(result.data.error).toBe('缺少 workspace_id')
  })
})
