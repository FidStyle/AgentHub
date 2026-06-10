'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge, Button, StateCard } from '@agenthub/ui'
import { Clock, MessageCircle, Search, UsersRound } from 'lucide-react'
import { AgentHubAvatar } from '@/components/workspace/AgentHubAvatar'
import type { ConversationRow } from '@/lib/conversations'

interface WorkspaceRow {
  id: string
  name: string
  execution_domain: string
}

type ConversationStatus = 'active' | 'archived'

function formatRelativeTime(value: string) {
  if (!value) return '暂无'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '暂无'
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function domainLabel(domain: string) {
  return domain === 'cloud' ? '云端' : '本地'
}

export default function MobileHomePage() {
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([])
  const [conversations, setConversations] = useState<ConversationRow[]>([])
  const [selectedWs, setSelectedWs] = useState<string | null>(null)
  const [status, setStatus] = useState<ConversationStatus>('active')
  const [query, setQuery] = useState('')
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [conversationsLoading, setConversationsLoading] = useState(false)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const loadConversations = async (workspaceId: string, nextStatus = status) => {
    setConversationsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/conversations?workspace_id=${workspaceId}&status=${nextStatus}`)
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((body as { error?: string }).error || '加载聊天失败')
      setConversations(Array.isArray(body) ? body as ConversationRow[] : [])
    } catch (e) {
      setConversations([])
      setError(e instanceof Error ? e.message : '加载聊天失败')
    } finally {
      setConversationsLoading(false)
    }
  }

  useEffect(() => {
    fetch('/api/workspaces')
      .then(r => {
        if (!r.ok) throw new Error('加载工作区失败')
        return r.json()
      })
      .then(d => { if (Array.isArray(d)) setWorkspaces(d) })
      .catch((e) => setError(e instanceof Error ? e.message : '加载工作区失败'))
      .finally(() => setLoading(false))
  }, [])

  const chooseWorkspace = async (workspaceId: string) => {
    setSelectedWs(workspaceId)
    setCreatingGroup(false)
    setGroupName('')
    setSelectedParticipants([])
    await loadConversations(workspaceId, status)
  }

  const changeStatus = async (nextStatus: ConversationStatus) => {
    setStatus(nextStatus)
    if (selectedWs) await loadConversations(selectedWs, nextStatus)
  }

  const openConversation = async (conversation: ConversationRow) => {
    const sessionId = conversation.sessionId ?? null
    if (sessionId) {
      router.push(`/m/sessions/${sessionId}`)
      return
    }
    if (conversation.kind !== 'contact' || !conversation.roleAgentId || !selectedWs) return
    setOpeningId(conversation.id)
    setError(null)
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: selectedWs,
          name: conversation.title,
          chat_kind: 'direct',
          direct_role_agent_id: conversation.roleAgentId,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((body as { error?: string }).error || '创建单聊失败')
      router.push(`/m/sessions/${String((body as { id: string }).id)}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建单聊失败')
      setOpeningId(null)
    }
  }

  const createGroup = async () => {
    if (!selectedWs || !groupName.trim() || selectedParticipants.length === 0) return
    setConversationsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/conversations/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: selectedWs,
          name: groupName.trim(),
          participant_role_agent_ids: selectedParticipants,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((body as { error?: string }).error || '创建群聊失败')
      setCreatingGroup(false)
      setGroupName('')
      setSelectedParticipants([])
      router.push(`/m/sessions/${String((body as { id: string }).id)}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建群聊失败')
      setConversationsLoading(false)
    }
  }

  const selectedWorkspace = workspaces.find((workspace) => workspace.id === selectedWs) ?? null
  const contacts = conversations.filter((conversation) => conversation.kind === 'contact' && conversation.roleAgentId)
  const normalizedQuery = query.trim().toLowerCase()
  const filteredConversations = useMemo(() => {
    if (!normalizedQuery) return conversations
    return conversations.filter((conversation) => (
      conversation.title.toLowerCase().includes(normalizedQuery) ||
      conversation.lastMessage.toLowerCase().includes(normalizedQuery) ||
      conversation.participants.some((participant) => participant.name.toLowerCase().includes(normalizedQuery))
    ))
  }, [conversations, normalizedQuery])

  if (loading) {
    return <StateCard variant="loading" />
  }

  if (error && workspaces.length === 0) {
    return <StateCard variant="error" title="加载失败" description={error} />
  }

  return (
    <div className="flex min-h-[calc(100vh-88px)] flex-col gap-4">
      <section className="space-y-2" data-testid="mobile-workspace-list">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium">工作区</h2>
          <Badge variant="secondary">{workspaces.length}</Badge>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {workspaces.map(ws => (
            <button
              key={ws.id}
              type="button"
              onClick={() => void chooseWorkspace(ws.id)}
              className={`min-w-[11rem] rounded-lg border px-3 py-2 text-left transition-colors ${
                selectedWs === ws.id ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted'
              }`}
            >
              <span className="block truncate text-sm font-medium">{ws.name}</span>
              <span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={`h-1.5 w-1.5 rounded-full ${ws.execution_domain === 'cloud' ? 'bg-success' : 'bg-warning'}`} />
                {domainLabel(ws.execution_domain)}
              </span>
            </button>
          ))}
        </div>
        {workspaces.length === 0 && (
          <StateCard variant="empty" title="暂无工作区" description="请先在 Web 端创建工作区" />
        )}
      </section>

      {selectedWorkspace && (
        <section className="flex min-h-0 flex-1 flex-col gap-3" data-testid="mobile-conversation-list">
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">联系人和群聊</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {selectedWorkspace.name} · {domainLabel(selectedWorkspace.execution_domain)}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setCreatingGroup((value) => !value)}>
                <UsersRound className="mr-1 h-3.5 w-3.5" />
                群聊
              </Button>
            </div>
            <div className="mt-3 grid h-8 grid-cols-2 rounded-md border border-input bg-background p-0.5 text-xs">
              {([
                ['active', '活跃'],
                ['archived', '归档'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`rounded-sm px-2 font-medium transition-colors ${
                    status === value ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => { if (status !== value) void changeStatus(value) }}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="mt-3 flex h-9 items-center gap-2 rounded-md border border-input bg-background px-2 focus-within:ring-2 focus-within:ring-ring">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                data-testid="mobile-conversation-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索联系人、群聊或消息"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </label>
          </div>

          {creatingGroup && (
            <div data-testid="mobile-group-create-form" className="rounded-lg border border-border bg-card p-3">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="mobile-group-name">群聊名称</label>
              <input
                id="mobile-group-name"
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                placeholder="例如：产品交付小组"
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <div className="mt-3 max-h-40 space-y-1 overflow-y-auto">
                {contacts.map((contact) => (
                  <label key={contact.roleAgentId} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
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
                    <AgentHubAvatar name={contact.title} id={contact.roleAgentId} size="sm" />
                    <span className="min-w-0 flex-1 truncate">{contact.title}</span>
                  </label>
                ))}
                {contacts.length === 0 && <p className="text-xs text-muted-foreground">当前工作区还没有可加入的联系人。</p>}
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => setCreatingGroup(false)}>取消</Button>
                <Button size="sm" disabled={!groupName.trim() || selectedParticipants.length === 0} onClick={() => void createGroup()}>
                  创建
                </Button>
              </div>
            </div>
          )}

          {error && <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
          {conversationsLoading && conversations.length === 0 && <StateCard variant="loading" title="正在加载聊天" />}
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
            {filteredConversations.map(conversation => (
              <button
                key={conversation.id}
                type="button"
                data-testid={`mobile-conversation-item-${conversation.id}`}
                disabled={openingId === conversation.id}
                onClick={() => void openConversation(conversation)}
                className="flex w-full items-center gap-3 rounded-lg border border-transparent px-2 py-2.5 text-left transition-colors hover:border-border hover:bg-card disabled:opacity-60"
              >
                <AgentHubAvatar
                  name={conversation.title}
                  id={conversation.roleAgentId ?? conversation.id}
                  group={conversation.kind === 'group'}
                  size="md"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-medium">{conversation.title}</span>
                    {conversation.isPinned && <Badge variant="secondary">置顶</Badge>}
                    {conversation.status === 'archived' && <Badge variant="secondary">已归档</Badge>}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {conversation.lastMessage || (conversation.kind === 'contact'
                      ? '点按开始单聊'
                      : conversation.participants.length > 0
                        ? `成员：${conversation.participants.map((participant) => participant.name).join('、')}`
                        : '群聊暂无消息')}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatRelativeTime(conversation.lastActivityAt)}
                  </span>
                  <Badge variant={conversation.kind === 'contact' ? 'secondary' : 'default'} className="px-1.5 py-0 text-[10px]">
                    {conversation.kind === 'contact' ? '联系人' : '群聊'}
                  </Badge>
                </span>
              </button>
            ))}
            {!conversationsLoading && filteredConversations.length === 0 && (
              <StateCard
                variant="empty"
                title={query.trim() ? '没有匹配的聊天' : '暂无聊天'}
                description={query.trim() ? '换个关键词再试' : '点按联系人开始单聊，或创建一个群聊'}
              />
            )}
          </div>
        </section>
      )}

      {!selectedWorkspace && workspaces.length > 0 && (
        <section className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border bg-card/60 p-6 text-center">
          <div>
            <MessageCircle className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">请选择工作区</p>
            <p className="mt-1 text-xs text-muted-foreground">进入后可查看联系人、群聊、授权和产物预览。</p>
          </div>
        </section>
      )}
    </div>
  )
}
