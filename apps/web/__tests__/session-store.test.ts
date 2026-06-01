import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSessionStore } from '@/store/session-store'

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => {
  vi.restoreAllMocks()
  useSessionStore.setState({
    sessions: [],
    activeSessionId: null,
    activeWorkspaceId: null,
    messages: [],
    loading: false,
    error: null,
  })
})

describe('session store message pinning', () => {
  it('maps DB is_pinned rows into UI message state', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse([
      {
        id: 'msg-001',
        session_id: 'session-001',
        sender_type: 'user',
        content: '需要固定的上下文',
        created_at: '2026-06-01T00:00:00.000Z',
        role_agent_id: null,
        metadata: null,
        is_pinned: true,
      },
    ]))

    await useSessionStore.getState().fetchMessages('session-001')

    expect(useSessionStore.getState().messages).toMatchObject([
      { id: 'msg-001', sessionId: 'session-001', isPinned: true },
    ])
  })

  it('PATCHes message pin state and rolls back on failure', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    useSessionStore.setState({
      messages: [{
        id: 'msg-001',
        sessionId: 'session-001',
        role: 'user',
        content: '上下文',
        createdAt: '2026-06-01T00:00:00.000Z',
        roleAgentId: null,
        isPinned: false,
      }],
    })
    fetchMock.mockResolvedValueOnce(jsonResponse({
      id: 'msg-001',
      session_id: 'session-001',
      is_pinned: true,
    }))

    await useSessionStore.getState().setMessagePinned('msg-001', true)

    expect(fetchMock).toHaveBeenCalledWith('/api/messages/msg-001', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ is_pinned: true }),
    }))
    expect(useSessionStore.getState().messages[0].isPinned).toBe(true)

    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'Forbidden' }, { status: 403 }))
    await expect(useSessionStore.getState().setMessagePinned('msg-001', false)).rejects.toThrow('Forbidden')
    expect(useSessionStore.getState().messages[0].isPinned).toBe(true)
  })
})
