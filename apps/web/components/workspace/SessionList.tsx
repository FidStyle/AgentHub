'use client'

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Badge, Button, StateCard, Tooltip } from '@agenthub/ui'
import { Archive, Check, Clock, MessageSquareText, Pin, PinOff, Plus, RotateCcw, Search, Trash2, UsersRound } from 'lucide-react'
import { useSessionStore } from '@/store/session-store'
import { AgentHubAvatar } from './AgentHubAvatar'

type GroupContact = {
  title: string
  roleAgentId?: string | null
  isOrchestrator?: boolean
}

type FloatingPosition = {
  top: number
  left: number
  width: number
  maxHeight: number
}

const FLOATING_MARGIN = 8
const FLOATING_GAP = 6
const GROUP_POPOVER_WIDTH = 320

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

function isOrchestratorContact(contact: GroupContact) {
  return Boolean(contact.isOrchestrator) || contact.title === '架构师' || contact.title === 'Orchestrator'
}

function sortedGroupContacts<T extends GroupContact>(contacts: T[]) {
  return [...contacts].sort((a, b) => {
    if (isOrchestratorContact(a) !== isOrchestratorContact(b)) return isOrchestratorContact(a) ? -1 : 1
    return 0
  })
}

function defaultGroupParticipantIds(contacts: GroupContact[]) {
  const orchestrator = contacts.find((contact) => isOrchestratorContact(contact) && contact.roleAgentId)
  return orchestrator?.roleAgentId ? [orchestrator.roleAgentId] : []
}

