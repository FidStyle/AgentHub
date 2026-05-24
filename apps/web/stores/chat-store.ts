import { create } from 'zustand'
import type { Session, Message, Workspace } from '@agenthub/shared'

interface ChatStore {
  workspaces: Workspace[]
  sessions: Session[]
  currentSessionId: string | null
  messages: Message[]
  setWorkspaces: (ws: Workspace[]) => void
  setSessions: (s: Session[]) => void
  setCurrentSession: (id: string | null) => void
  setMessages: (msgs: Message[]) => void
  addMessage: (msg: Message) => void
  updateMessage: (id: string, partial: Partial<Message>) => void
}

export const useChatStore = create<ChatStore>((set) => ({
  workspaces: [],
  sessions: [],
  currentSessionId: null,
  messages: [],
  setWorkspaces: (workspaces) => set({ workspaces }),
  setSessions: (sessions) => set({ sessions }),
  setCurrentSession: (currentSessionId) => set({ currentSessionId }),
  setMessages: (messages) => set({ messages }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  updateMessage: (id, partial) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, ...partial } : m)),
    })),
}))
