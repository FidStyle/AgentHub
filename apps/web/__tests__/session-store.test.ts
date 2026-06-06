import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSessionStore } from '@/store/session-store'

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function sseResponse(frames: unknown[]) {
  const encoder = new TextEncoder()
  return new Response(new ReadableStream({
    start(controller) {
      for (const frame of frames) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(frame)}\n\n`))
      }
      controller.close()
    },
  }), {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  })
}

afterEach(() => {
  vi.restoreAllMocks()
  useSessionStore.setState({
    sessions: [],
    activeSessionId: null,
    activeWorkspaceId: null,
    sessionStatusFilter: 'active',
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

  it('keeps historical role acknowledgement rows in the chat message list', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse([
      {
        id: 'ack-001',
        session_id: 'session-001',
        sender_type: 'system',
        content: '收到，我是 @架构师。',
        created_at: '2026-06-01T00:00:00.000Z',
        role_agent_id: 'agent-001',
        message_type: 'role_acknowledgement',
        metadata: null,
        is_pinned: false,
      },
      {
        id: 'msg-001',
        session_id: 'session-001',
        sender_type: 'agent',
        content: '真正回复',
        created_at: '2026-06-01T00:00:01.000Z',
        role_agent_id: 'agent-001',
        message_type: 'text',
        metadata: null,
        is_pinned: false,
      },
    ]))

    await useSessionStore.getState().fetchMessages('session-001')

    expect(useSessionStore.getState().messages.map((message) => message.id)).toEqual(['ack-001', 'msg-001'])
    expect(useSessionStore.getState().messages[0]).toMatchObject({
      role: 'agent',
      content: '收到，我是 @架构师。',
      messageType: 'role_acknowledgement',
      roleAgentId: 'agent-001',
    })
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

describe('session store streaming replies', () => {
  it('renames a placeholder session locally from the first user message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(sseResponse([
      {
        type: 'session_title_updated',
        sessionId: 'session-001',
        title: '做一个加减乘除的简单网站',
      },
      { type: 'runtime_completed' },
    ]))
    useSessionStore.setState({
      activeSessionId: 'session-001',
      sessions: [{ id: 'session-001', title: '新会话', lastMessage: '', updatedAt: '2026-06-01T00:00:00.000Z', status: 'active' }],
    })

    await useSessionStore.getState().sendMessage({
      content: '做一个加减乘除的简单网站\n使用 sqlite 存储历史记录',
    })

    expect(useSessionStore.getState().sessions[0]).toMatchObject({
      title: '做一个加减乘除的简单网站',
      lastMessage: '做一个加减乘除的简单网站\n使用 sqlite 存储历史记录',
    })
  })

  it('accumulates sequenced markdown runtime_output fragments without rewriting markdown bytes', async () => {
    const chunks = [
      '# 标题\n\n> 引用\n\n',
      '- 第一项\n- [x] 已完成\n- [ ] 未完成\n\n',
      '```ts\nconst price = "$5";\nconsole.log(price)\n```\n\n',
      '| A | B |\n| --- | --- |\n| 1 | 2 |\n\n---\n\n',
      '行内公式 $E = mc^2$\n\n$$\n\\int_0^1 x^2 dx\n$$',
    ]
    const expected = chunks.join('')
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(sseResponse([
      { type: 'runtime_status', status: 'running' },
      ...chunks.map((delta, index) => ({ type: 'runtime_output', delta, mode: 'append', seq: index + 1 })),
      { type: 'runtime_output', delta: chunks[0], mode: 'append', seq: 1 },
      { type: 'runtime_completed' },
    ]))
    useSessionStore.setState({
      activeSessionId: 'session-001',
      sessions: [{ id: 'session-001', title: '测试', lastMessage: '', updatedAt: '2026-06-01T00:00:00.000Z', status: 'active' }],
    })

    await useSessionStore.getState().sendMessage({ content: '开始' })

    const reply = useSessionStore.getState().messages.find((message) => message.id.startsWith('reply-'))
    expect(reply?.content).toBe(expected)
    expect(reply?.content.match(/# 标题/g)).toHaveLength(1)
    expect(reply?.content).toContain('- [ ] 未完成')
    expect(reply?.content).toContain('```ts\nconst price = "$5";')
    expect(reply?.content).toContain('| A | B |\n| --- | --- |\n| 1 | 2 |')
    expect(reply?.content).toContain('$$\n\\int_0^1 x^2 dx\n$$')
  })

  it('marks temporary runtime replies as non-streaming after the SSE stream ends', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(sseResponse([
      { type: 'runtime_status', status: 'running' },
      { type: 'runtime_output', delta: '第一段' },
      { type: 'runtime_output', delta: '第二段' },
      { type: 'runtime_completed' },
    ]))
    useSessionStore.setState({
      activeSessionId: 'session-001',
      sessions: [{ id: 'session-001', title: '测试', lastMessage: '', updatedAt: '2026-06-01T00:00:00.000Z', status: 'active' }],
    })

    await useSessionStore.getState().sendMessage({ content: '开始' })

    const reply = useSessionStore.getState().messages.find((message) => message.id.startsWith('reply-'))
    expect(reply).toMatchObject({
      role: 'agent',
      content: '第一段第二段',
      streaming: false,
    })
  })

  it('renders streamed role acknowledgement events as visible process messages', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(sseResponse([
      { type: 'role_acknowledgement', roleAgentId: 'agent-001', content: '收到，我是 @架构师。' },
      { type: 'runtime_output', delta: '真正回复' },
      { type: 'runtime_completed' },
    ]))
    useSessionStore.setState({
      activeSessionId: 'session-001',
      sessions: [{ id: 'session-001', title: '测试', lastMessage: '', updatedAt: '2026-06-01T00:00:00.000Z', status: 'active' }],
    })

    await useSessionStore.getState().sendMessage({ content: '开始', roleAgentIds: ['agent-001'] })

    expect(useSessionStore.getState().messages.map((message) => message.content)).toEqual(['开始', '收到，我是 @架构师。', '真正回复'])
    const acknowledgement = useSessionStore.getState().messages.find((message) => message.content === '收到，我是 @架构师。')
    expect(acknowledgement).toMatchObject({
      role: 'agent',
      roleAgentId: 'agent-001',
      streaming: false,
    })
  })

  it('renders streamed role process messages with role id, status, and permission card', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(sseResponse([
      {
        type: 'role_process_message',
        messageId: 'process-fe-waiting',
        sessionId: 'session-001',
        roleAgentId: 'agent-fe',
        content: '等待授权：@前端工程师 请求执行工具操作，当前节点已暂停。',
        messageType: 'system_event',
        createdAt: '2026-06-06T00:00:00.000Z',
        metadata: {
          visibleStatus: '等待授权',
          runtimeParts: [{
            id: 'approval-action-001',
            type: 'permission',
            status: 'pending',
            actionId: 'action-001',
            title: '写入 public/index.html',
            description: '需要写入前端入口文件',
            riskLevel: 'medium',
          }],
        },
      },
      { type: 'done' },
    ]))
    useSessionStore.setState({
      activeSessionId: 'session-001',
      sessions: [{ id: 'session-001', title: '测试', lastMessage: '', updatedAt: '2026-06-01T00:00:00.000Z', status: 'active' }],
    })

    await useSessionStore.getState().sendMessage({ content: '开始', roleAgentIds: ['agent-fe'] })

    const processMessage = useSessionStore.getState().messages.find((message) => message.id === 'process-fe-waiting')
    expect(processMessage).toMatchObject({
      role: 'agent',
      roleAgentId: 'agent-fe',
      messageType: 'system_event',
      visibleStatus: '等待授权',
      streaming: false,
    })
    expect(processMessage?.parts).toEqual([
      expect.objectContaining({ type: 'permission', status: 'pending', actionId: 'action-001' }),
    ])
    expect(useSessionStore.getState().messages.filter((message) => (
      message.parts?.some((part) => part.type === 'permission' && part.actionId === 'action-001')
    ))).toHaveLength(1)
  })

  it('does not duplicate approval cards when a role process message already carries the permission', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(sseResponse([
      {
        type: 'role_process_message',
        messageId: 'process-fe-waiting',
        sessionId: 'session-001',
        roleAgentId: 'agent-fe',
        content: '等待授权：@前端工程师 请求执行工具操作，当前节点已暂停。',
        messageType: 'system_event',
        metadata: {
          visibleStatus: '等待授权',
          runtimeParts: [{
            id: 'approval-action-001',
            type: 'permission',
            status: 'pending',
            actionId: 'action-001',
            title: '写入 public/index.html',
            description: '需要写入前端入口文件',
            riskLevel: 'medium',
          }],
        },
      },
      {
        type: 'approval_requested',
        actionId: 'action-001',
        title: '写入 public/index.html',
        description: '需要写入前端入口文件',
        riskLevel: 'medium',
      },
      { type: 'done' },
    ]))
    useSessionStore.setState({
      activeSessionId: 'session-001',
      sessions: [{ id: 'session-001', title: '测试', lastMessage: '', updatedAt: '2026-06-01T00:00:00.000Z', status: 'active' }],
    })

    await useSessionStore.getState().sendMessage({ content: '开始', roleAgentIds: ['agent-fe'] })

    expect(useSessionStore.getState().messages.filter((message) => (
      message.parts?.some((part) => part.type === 'permission' && part.actionId === 'action-001')
    ))).toHaveLength(1)
  })
})

