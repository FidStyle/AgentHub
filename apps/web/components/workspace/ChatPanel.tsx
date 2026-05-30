'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Input, Card, StateCard, IconButton, Badge } from '@agenthub/ui'
import { Paperclip, AtSign, Send, PanelRight } from 'lucide-react'
import { useSessionStore } from '@/store/session-store'

interface RoleAgent {
  id: string
  name: string
  is_orchestrator: boolean
}

const MARGIN = 8
const GAP = 4
const ROLE_PICKER_MAX_WIDTH = 320

// role picker portal 定位（R1 portal-to-body / R2 flip / R3 clamp / R5 max-width / R8 popover 层）。
// 语义默认向上展开（对齐裸 absolute 的 bottom-full）；上方空间不足时翻下方；宽度对齐 trigger 与上限取大并 clamp；
// 高度受可用空间与视口 60% 双重 clamp，长列表内部滚动而非撑高页面。
function computeRolePicker(trigger: DOMRect): { top: number; left: number; width: number; maxHeight: number } {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const spaceAbove = trigger.top - GAP - MARGIN
  const spaceBelow = vh - trigger.bottom - GAP - MARGIN
  const above = spaceAbove >= spaceBelow
  const avail = Math.max(0, above ? spaceAbove : spaceBelow)
  const maxHeight = Math.min(avail, Math.round(vh * 0.6))
  const width = Math.min(ROLE_PICKER_MAX_WIDTH, vw - 2 * MARGIN)
  const top = above ? Math.max(MARGIN, trigger.top - GAP - maxHeight) : trigger.bottom + GAP
  const left = Math.max(MARGIN, Math.min(trigger.left, vw - width - MARGIN))
  return { top, left, width, maxHeight }
}

