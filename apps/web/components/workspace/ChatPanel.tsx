'use client'

import { useEffect, useState } from 'react'
import { Input, Card, StateCard, IconButton, Badge } from '@agenthub/ui'
import { Paperclip, AtSign, Send, PanelRight } from 'lucide-react'
import { useSessionStore } from '@/store/session-store'

interface RoleAgent {
  id: string
  name: string
  is_orchestrator: boolean
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
  const { sendMessage, activeSessionId } = useSessionStore()

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
        <div className="relative">
          <IconButton
            icon={AtSign}
            label="提及角色"
            variant="ghost"
            size="sm"
            data-testid="mention-role-btn"
            disabled={!activeSessionId}
            onClick={() => setPickerOpen((v) => !v)}
          />
          {pickerOpen && (
            <div
              data-testid="role-picker"
              className="absolute bottom-full left-0 mb-1 min-w-40 rounded-md border border-border bg-popover p-1 shadow-md z-10"
            >
              {roleAgents.length === 0 ? (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">暂无角色</div>
              ) : (
                roleAgents.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    data-testid={`role-option-${r.id}`}
                    className="flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                    onClick={() => {
                      setSelectedRole(r)
                      setPickerOpen(false)
                    }}
                  >
                    @{r.name}
                  </button>
                ))
              )}
            </div>
          )}
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
