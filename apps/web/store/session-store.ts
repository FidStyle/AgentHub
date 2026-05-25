import { create } from 'zustand'
import { mockSessions, mockMessages } from '@/lib/mock-data'

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
  messages: Message[]
  loading: boolean
  error: string | null
  setActiveSession: (id: string) => void
  sendMessage: (content: string) => void
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: mockSessions,
  activeSessionId: null,
  messages: mockMessages,
  loading: false,
  error: null,
  setActiveSession: (id) => set({ activeSessionId: id }),
  sendMessage: (content) => {
    const { activeSessionId, messages } = get()
    if (!activeSessionId) return
    const msg: Message = {
      id: `msg-${Date.now()}`,
      sessionId: activeSessionId,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    }
    set({ messages: [...messages, msg] })
  },
}))
