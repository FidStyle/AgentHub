'use client'

import { useMemo, useState } from 'react'
import { Badge, Button, StateCard } from '@agenthub/ui'
import { Archive, Clock, MessageSquareText, Pin, PinOff, Plus, RotateCcw, Search, Trash2, UserRound, UsersRound } from 'lucide-react'
import { useSessionStore } from '@/store/session-store'

function formatSessionTime(value: string) {
  if (!value) return '暂无时间'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '暂无时间'
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function SessionList() {
  const {
    sessions,
    activeSessionId,
    sessionStatusFilter,
    setSessionStatusFilter,
    archiveSession,
    restoreSession,
    deleteSession,
    pinSession,
    openConversation,
    createGroupConversation,
    loading,
    activeWorkspaceId,
  } = useSessionStore()
  const [query, setQuery] = useState('')
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([])
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
  const contacts = sessions.filter((session) => session.kind === 'contact' && session.roleAgentId)
  const submitGroup = async () => {
    if (!activeWorkspaceId || !groupName.trim() || selectedParticipants.length === 0) return
    await createGroupConversation({ workspaceId: activeWorkspaceId, name: groupName.trim(), participantRoleAgentIds: selectedParticipants })
    setCreatingGroup(false)
    setGroupName('')
    setSelectedParticipants([])
  }

  return (
    <div data-testid="session-list" className="flex h-full flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-medium">
          <MessageSquareText className="h-3.5 w-3.5 text-muted-foreground" />
          联系人与群聊
        </div>
        <div className="flex items-center gap-1">
          <Badge variant="secondary">{filtered.length}/{sessions.length}</Badge>
          <button
            type="button"
            aria-label="新建群聊"
            data-testid="new-group-conversation"
            className="rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => setCreatingGroup((value) => !value)}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {creatingGroup && (
        <div data-testid="group-create-form" className="rounded-md border border-border bg-background p-2 text-xs">
          <input
            value={groupName}
            onChange={(event) => setGroupName(event.target.value)}
            placeholder="群聊名称"
            className="h-8 w-full rounded-md border border-input bg-background px-2 outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="mt-2 max-h-32 space-y-1 overflow-y-auto">
            {contacts.map((contact) => (
              <label key={contact.roleAgentId} className="flex items-center gap-2 rounded-sm px-1 py-1 hover:bg-muted">
                <input
                  type="checkbox"
                  checked={selectedParticipants.includes(contact.roleAgentId ?? '')}
                  onChange={(event) => {
                    const id = contact.roleAgentId ?? ''
                    setSelectedParticipants((current) => event.target.checked
                      ? [...current, id]
                      : current.filter((item) => item !== id))
                  }}
                />
                <span className="truncate">{contact.title}</span>
              </label>
            ))}
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setCreatingGroup(false)}>取消</Button>
            <Button size="sm" disabled={!groupName.trim() || selectedParticipants.length === 0} onClick={() => void submitGroup()}>创建</Button>
          </div>
        </div>
      )}
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
                onClick={() => void openConversation(session)}
                className="min-w-0 flex-1 text-left"
              >
                <span className="flex min-w-0 items-center gap-2">
                  {session.kind === 'contact' ? <UserRound className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <UsersRound className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                  <span className="truncate text-sm font-medium">{session.title}</span>
                  {session.isPinned && <Badge variant="secondary">置顶</Badge>}
                  {session.status === 'archived' && <Badge variant="secondary">已归档</Badge>}
                </span>
              </button>
              <div className="flex shrink-0 items-center gap-1">
                {activeSessionId === (session.sessionId ?? session.id) && <Badge variant="default">当前</Badge>}
                {session.sessionId && (
                  <button
                    type="button"
                    aria-label={`${session.isPinned ? '取消置顶' : '置顶'} ${session.title}`}
                    data-testid={`pin-session-${session.sessionId}`}
                    className="rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={() => void pinSession(session.sessionId ?? session.id, !session.isPinned)}
                  >
                    {session.isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                  </button>
                )}
                {session.kind !== 'contact' && sessionStatusFilter === 'active' ? (
                  <button
                    type="button"
                    aria-label={`归档会话 ${session.title}`}
                    data-testid={`archive-session-${session.id}`}
                    className="rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={() => handleArchive(session.id, session.title)}
                  >
                    <Archive className="h-3.5 w-3.5" />
                  </button>
                ) : session.kind !== 'contact' ? (
                  <button
                    type="button"
                    aria-label={`恢复会话 ${session.title}`}
                    data-testid={`restore-session-${session.id}`}
                    className="rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={() => handleRestore(session.id)}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                ) : null}
                {session.kind !== 'contact' && (
                  <button
                    type="button"
                    aria-label={`删除会话 ${session.title}`}
                    data-testid={`delete-session-${session.id}`}
                    className="rounded-sm p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => handleDelete(session.id, session.title)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => void openConversation(session)}
              className="mt-1 block w-full text-left"
            >
              <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{session.lastMessage || '暂无最新消息'}</p>
              <span className="mt-2 flex items-center gap-1 text-[11px] leading-4 text-muted-foreground">
                <Clock className="h-3 w-3" />
                最近活跃：{formatSessionTime(session.updatedAt)}
              </span>
              {session.participants && session.participants.length > 1 && (
                <span className="mt-1 block truncate text-[11px] leading-4 text-muted-foreground">
                  成员：{session.participants.map((participant) => participant.name).join('、')}
                </span>
              )}
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
