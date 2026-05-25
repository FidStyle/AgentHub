'use client'

import { StateCard } from '@agenthub/ui'
import { useSessionStore } from '@/store/session-store'

export function SessionList() {
  const { sessions, activeSessionId, setActiveSession, loading } = useSessionStore()

  if (loading) {
    return <div data-testid="session-list"><StateCard variant="loading" /></div>
  }

  if (sessions.length === 0) {
    return <div data-testid="session-list"><StateCard variant="empty" /></div>
  }

  return (
    <div data-testid="session-list" className="flex flex-col gap-1 overflow-y-auto">
      {sessions.map((session) => (
        <button
          key={session.id}
          onClick={() => setActiveSession(session.id)}
          className={`w-full text-left rounded-md p-3 transition-colors ${
            activeSessionId === session.id ? 'bg-primary/10' : 'hover:bg-muted'
          }`}
        >
          <p className="text-sm font-medium truncate">{session.title}</p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{session.lastMessage}</p>
        </button>
      ))}
    </div>
  )
}
