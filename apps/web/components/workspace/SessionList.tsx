'use client'

import { useMemo, useState } from 'react'
import { Badge, StateCard } from '@agenthub/ui'
import { Archive, MessageSquareText, RotateCcw, Search, Trash2 } from 'lucide-react'
import { useSessionStore } from '@/store/session-store'

export function SessionList() {
  const {
    sessions,
    activeSessionId,
    sessionStatusFilter,
    setActiveSession,
    setSessionStatusFilter,
    archiveSession,
    restoreSession,
    deleteSession,
    loading,
  } = useSessionStore()
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
    return (
      <div data-testid="session-list" className="flex h-full flex-col gap-2">
        <SessionStatusTabs value={sessionStatusFilter} onChange={setSessionStatusFilter} />
        <StateCard variant="empty" />
      </div>
    )
  }

  const handleArchive = async (sessionId: string, title: string) => {
    if (!confirm(`确定归档会话「${title}」吗？归档后可在归档列表中恢复。`)) return
    await archiveSession(sessionId)
  }

  const handleRestore = async (sessionId: string) => {
    await restoreSession(sessionId)
  }

  const handleDelete = async (sessionId: string, title: string) => {
    if (!confirm(`确定删除会话「${title}」吗？相关消息、计划和运行记录会一并删除。`)) return
    await deleteSession(sessionId)
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
      <SessionStatusTabs value={sessionStatusFilter} onChange={setSessionStatusFilter} />
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
          <div
            key={session.id}
            className={`w-full rounded-md border p-3 text-left transition-colors ${
              activeSessionId === session.id ? 'border-primary/40 bg-primary/10' : 'border-transparent hover:border-border hover:bg-muted'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <button
                type="button"
                onClick={() => setActiveSession(session.id)}
                className="min-w-0 flex-1 text-left"
              >
                <p className="truncate text-sm font-medium">{session.title}</p>
              </button>
              <div className="flex shrink-0 items-center gap-1">
                {activeSessionId === session.id && <Badge variant="default">当前</Badge>}
                {sessionStatusFilter === 'active' ? (
                  <button
                    type="button"
                    aria-label={`归档会话 ${session.title}`}
                    data-testid={`archive-session-${session.id}`}
                    className="rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={() => handleArchive(session.id, session.title)}
                  >
                    <Archive className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    aria-label={`恢复会话 ${session.title}`}
                    data-testid={`restore-session-${session.id}`}
                    className="rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={() => handleRestore(session.id)}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  aria-label={`删除会话 ${session.title}`}
                  data-testid={`delete-session-${session.id}`}
                  className="rounded-sm p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => handleDelete(session.id, session.title)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveSession(session.id)}
              className="mt-1 block w-full text-left"
            >
              <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{session.lastMessage || '暂无最新消息'}</p>
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function SessionStatusTabs({
  value,
  onChange,
}: {
  value: 'active' | 'archived'
  onChange: (value: 'active' | 'archived') => Promise<void>
}) {
  return (
    <div className="grid h-8 grid-cols-2 rounded-md border border-input bg-background p-0.5 text-xs">
      {([
        ['active', '活跃'],
        ['archived', '归档'],
      ] as const).map(([status, label]) => (
        <button
          key={status}
          type="button"
          data-testid={`session-filter-${status}`}
          className={`rounded-sm px-2 font-medium transition-colors ${
            value === status ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => {
            if (value !== status) void onChange(status)
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