describe('session store lifecycle actions', () => {
  it('fetches active sessions with status filter and maps archived state', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse([
      {
        id: 'session-archived',
        name: '归档会话',
        status: 'archived',
        last_message: '已归档',
        updated_at: '2026-06-01T00:00:00.000Z',
      },
    ]))
    useSessionStore.setState({ sessionStatusFilter: 'archived' })

    await useSessionStore.getState().fetchSessions('ws-001')

    expect(fetchMock).toHaveBeenCalledWith('/api/sessions?workspace_id=ws-001&status=archived')
    expect(useSessionStore.getState().sessions).toEqual([
      {
        id: 'session-archived',
        title: '归档会话',
        lastMessage: '已归档',
        updatedAt: '2026-06-01T00:00:00.000Z',
        status: 'archived',
      },
    ])
  })

  it('archives the active session and selects the next session', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ id: 'session-001', status: 'archived' }))
      .mockResolvedValueOnce(jsonResponse([]))
    useSessionStore.setState({
      activeSessionId: 'session-001',
      sessions: [
        { id: 'session-001', title: '当前', lastMessage: '', updatedAt: '2026-06-01T00:00:00.000Z', status: 'active' },
        { id: 'session-002', title: '下一个', lastMessage: '', updatedAt: '2026-06-01T00:00:00.000Z', status: 'active' },
      ],
    })

    await useSessionStore.getState().archiveSession('session-001')

    expect(fetchMock).toHaveBeenCalledWith('/api/sessions/session-001', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ status: 'archived' }),
    }))
    expect(useSessionStore.getState().activeSessionId).toBe('session-002')
    expect(useSessionStore.getState().sessions.map((session) => session.id)).toEqual(['session-002'])
  })

  it('deletes a session and rolls back on failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ error: '删除失败' }, { status: 500 }))
    useSessionStore.setState({
      activeSessionId: 'session-001',
      sessions: [
        { id: 'session-001', title: '当前', lastMessage: '', updatedAt: '2026-06-01T00:00:00.000Z', status: 'active' },
      ],
    })

    await expect(useSessionStore.getState().deleteSession('session-001')).rejects.toThrow('删除失败')
    expect(useSessionStore.getState().activeSessionId).toBe('session-001')
    expect(useSessionStore.getState().sessions).toHaveLength(1)
  })
})
