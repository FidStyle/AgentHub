import { create } from 'zustand'
import type { RuntimeMessagePart } from '@agenthub/shared'

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
  isPinned: boolean
  parts?: RuntimeMessagePart[]
}

type StreamEvent = {
  type?: string
  delta?: string
  roleAgentId?: string | null
  toolCallId?: string
  toolName?: string
  input?: unknown
  result?: unknown
  actionId?: string
  title?: string
  description?: string
  riskLevel?: string
  questionId?: string
  content?: string
  path?: string
  diff?: string
  artifactId?: string
  artifactType?: string
  sourcePath?: string
  contentRef?: string
}

function isRuntimeMessagePart(value: unknown): value is RuntimeMessagePart {
  if (!value || typeof value !== 'object') return false
  const record = value as { id?: unknown; type?: unknown }
  return typeof record.id === 'string' && typeof record.type === 'string'
}

function partsFromMetadata(metadata: unknown): RuntimeMessagePart[] | undefined {
  if (!metadata || typeof metadata !== 'object') return undefined
  const parts = (metadata as { runtimeParts?: unknown }).runtimeParts
  return Array.isArray(parts) ? parts.filter(isRuntimeMessagePart) : undefined
}

function partId(prefix: string, evt: StreamEvent) {
  return String(evt.toolCallId || evt.actionId || evt.questionId || evt.artifactId || `${prefix}-${Date.now()}`)
}

function reduceRuntimeParts(parts: RuntimeMessagePart[], evt: StreamEvent): RuntimeMessagePart[] {
  if (evt.type === 'tool_started' && evt.toolName) {
    const id = partId(`tool-${evt.toolName}`, evt)
    return [...parts.filter((part) => part.id !== id), { id, type: 'tool', status: 'running', toolName: evt.toolName, input: evt.input }]
  }
  if (evt.type === 'tool_delta') {
    const id = partId('tool', evt)
    return parts.map((part) => (
      part.id === id && part.type === 'tool'
        ? { ...part, delta: `${part.delta ?? ''}${evt.delta ?? ''}` }
        : part
    ))
  }
  if (evt.type === 'tool_completed' && evt.toolName) {
    const id = partId(`tool-${evt.toolName}`, evt)
    const existing = parts.find((part) => part.id === id && part.type === 'tool')
    const next: RuntimeMessagePart = {
      id,
      type: 'tool',
      status: 'completed',
      toolName: evt.toolName,
      input: existing?.type === 'tool' ? existing.input : evt.input,
      delta: existing?.type === 'tool' ? existing.delta : undefined,
      result: evt.result,
    }
    return [...parts.filter((part) => part.id !== id), next]
  }
  if (evt.type === 'approval_requested' && evt.description) {
    return [...parts, { id: partId('approval', evt), type: 'permission', status: 'pending', actionId: evt.actionId, title: evt.title, description: evt.description, riskLevel: evt.riskLevel }]
  }
  if (evt.type === 'question' && evt.content) {
    return [...parts, { id: partId('question', evt), type: 'question', status: 'pending', questionId: evt.questionId, title: evt.title, content: evt.content }]
  }
  if (evt.type === 'diff_created' && evt.diff) {
    return [...parts, { id: partId('diff', evt), type: 'diff', status: 'created', path: evt.path, diff: evt.diff }]
  }
  if (evt.type === 'artifact_created' && evt.artifactType && evt.title) {
    return [...parts, { id: partId('artifact', evt), type: 'artifact', status: 'created', artifactId: evt.artifactId, artifactType: evt.artifactType, title: evt.title, sourcePath: evt.sourcePath, contentRef: evt.contentRef }]
  }
  return parts
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
  setMessagePinned: (messageId: string, isPinned: boolean) => Promise<void>
  sendMessage: (input: { content: string; roleAgentIds?: string[]; attachmentIds?: string[]; permissionMode?: string; signal?: AbortSignal }) => Promise<void>
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
        lastMessage: (s.last_message as string | undefined) || '',
        updatedAt: (s.last_message_at as string | undefined) || s.updated_at || s.created_at || '',
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
        isPinned: Boolean(m.is_pinned),
        parts: partsFromMetadata(m.metadata),
      }))
      set({ messages, loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  setMessagePinned: async (messageId, isPinned) => {
    const previous = get().messages
    set({
      messages: previous.map((message) => (
        message.id === messageId ? { ...message, isPinned } : message
      )),
    })
    try {
      const res = await fetch(`/api/messages/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_pinned: isPinned }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }))
        throw new Error(body.error || res.statusText)
      }
      const row = await res.json()
      set((state) => ({
        messages: state.messages.map((message) => (
          message.id === messageId ? { ...message, isPinned: Boolean(row.is_pinned) } : message
        )),
      }))
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('messages:changed', {
          detail: { sessionId: row.session_id, messageId, isPinned: Boolean(row.is_pinned) },
        }))
      }
    } catch (e) {
      set({ messages: previous, error: (e as Error).message })
      throw e
    }
  },

  sendMessage: async ({ content, roleAgentIds = [], attachmentIds = [], permissionMode, signal }) => {
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
      isPinned: false,
    }
    set({ messages: [...messages, optimistic] })
    set((state) => ({
      sessions: state.sessions.map((session) => (
        session.id === activeSessionId
          ? { ...session, lastMessage: content, updatedAt: optimistic.createdAt }
          : session
      )),
    }))

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
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

      // Stream the SSE runtime events. Each role_selected frame starts a distinct visible
      // reply bubble so multi-role @ runs do not collapse into the first/last role.
      let replySeq = 0
      let replyId = `reply-${Date.now()}-${replySeq}`
      let reply = ''
      let runtimeParts: RuntimeMessagePart[] = []
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
                  isPinned: false,
                  parts: runtimeParts,
                } as Message,
              ],
            }
          }
          return {
            messages: state.messages.map((m) => (m.id === replyId ? { ...m, content: reply, parts: runtimeParts } : m)),
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
              isPinned: false,
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
          const evt = JSON.parse(line.slice(5).trim()) as StreamEvent
          if (evt.type === 'role_selected' && evt.roleAgentId) {
            if (replyCreated && (reply || runtimeParts.length > 0)) {
              replySeq += 1
              replyId = `reply-${Date.now()}-${replySeq}`
              reply = ''
              runtimeParts = []
              replyCreated = false
            }
            respondingRoleAgentId = evt.roleAgentId
          }
          const nextParts = reduceRuntimeParts(runtimeParts, evt)
          if (nextParts !== runtimeParts) {
            runtimeParts = nextParts
            upsertReply()
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
      if (e instanceof DOMException && e.name === 'AbortError') {
        set((state) => ({
          messages: [
            ...state.messages,
            {
              id: `sys-${Date.now()}`,
              sessionId: activeSessionId,
              role: 'agent',
              content: '已停止本次回复。',
              createdAt: new Date().toISOString(),
              roleAgentId: null,
              isPinned: false,
            } as Message,
          ],
        }))
        return
      }
      set({ error: (e as Error).message })
    }
  },
}))
