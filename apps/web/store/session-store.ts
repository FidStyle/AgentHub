import { create } from 'zustand'

export interface Session {
  id: string
  title: string
  lastMessage: string
  updatedAt: string
}

export interface Message {
  id: string
  sessionId: string
  role: 'user' | 'agent'
  content: string
  createdAt: string
  roleAgentId: string | null
}

interface SessionState {
  sessions: Session[]
  activeSessionId: string | null
  activeWorkspaceId: string | null
  messages: Message[]
  loading: boolean
  error: string | null
  setActiveSession: (id: string) => void
  setActiveWorkspace: (id: string) => void
  fetchSessions: (workspaceId: string) => Promise<void>
  createSession: (workspaceId: string) => Promise<void>
  fetchMessages: (sessionId: string) => Promise<void>
  sendMessage: (input: { content: string; roleAgentIds?: string[]; attachmentIds?: string[]; permissionMode?: string }) => Promise<void>
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  activeWorkspaceId: null,
  messages: [],
  loading: false,
  error: null,

  setActiveSession: (id) => {
    set({ activeSessionId: id })
    get().fetchMessages(id)
  },

  setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),

  fetchSessions: async (workspaceId) => {
    set({ loading: true, error: null })
    try {
      const res = await fetch(`/api/sessions?workspace_id=${workspaceId}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }))
        set({ error: body.error || res.statusText, loading: false })
        return
      }
      const data = await res.json()
      let sessions: Session[] = data.map((s: Record<string, unknown>) => ({
        id: s.id,
        title: s.name || '未命名会话',
        lastMessage: '',
        updatedAt: s.updated_at || s.created_at || '',
      }))
      if (sessions.length === 0) {
        const createRes = await fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspace_id: workspaceId }),
        })
        if (!createRes.ok) {
          const body = await createRes.json().catch(() => ({ error: createRes.statusText }))
          set({ error: body.error || createRes.statusText, loading: false })
          return
        }
        const s = await createRes.json()
        sessions = [{
          id: s.id,
          title: s.name || '新会话',
          lastMessage: '',
          updatedAt: s.updated_at || s.created_at || '',
        }]
      }
      set({ sessions, activeWorkspaceId: workspaceId, activeSessionId: sessions[0]?.id ?? null, loading: false })
      if (sessions[0]) get().fetchMessages(sessions[0].id)
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  createSession: async (workspaceId) => {
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }))
        set({ error: body.error || res.statusText })
        return
      }
      const s = await res.json()
      const session: Session = {
        id: s.id,
        title: s.name || '新会话',
        lastMessage: '',
        updatedAt: s.updated_at || s.created_at || '',
      }
      set((state) => ({ sessions: [session, ...state.sessions], activeSessionId: session.id, messages: [] }))
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },

  fetchMessages: async (sessionId) => {
    set({ loading: true, error: null })
    try {
      const res = await fetch(`/api/messages?session_id=${sessionId}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }))
        set({ error: body.error || res.statusText, loading: false })
        return
      }
      const data = await res.json()
      const messages: Message[] = data.map((m: Record<string, unknown>) => ({
        id: m.id,
        sessionId: m.session_id,
        role: m.sender_type === 'user' ? 'user' : 'agent',
        content: m.content,
        createdAt: m.created_at || '',
        roleAgentId: (m.role_agent_id as string | null) ?? null,
      }))
      set({ messages, loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  sendMessage: async ({ content, roleAgentIds = [], attachmentIds = [], permissionMode }) => {
    const { activeSessionId, messages } = get()
    if (!activeSessionId) return
    const primaryRoleAgentId = roleAgentIds[0] ?? null

    const optimistic: Message = {
      id: `tmp-${Date.now()}`,
      sessionId: activeSessionId,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
      roleAgentId: primaryRoleAgentId,
    }
    set({ messages: [...messages, optimistic] })

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: activeSessionId,
          content,
          roleAgentId: primaryRoleAgentId,
          roleAgentIds,
          mentions: roleAgentIds.length > 0 ? roleAgentIds : null,
          attachmentIds,
          permissionMode,
        }),
      })
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({ error: res.statusText }))
        set({ error: body.error || res.statusText })
        return
      }

      // Stream the SSE runtime events, accumulating runtime_output deltas into one agent reply
      // tagged with the responding role so the UI can show which role answered.
      const replyId = `reply-${Date.now()}`
      let reply = ''
      let replyCreated = false
      let respondingRoleAgentId: string | null = primaryRoleAgentId
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      const upsertReply = () => {
        set((state) => {
          if (!replyCreated) {
            replyCreated = true
            return {
              messages: [
                ...state.messages,
                {
                  id: replyId,
                  sessionId: activeSessionId,
                  role: 'agent',
                  content: reply,
                  createdAt: new Date().toISOString(),
                  roleAgentId: respondingRoleAgentId,
                } as Message,
              ],
            }
          }
          return {
            messages: state.messages.map((m) => (m.id === replyId ? { ...m, content: reply } : m)),
          }
        })
      }

      // Runtime unavailable/failed terminals must surface a clear status, never silence or a
      // fake success. Shown as a distinct system notice (no roleAgentId) so it is not mistaken
      // for a real agent answer.
      const statusText: Record<string, string> = {
        endpoint_unavailable: '⚠️ 公共云端 Runtime 未就绪，请稍后再试或切换到本地 Desktop 运行时',
        local_runtime_offline: '⚠️ 本地 Desktop 运行时离线，未收到回复',
        tunnel_disconnected: '⚠️ 本地运行时连接已断开，未收到回复',
        runtime_failed: '⚠️ 运行时执行失败，未收到回复',
      }
      const showSystemNotice = (text: string) => {
        set((state) => ({
          messages: [
            ...state.messages,
            {
              id: `sys-${Date.now()}`,
              sessionId: activeSessionId,
              role: 'agent',
              content: text,
              createdAt: new Date().toISOString(),
              roleAgentId: null,
            } as Message,
          ],
        }))
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const frames = buffer.split('\n\n')
        buffer = frames.pop() ?? ''
        for (const frame of frames) {
          const line = frame.trim()
          if (!line.startsWith('data:')) continue
          const evt = JSON.parse(line.slice(5).trim()) as { type?: string; delta?: string; roleAgentId?: string | null }
          if (evt.type === 'role_selected' && evt.roleAgentId) {
            respondingRoleAgentId = evt.roleAgentId
          }
          if (evt.type === 'runtime_output' && evt.delta) {
            reply += evt.delta
            upsertReply()
          } else if (evt.type && statusText[evt.type] && !replyCreated) {
            showSystemNotice(statusText[evt.type])
          }
        }
      }
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },
}))
