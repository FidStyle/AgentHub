'use client'

import { useMemo, useState } from 'react'
import { StateCard } from '@agenthub/ui'
import { useSessionStore } from '@/store/session-store'

export function SessionList() {
  const { sessions, activeSessionId, setActiveSession, loading } = useSessionStore()
  const [query, setQuery] = useState('')
  const normalized = query.trim().toLowerCase()
  const filtered = useMemo(() => {
    if (!normalized) return sessions
    return sessions.filter((session) =>
      session.title.toLowerCase().includes(normalized) ||
      session.lastMessage.toLowerCase().includes(normalized),
    )
  }, [normalized, sessions])

  if (loading) {
    return <div data-testid="session-list"><StateCard variant="loading" /></div>
  }

  if (sessions.length === 0) {
    return <div data-testid="session-list"><StateCard variant="empty" /></div>
  }

  return (
    <div data-testid="session-list" className="flex h-full flex-col gap-2">
      <input
        data-testid="session-search-input"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="搜索标题或内容"
        className="h-8 rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {filtered.length === 0 && <p className="px-2 py-3 text-xs text-muted-foreground">没有匹配的会话</p>}
        {filtered.map((session) => (
          <button
            key={session.id}
            onClick={() => setActiveSession(session.id)}
            className={`w-full text-left rounded-md p-3 transition-colors ${
              activeSessionId === session.id ? 'bg-primary/10' : 'hover:bg-muted'
            }`}
          >
            <p className="text-sm font-medium truncate">{session.title}</p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">{session.lastMessage || '暂无最新消息'}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