function useRoleAgents(workspaceId: string | null) {
  const [roleAgents, setRoleAgents] = useState<RoleAgent[]>([])

  useEffect(() => {
    if (!workspaceId) {
      setRoleAgents([])
      return
    }
    fetch(`/api/role-agents?workspace_id=${workspaceId}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: RoleAgent[]) => setRoleAgents(Array.isArray(data) ? data : []))
      .catch(() => setRoleAgents([]))
  }, [workspaceId])

  return roleAgents
}

function MessageList({ roleAgents }: { roleAgents: RoleAgent[] }) {
  const { activeSessionId, messages, loading, error } = useSessionStore()

  if (loading) return <StateCard variant="loading" />
  if (error) return <StateCard variant="error" />
  if (!activeSessionId) return <StateCard variant="empty" />

  const sessionMessages = messages.filter((m) => m.sessionId === activeSessionId)

  if (sessionMessages.length === 0) return <StateCard variant="empty" />

  const roleName = (id: string | null) => roleAgents.find((r) => r.id === id)?.name

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {sessionMessages.map((msg) => {
        const name = msg.role === 'agent' ? roleName(msg.roleAgentId) : undefined
        return (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <Card className={`max-w-[75%] p-3 ${msg.role === 'user' ? 'bg-primary/10' : 'bg-muted'}`}>
              {name && (
                <Badge data-testid="message-role-badge" variant="secondary" className="mb-1">
                  {name}
                </Badge>
              )}
              <p className="text-sm">{msg.content}</p>
            </Card>
          </div>
        )
      })}
    </div>
  )
}

function MessageComposer({ roleAgents }: { roleAgents: RoleAgent[] }) {
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [selectedRole, setSelectedRole] = useState<RoleAgent | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null)
  const [mounted, setMounted] = useState(false)
  const triggerRef = useRef<HTMLDivElement>(null)
  const { sendMessage, activeSessionId } = useSessionStore()

  useEffect(() => setMounted(true), [])

  useLayoutEffect(() => {
    if (!pickerOpen || !triggerRef.current) return
    const update = () => {
      if (!triggerRef.current) return
      setPos(computeRolePicker(triggerRef.current.getBoundingClientRect()))
    }
    update()
    // 点击 trigger / picker 之外关闭（不用全屏 backdrop，避免遮挡并拦截 trigger 二次点击）。
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Element | null
      if (triggerRef.current?.contains(t as Node) || t?.closest('[data-testid="role-picker"]')) return
      setPickerOpen(false)
    }
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
      document.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [pickerOpen, roleAgents.length])

  const handleSend = async () => {
    if (!input.trim() || !activeSessionId || sending) return
    setSending(true)
    await sendMessage(input.trim(), selectedRole?.id)
    setInput('')
    setSending(false)
  }

  return (
    <div data-testid="message-composer" className="flex flex-col gap-2 p-4 border-t border-border">
      <div data-testid="composer-toolbar" className="flex items-center gap-2">
        <div ref={triggerRef} className="relative">
          <IconButton
            icon={AtSign}
            label="提及角色"
            variant="ghost"
            size="sm"
            data-testid="mention-role-btn"
            disabled={!activeSessionId}
            onClick={() => setPickerOpen((v) => !v)}
          />
          <RolePicker
            open={mounted && pickerOpen}
            pos={pos}
            roleAgents={roleAgents}
            onSelect={(r) => {
              setSelectedRole(r)
              setPickerOpen(false)
            }}
          />
        </div>
        {selectedRole && (
          <Badge data-testid="selected-role" variant="secondary">
            @{selectedRole.name}
            <button
              type="button"
              aria-label="取消选择角色"
              className="ml-1"
              onClick={() => setSelectedRole(null)}
            >
              ×
            </button>
          </Badge>
        )}
        <IconButton icon={Paperclip} label="附件" variant="ghost" size="sm" disabled={!activeSessionId} />
      </div>
      <div data-testid="composer-input-row" className="flex gap-2">
        <Input
          data-testid="composer-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder={selectedRole ? `@${selectedRole.name} 输入消息...` : '输入消息...'}
          disabled={!activeSessionId || sending}
        />
        <IconButton icon={Send} label={sending ? '发送中...' : '发送'} data-testid="send-btn" onClick={handleSend} disabled={!activeSessionId || !input.trim() || sending} />
      </div>
    </div>
  )
}

function RolePicker({
  open,
  pos,
  roleAgents,
  onSelect,
}: {
  open: boolean
  pos: { top: number; left: number; width: number; maxHeight: number } | null
  roleAgents: RoleAgent[]
  onSelect: (r: RoleAgent) => void
}) {
  if (!open) return null
  return createPortal(
    <div
      data-testid="role-picker"
      style={{
        top: pos?.top ?? 0,
        left: pos?.left ?? 0,
        width: pos?.width ?? 0,
        minWidth: 160,
        maxHeight: pos?.maxHeight ?? 0,
        visibility: pos ? 'visible' : 'hidden',
      }}
      className="fixed z-50 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md"
    >
      {roleAgents.length === 0 ? (
        <div className="px-2 py-1.5 text-sm text-muted-foreground">暂无角色</div>
      ) : (
        roleAgents.map((r) => (
          <button
            key={r.id}
            type="button"
            data-testid={`role-option-${r.id}`}
            className="flex w-full items-start rounded-sm px-2 py-1.5 text-left text-sm break-words hover:bg-accent"
            onClick={() => onSelect(r)}
          >
            @{r.name}
          </button>
        ))
      )}
    </div>,
    document.body,
  )
}

export function ChatPanel({ onTogglePanel }: { onTogglePanel: () => void }) {
  const { activeSessionId, activeWorkspaceId, sessions } = useSessionStore()
  const activeSession = sessions.find((s) => s.id === activeSessionId)
  const roleAgents = useRoleAgents(activeWorkspaceId)

  return (
    <div data-testid="chat-panel" className="flex flex-col h-full border-r border-border">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="text-sm font-semibold">
          {activeSession?.title ?? '选择一个会话'}
        </h2>
        <IconButton icon={PanelRight} label="切换面板" variant="ghost" size="sm" data-testid="toggle-artifact-btn" onClick={onTogglePanel} />
      </div>
      <MessageList roleAgents={roleAgents} />
      <MessageComposer roleAgents={roleAgents} />
    </div>
  )
}
