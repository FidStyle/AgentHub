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
  fetchMessages: (sessionId: string) => Promise<void>
  sendMessage: (content: string) => Promise<void>
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  activeWorkspaceId: null,
  messages: [],
  loading: false,
  error: null,

  setActiveSession: (id) => set({ activeSessionId: id }),

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
      const sessions: Session[] = data.map((s: Record<string, unknown>) => ({
        id: s.id,
        title: s.name || '未命名会话',
        lastMessage: '',
        updatedAt: s.updated_at || s.created_at || '',
      }))
      set({ sessions, activeWorkspaceId: workspaceId, loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
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
      }))
      set({ messages, loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  sendMessage: async (content) => {
    const { activeSessionId, messages } = get()
    if (!activeSessionId) return

    const optimistic: Message = {
      id: `tmp-${Date.now()}`,
      sessionId: activeSessionId,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    }
    set({ messages: [...messages, optimistic] })

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: activeSessionId, content, sender_type: 'user' }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }))
        set({ error: body.error || res.statusText })
        return
      }
      const saved = await res.json()
      set({
        messages: get().messages.map((m) =>
          m.id === optimistic.id
            ? { id: saved.id, sessionId: saved.session_id, role: 'user', content: saved.content, createdAt: saved.created_at }
            : m
        ),
      })
    } catch (e) {
      set({ error: (e as Error).message })
    }
  },
}))
