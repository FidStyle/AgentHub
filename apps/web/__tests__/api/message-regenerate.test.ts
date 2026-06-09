import { beforeEach, describe, expect, it } from 'vitest'
import {
  mockSession,
  resetMockAuth,
  resetMockClient,
  setupMockAuth,
  setupMockClient,
} from '../utils'

async function callRegenerate(messageId: string) {
  const { POST } = await import('@/app/api/messages/[id]/regenerate/route')
  const response = await POST(new Request(`http://localhost/api/messages/${messageId}/regenerate`, { method: 'POST' }), {
    params: Promise.resolve({ id: messageId }),
  })
  return { status: response.status, data: await response.json() }
}

function regenerateChain(messages: Array<Record<string, unknown>>) {
  return () => ({
    from: (table: string) => {
      if (table === 'messages') {
        return {
          select: () => ({
            eq: (field: string, value: string) => {
              if (field === 'id') {
                return { single: () => ({ data: messages.find((message) => message.id === value) ?? null, error: null }) }
              }
              if (field === 'session_id') {
                const bySession = messages.filter((message) => message.session_id === value)
                return {
                  eq: (field2: string, value2: string) => ({
                    order: () => ({ data: bySession.filter((message) => message[field2] === value2), error: null }),
                  }),
                }
              }
              return { single: () => ({ data: null, error: null }) }
            },
          }),
        }
      }
      if (table === 'sessions') {
        return {
          select: () => ({
            eq: () => ({ single: () => ({ data: { ...mockSession, workspace_id: 'ws-001' }, error: null }) }),
          }),
        }
      }
      if (table === 'workspaces') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({ single: () => ({ data: { id: 'ws-001' }, error: null }) }),
            }),
          }),
        }
      }
      return { select: () => ({ eq: () => ({ single: () => ({ data: null, error: null }) }) }) }
    },
  })
}

describe('POST /api/messages/[id]/regenerate', () => {
  beforeEach(() => {
    resetMockAuth()
    resetMockClient()
    setupMockAuth()
  })

  it('returns a durable replay payload from the previous user message', async () => {
    setupMockClient(regenerateChain([
      {
        id: 'user-001',
        session_id: 'session-001',
        sender_type: 'user',
        sender_id: 'user-001',
        role_agent_id: 'agent-arch',
        content: '做一个生成姓名的网页，需存储姓名记录，使用sqlite',
        metadata: {
          permissionMode: 'standard',
          roleAgents: [{ id: 'agent-arch', name: '架构师' }, { id: 'agent-fe', name: '前端工程师' }],
        },
        created_at: '2026-06-09T01:00:00.000Z',
      },
      {
        id: 'agent-failed',
        session_id: 'session-001',
        sender_type: 'agent',
        sender_id: null,
        role_agent_id: 'agent-arch',
        content: '执行失败：Runtime 输出空闲超时。',
        metadata: { visibleStatus: '执行失败' },
        created_at: '2026-06-09T01:01:00.000Z',
      },
    ]))

    const { status, data } = await callRegenerate('agent-failed')

    expect(status).toBe(200)
    expect(data).toMatchObject({
      sessionId: 'session-001',
      content: '做一个生成姓名的网页，需存储姓名记录，使用sqlite',
      roleAgentIds: ['agent-arch', 'agent-fe'],
      roleAgentId: 'agent-arch',
      permissionMode: 'standard',
      sourceMessageId: 'user-001',
      regenerateFromMessageId: 'agent-failed',
    })
  })

  it('rejects direct regenerate for user messages', async () => {
    setupMockClient(regenerateChain([
      {
        id: 'user-001',
        session_id: 'session-001',
        sender_type: 'user',
        sender_id: 'user-001',
        role_agent_id: null,
        content: '原始需求',
        metadata: null,
        created_at: '2026-06-09T01:00:00.000Z',
      },
    ]))

    const { status, data } = await callRegenerate('user-001')

    expect(status).toBe(400)
    expect(data.error).toContain('用户消息不能重新生成')
  })
})
