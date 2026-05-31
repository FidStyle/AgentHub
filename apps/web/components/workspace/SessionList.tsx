'use client'

import { useMemo, useState } from 'react'
import { Badge, StateCard } from '@agenthub/ui'
import { MessageSquareText, Search } from 'lucide-react'
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
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-medium">
          <MessageSquareText className="h-3.5 w-3.5 text-muted-foreground" />
          会话
        </div>
        <Badge variant="secondary">{filtered.length}/{sessions.length}</Badge>
      </div>
      <label className="flex h-8 items-center gap-2 rounded-md border border-input bg-background px-2 focus-within:ring-2 focus-within:ring-ring">
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <input
          data-testid="session-search-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索标题或内容"
          className="min-w-0 flex-1 bg-transparent text-xs outline-none"
        />
      </label>
      <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {filtered.length === 0 && <p className="px-2 py-3 text-xs text-muted-foreground">没有匹配的会话</p>}
        {filtered.map((session) => (
          <button
            key={session.id}
            onClick={() => setActiveSession(session.id)}
            className={`w-full rounded-md border p-3 text-left transition-colors ${
              activeSessionId === session.id ? 'border-primary/40 bg-primary/10' : 'border-transparent hover:border-border hover:bg-muted'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="truncate text-sm font-medium">{session.title}</p>
              {activeSessionId === session.id && <Badge variant="default">当前</Badge>}
            </div>
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{session.lastMessage || '暂无最新消息'}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
