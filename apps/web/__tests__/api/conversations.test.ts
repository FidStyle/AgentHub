import { beforeEach, describe, expect, it } from 'vitest'
import { createPostgresChain, mockRoleAgent, mockUser, resetMockAuth, resetMockClient, setupMockAuth, setupMockClient } from '../utils'

async function callRoute<T>(handler: (request: Request) => Promise<Response>, method: 'GET' | 'POST', url: string, body?: unknown) {
  const request = new Request(new URL(url, 'http://localhost'), {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
  })
  const response = await handler(request)
  return { status: response.status, data: await response.json() as T }
}

describe('/api/conversations', () => {
  beforeEach(() => {
    resetMockClient()
    resetMockAuth()
    setupMockAuth()
  })

  it('merges contacts and group sessions with pinned/recent sorting', async () => {
    const sessions = [
      {
        id: 'session-group',
        workspace_id: 'ws-001',
        name: '项目群聊',
        status: 'active',
        chat_kind: 'group',
        participant_role_agent_ids: ['agent-001'],
        is_pinned: true,
        updated_at: '2026-01-02T00:00:00.000Z',
        last_activity_at: '2026-01-02T00:00:00.000Z',
      },
    ]
    setupMockClient(createPostgresChain(mockUser, undefined, sessions, [], [mockRoleAgent]))
    const { GET } = await import('@/app/api/conversations/route')
    const result = await callRoute<Array<{ kind: string; title: string; isPinned: boolean }>>(
      GET,
      'GET',
      '/api/conversations?workspace_id=ws-001&status=active',
    )
    expect(result.status).toBe(200)
    expect(result.data[0]).toMatchObject({ kind: 'group', title: '项目群聊', isPinned: true })
    expect(result.data.some((row) => row.kind === 'contact' && row.title === 'Analyzer Agent')).toBe(true)
  })

  it('returns session runtime permission mode for composer readback', async () => {
    const sessions = [
      {
        id: 'session-group',
        workspace_id: 'ws-001',
        name: '交付群聊',
        status: 'active',
        chat_kind: 'group',
        participant_role_agent_ids: ['agent-001'],
        metadata: { runtimePermissionMode: 'full_control' },
        is_pinned: false,
        updated_at: '2026-01-02T00:00:00.000Z',
        last_activity_at: '2026-01-02T00:00:00.000Z',
      },
    ]
    setupMockClient(createPostgresChain(mockUser, undefined, sessions, [], [mockRoleAgent]))
    const { GET } = await import('@/app/api/conversations/route')
    const result = await callRoute<Array<{ kind: string; title: string; runtimePermissionMode?: string | null }>>(
      GET,
      'GET',
      '/api/conversations?workspace_id=ws-001&status=active',
    )
    expect(result.status).toBe(200)
    expect(result.data.find((row) => row.kind === 'group')).toMatchObject({
      title: '交付群聊',
      runtimePermissionMode: 'full_control',
    })
  })

  it('creates a group conversation with selected participants', async () => {
    setupMockClient(createPostgresChain())
    const { POST } = await import('@/app/api/conversations/groups/route')
    const result = await callRoute<{ chat_kind: string; participants: string[] }>(
      POST,
      'POST',
      '/api/conversations/groups',
      { workspace_id: 'ws-001', name: '交付群', participant_role_agent_ids: ['agent-001'] },
    )
    expect(result.status).toBe(201)
    expect(result.data.chat_kind).toBe('group')
    expect(result.data.participants).toEqual(['agent-001'])
  })
})