function computeGroupPopoverPosition(trigger: DOMRect): FloatingPosition {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const width = Math.min(GROUP_POPOVER_WIDTH, vw - FLOATING_MARGIN * 2)
  const spaceBelow = vh - trigger.bottom - FLOATING_GAP - FLOATING_MARGIN
  const spaceAbove = trigger.top - FLOATING_GAP - FLOATING_MARGIN
  const below = spaceBelow >= Math.min(360, spaceAbove)
  const available = Math.max(0, below ? spaceBelow : spaceAbove)
  const maxHeight = Math.min(420, available)
  const top = below ? trigger.bottom + FLOATING_GAP : Math.max(FLOATING_MARGIN, trigger.top - FLOATING_GAP - maxHeight)
  const left = Math.max(FLOATING_MARGIN, Math.min(trigger.right - width, vw - width - FLOATING_MARGIN))
  return { top, left, width, maxHeight }
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
  const [groupPopoverPos, setGroupPopoverPos] = useState<FloatingPosition | null>(null)
  const groupTriggerRef = useRef<HTMLButtonElement>(null)
  const normalized = query.trim().toLowerCase()
  const filtered = useMemo(() => {
    if (!normalized) return sessions
    return sessions.filter((session) =>
      session.title.toLowerCase().includes(normalized) ||
      session.lastMessage.toLowerCase().includes(normalized),
    )
  }, [normalized, sessions])
  const contacts = useMemo(
    () => sortedGroupContacts(sessions.filter((session) => session.kind === 'contact' && session.roleAgentId)),
    [sessions],
  )

  useLayoutEffect(() => {
    if (!creatingGroup || !groupTriggerRef.current) return
    const update = () => {
      if (!groupTriggerRef.current) return
      setGroupPopoverPos(computeGroupPopoverPosition(groupTriggerRef.current.getBoundingClientRect()))
    }
    update()
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null
      if (groupTriggerRef.current?.contains(target as Node) || target?.closest('[data-testid="group-create-form"]')) return
      setCreatingGroup(false)
    }
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
      document.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [creatingGroup])

  if (loading) {
    return <div data-testid="session-list"><StateCard variant="loading" /></div>
  }

  if (sessions.length === 0) {
    return (
      <div data-testid="session-list" className="flex h-full min-w-0 flex-col gap-2 overflow-x-hidden">
        <SessionStatusTabs value={sessionStatusFilter} onChange={setSessionStatusFilter} />
        <StateCard variant="empty" />
      </div>
    )
  }

  const handleArchive = async (sessionId: string, title: string) => {
    if (!confirm(`确定归档聊天「${title}」吗？归档后可在归档列表中恢复。`)) return
    await archiveSession(sessionId)
  }

  const handleRestore = async (sessionId: string) => {
    await restoreSession(sessionId)
  }

  const handleDelete = async (sessionId: string, title: string) => {
    if (!confirm(`确定删除聊天「${title}」吗？相关消息、计划和运行记录会一并删除。`)) return
    await deleteSession(sessionId)
  }
  const openGroupCreator = () => {
    setCreatingGroup((value) => {
      const next = !value
      setSelectedParticipants(next ? defaultGroupParticipantIds(contacts) : [])
      return next
    })
  }
  const submitGroup = async () => {
    if (!activeWorkspaceId || !groupName.trim() || selectedParticipants.length === 0) return
    await createGroupConversation({ workspaceId: activeWorkspaceId, name: groupName.trim(), participantRoleAgentIds: selectedParticipants })
    setCreatingGroup(false)
    setGroupName('')
    setSelectedParticipants([])
  }

  return (
    <div data-testid="session-list" className="flex h-full min-w-0 flex-col gap-2 overflow-x-hidden">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-medium">
          <MessageSquareText className="h-3.5 w-3.5 text-muted-foreground" />
          联系人与群聊
        </div>
        <div className="flex items-center gap-1">
          <Badge variant="secondary">{filtered.length}/{sessions.length}</Badge>
          <Tooltip content="新建群聊">
            <button
              ref={groupTriggerRef}
              type="button"
              aria-label="新建群聊"
              data-testid="new-group-conversation"
              className="relative rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={openGroupCreator}
            >
              <UsersRound className="h-3.5 w-3.5" />
              <Plus className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full bg-background" />
            </button>
          </Tooltip>
        </div>
      </div>
      <GroupCreatePopover
        open={creatingGroup}
        pos={groupPopoverPos}
        contacts={contacts}
        groupName={groupName}
        selectedParticipants={selectedParticipants}
        onNameChange={setGroupName}
        onToggleParticipant={(id) => {
          setSelectedParticipants((current) => current.includes(id)
            ? current.filter((item) => item !== id)
            : [...current, id])
        }}
        onCancel={() => setCreatingGroup(false)}
        onSubmit={() => void submitGroup()}
      />
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
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden">
        {filtered.length === 0 && <p className="px-2 py-3 text-xs text-muted-foreground">没有匹配的聊天</p>}
        {filtered.map((session) => (
          <div
            key={session.id}
            data-testid={`session-list-item-${session.id}`}
            className={`group w-full rounded-md border px-2 py-1.5 text-left transition-colors ${
              activeSessionId === (session.sessionId ?? session.id) ? 'border-border bg-background shadow-sm' : 'border-transparent hover:border-border hover:bg-background/70'
            }`}
          >
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={() => void openConversation(session)}
                className="shrink-0"
                aria-label={`打开 ${session.title}`}
              >
                <AgentHubAvatar name={session.title} id={session.roleAgentId ?? session.id} group={session.kind !== 'contact'} size="sm" />
              </button>
              <button
                type="button"
                onClick={() => void openConversation(session)}
                className="min-w-0 flex-1 text-left"
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-sm font-medium leading-5">{session.title}</span>
                  {session.isPinned && <Badge variant="secondary">置顶</Badge>}
                  {session.status === 'archived' && <Badge variant="secondary">已归档</Badge>}
                </span>
                <span className="block truncate text-xs leading-4 text-muted-foreground">
                  {session.lastMessage || (
                    session.participants && session.participants.length > 1
                      ? `成员：${session.participants.map((participant) => participant.name).join('、')}`
                      : '暂无最新消息'
                  )}
                </span>
              </button>
              <div className="flex max-w-[5.25rem] shrink-0 flex-col items-end gap-0.5 opacity-80 group-hover:opacity-100">
                <span className="flex items-center gap-1 whitespace-nowrap text-[11px] leading-4 text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {formatSessionTime(session.updatedAt)}
                </span>
                <div className="flex items-center gap-0.5">
                  {session.sessionId && (
                    <button
                      type="button"
                      aria-label={`${session.isPinned ? '取消置顶' : '置顶'} ${session.title}`}
                      data-testid={`pin-session-${session.sessionId}`}
                      className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      onClick={() => void pinSession(session.sessionId ?? session.id, !session.isPinned)}
                    >
                      {session.isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                    </button>
                  )}
                  {session.kind !== 'contact' && sessionStatusFilter === 'active' ? (
                    <button
                      type="button"
                      aria-label={`归档聊天 ${session.title}`}
                      data-testid={`archive-session-${session.id}`}
                      className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      onClick={() => handleArchive(session.id, session.title)}
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </button>
                  ) : session.kind !== 'contact' ? (
                    <button
                      type="button"
                      aria-label={`恢复聊天 ${session.title}`}
                      data-testid={`restore-session-${session.id}`}
                      className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      onClick={() => handleRestore(session.id)}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                  {session.kind !== 'contact' && (
                    <button
                      type="button"
                      aria-label={`删除聊天 ${session.title}`}
                      data-testid={`delete-session-${session.id}`}
                      className="rounded-sm p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => handleDelete(session.id, session.title)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function GroupCreatePopover({
  open,
  pos,
  contacts,
  groupName,
  selectedParticipants,
  onNameChange,
  onToggleParticipant,
  onCancel,
  onSubmit,
}: {
  open: boolean
  pos: FloatingPosition | null
  contacts: GroupContact[]
  groupName: string
  selectedParticipants: string[]
  onNameChange: (value: string) => void
  onToggleParticipant: (id: string) => void
  onCancel: () => void
  onSubmit: () => void
}) {
  if (!open) return null
  return createPortal(
    <div
      data-testid="group-create-form"
      style={{
        top: pos?.top ?? 0,
        left: pos?.left ?? 0,
        width: pos?.width ?? GROUP_POPOVER_WIDTH,
        maxHeight: pos?.maxHeight ?? 420,
        visibility: pos ? 'visible' : 'hidden',
      }}
      className="fixed z-50 overflow-y-auto rounded-lg border border-border bg-card p-3 text-xs text-card-foreground shadow-lg"
    >
      <input
        value={groupName}
        onChange={(event) => onNameChange(event.target.value)}
        placeholder="群聊名称"
        className="h-8 w-full rounded-md border border-input bg-background px-2 outline-none focus:ring-2 focus:ring-ring"
      />
      <div className="mt-3 space-y-1">
        {contacts.map((contact) => {
          const id = contact.roleAgentId ?? ''
          const selected = selectedParticipants.includes(id)
          return (
            <button
              key={id}
              type="button"
              data-testid={`group-participant-option-${id}`}
              aria-pressed={selected}
              className={`flex w-full items-center gap-2 rounded-md border px-2 py-2 text-left transition-colors ${
                selected ? 'border-primary bg-primary/5' : 'border-transparent hover:border-border hover:bg-muted'
              }`}
              onClick={() => {
                if (id) onToggleParticipant(id)
              }}
            >
              <AgentHubAvatar name={contact.title} id={id} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{contact.title}</span>
                {isOrchestratorContact(contact) && <Badge variant="warning" className="mt-1">架构师</Badge>}
              </span>
              {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
            </button>
          )
        })}
        {contacts.length === 0 && <p className="px-2 py-3 text-muted-foreground">当前工作区还没有可加入的联系人。</p>}
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button size="sm" variant="outline" onClick={onCancel}>取消</Button>
        <Button size="sm" disabled={!groupName.trim() || selectedParticipants.length === 0} onClick={onSubmit}>创建</Button>
      </div>
    </div>,
    document.body,
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
