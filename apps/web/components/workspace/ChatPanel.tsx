'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Card, StateCard, IconButton, Badge, Button } from '@agenthub/ui'
import { AlertTriangle, AtSign, Pin, PinOff, Plus, Send, PanelRight, ShieldCheck, Square, WandSparkles } from 'lucide-react'
import { useSessionStore } from '@/store/session-store'
import type { RuntimeMessagePart } from '@agenthub/shared'
import { MessageMarkdown } from './MessageMarkdown'

interface RoleAgent {
  id: string
  name: string
  is_orchestrator: boolean
}

interface UploadedAttachment {
  id: string
  name: string
  type: string
  size: number
  contentRef: string
  preview?: string
}

const MARGIN = 8
const GAP = 4
const ROLE_PICKER_MAX_WIDTH = 320
const PERMISSION_MODES = [
  { value: 'sandbox', label: '沙箱', description: '写入和高风险动作需要授权' },
  { value: 'standard', label: '标准', description: '常规读写和构建可执行' },
  { value: 'auto', label: '自动执行', description: '本 Session 常规动作自动继续' },
  { value: 'full_control', label: '完全控制', description: '最大授权，保留审计和安全阻断' },
] as const
const SLASH_COMMANDS = [
  { command: '/plan', label: '生成计划', template: '请先制定执行计划，列出关键步骤、风险和验收方式。' },
  { command: '/review', label: '审查当前结果', template: '请审查当前实现，优先指出阻塞验收的问题、风险和缺失测试。' },
  { command: '/fix', label: '修复问题', template: '请定位并修复当前问题，完成后说明验证结果。' },
] as const
const STREAM_TICK_MS = 28
const STREAM_MIN_STEP = 1
const STREAM_MAX_STEP = 4

// role picker portal 定位（R1 portal-to-body / R2 flip / R3 clamp / R5 max-width / R8 popover 层）。
// 语义默认向上展开（对齐裸 absolute 的 bottom-full）；上方空间不足时翻下方；宽度对齐 trigger 与上限取大并 clamp；
// 高度受可用空间与视口 60% 双重 clamp，长列表内部滚动而非撑高页面。
function computeRolePicker(trigger: DOMRect): { top: number; left: number; width: number; maxHeight: number; placement: 'above' | 'below' } {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const spaceAbove = trigger.top - GAP - MARGIN
  const spaceBelow = vh - trigger.bottom - GAP - MARGIN
  const above = spaceAbove >= 120 || spaceAbove >= spaceBelow
  const avail = Math.max(0, above ? spaceAbove : spaceBelow)
  const maxHeight = Math.min(avail, Math.round(vh * 0.6))
  const width = Math.min(ROLE_PICKER_MAX_WIDTH, vw - 2 * MARGIN)
  const top = above ? Math.max(MARGIN, trigger.top - GAP) : trigger.bottom + GAP
  const left = Math.max(MARGIN, Math.min(trigger.left, vw - width - MARGIN))
  return { top, left, width, maxHeight, placement: above ? 'above' : 'below' }
}

function useRoleAgents(workspaceId: string | null) {
  const [roleAgents, setRoleAgents] = useState<RoleAgent[]>([])

  useEffect(() => {
    if (!workspaceId) {
      setRoleAgents([])
      return
    }
    const load = () => fetch(`/api/role-agents?workspace_id=${workspaceId}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: RoleAgent[]) => setRoleAgents(Array.isArray(data) ? data : []))
      .catch(() => setRoleAgents([]))
    void load()
    const onChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ workspaceId?: string }>).detail
      if (!detail?.workspaceId || detail.workspaceId === workspaceId) void load()
    }
    window.addEventListener('role-agents:changed', onChanged)
    return () => window.removeEventListener('role-agents:changed', onChanged)
  }, [workspaceId])

  return roleAgents
}

function MessageList({ roleAgents }: { roleAgents: RoleAgent[] }) {
  const { activeSessionId, messages, loading, error, setMessagePinned } = useSessionStore()
  const [pinningId, setPinningId] = useState<string | null>(null)

  if (loading) return <StateCard variant="loading" />
  if (error) return <StateCard variant="error" />
  if (!activeSessionId) return <StateCard variant="empty" />

  const sessionMessages = messages.filter((m) => m.sessionId === activeSessionId)

  if (sessionMessages.length === 0) return <StateCard variant="empty" />

  const roleName = (id: string | null) => roleAgents.find((r) => r.id === id)?.name

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-3">
      {sessionMessages.map((msg) => {
        const name = msg.role === 'agent' ? roleName(msg.roleAgentId) : undefined
        const canPin = !msg.id.startsWith('tmp-') && !msg.id.startsWith('reply-') && !msg.id.startsWith('sys-')
        return (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <Card className={`max-w-[75%] p-3 ${msg.role === 'user' ? 'bg-primary/10' : 'bg-muted'}`}>
              <div className="mb-1 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  {name && (
                    <Badge data-testid="message-role-badge" variant="secondary">
                      @{name}
                    </Badge>
                  )}
                  {msg.isPinned && (
                    <Badge data-testid="message-pinned-badge" variant="secondary" className={name ? 'ml-1' : ''}>
                      已固定
                    </Badge>
                  )}
                </div>
                {canPin && (
                  <IconButton
                    icon={msg.isPinned ? PinOff : Pin}
                    label={msg.isPinned ? '取消固定上下文' : '固定到上下文'}
                    variant="ghost"
                    size="sm"
                    data-testid={msg.isPinned ? 'message-unpin-btn' : 'message-pin-btn'}
                    disabled={pinningId === msg.id}
                    onClick={async () => {
                      setPinningId(msg.id)
                      try {
                        await setMessagePinned(msg.id, !msg.isPinned)
                      } finally {
                        setPinningId(null)
                      }
                    }}
                  />
                )}
              </div>
              <AgentMessageContent content={msg.content} parts={msg.parts} streaming={msg.streaming === true} />
            </Card>
          </div>
        )
      })}
    </div>
  )
}

function nextStreamStep(pending: number) {
  if (pending <= 0) return 0
  if (pending > 80) return STREAM_MAX_STEP
  if (pending > 28) return 3
  if (pending > 10) return 2
  return STREAM_MIN_STEP
}

function useSmoothStreamingText(content: string, streaming: boolean) {
  const [visible, setVisible] = useState(content)

  useEffect(() => {
    if (!streaming) {
      setVisible(content)
      return
    }
    setVisible((current) => {
      if (content.startsWith(current)) return current
      return content
    })
  }, [content, streaming])

  useEffect(() => {
    if (!streaming) return
    const timer = window.setInterval(() => {
      setVisible((current) => {
        if (!content.startsWith(current)) return content
        const pending = content.length - current.length
        if (pending <= 0) return current
        return content.slice(0, current.length + nextStreamStep(pending))
      })
    }, STREAM_TICK_MS)
    return () => window.clearInterval(timer)
  }, [content, streaming])

  return visible
}

function ThinkingIndicator() {
  return (
    <div data-testid="message-thinking" className="flex items-center gap-2 py-1 text-[13px] leading-[20px] text-muted-foreground">
      <span>思考中</span>
      <span className="flex items-center gap-1" aria-hidden="true">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-160ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-80ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
      </span>
    </div>
  )
}

function PartPreview({ value }: { value: unknown }) {
  if (value === undefined || value === null || value === '') return null
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  return <pre className="mt-2 max-h-32 overflow-auto rounded-md bg-background/70 p-2 text-xs">{text}</pre>
}

function PermissionPartCard({ part }: { part: Extract<RuntimeMessagePart, { type: 'permission' }> }) {
  const [decision, setDecision] = useState<'idle' | 'approving' | 'rejecting' | 'approved' | 'rejected' | 'error'>('idle')
  const canDecide = part.status === 'pending' && Boolean(part.actionId) && decision === 'idle'
  const decide = async (approved: boolean) => {
    if (!part.actionId) return
    setDecision(approved ? 'approving' : 'rejecting')
    try {
      const res = await fetch(`/api/actions/${part.actionId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error || '授权请求处理失败')
      }
      setDecision(approved ? 'approved' : 'rejected')
    } catch {
      setDecision('error')
    }
  }
  const statusText = {
    idle: '待确认',
    approving: '授权中',
    rejecting: '拒绝中',
    approved: '已允许本次执行',
    rejected: '已拒绝',
    error: '处理失败',
  }[decision]

  return (
    <div data-testid="message-permission-card" className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-medium">
          <AlertTriangle className="h-3.5 w-3.5" />
          {part.title ?? '需要授权'}
        </span>
        <Badge variant="warning">{part.riskLevel ?? '待确认'}</Badge>
      </div>
      <p className="mt-1 text-muted-foreground">{part.description}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-muted-foreground">{statusText}</span>
        {part.actionId ? (
          <div className="flex gap-2">
            <Button size="sm" disabled={!canDecide} onClick={() => void decide(true)}>
              允许单次执行
            </Button>
            <Button size="sm" variant="outline" disabled={!canDecide} onClick={() => void decide(false)}>
              拒绝
            </Button>
          </div>
        ) : (
          <span className="text-muted-foreground">缺少动作编号，无法在此处授权</span>
        )}
      </div>
      {decision === 'error' && <p className="mt-2 text-destructive">授权请求处理失败，请刷新后重试。</p>}
    </div>
  )
}

function RuntimePartCard({ part }: { part: RuntimeMessagePart }) {
  if (part.type === 'tool') {
    return (
      <div data-testid="message-tool-card" className="rounded-md border border-border bg-background/70 p-2 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium">工具：{part.toolName}</span>
          <Badge variant={part.status === 'completed' ? 'success' : part.status === 'failed' ? 'destructive' : 'warning'}>
            {part.status === 'completed' ? '完成' : part.status === 'failed' ? '失败' : '运行中'}
          </Badge>
        </div>
        <PartPreview value={part.input} />
        <PartPreview value={part.delta} />
        <PartPreview value={part.result} />
      </div>
    )
  }
  if (part.type === 'permission') {
    return <PermissionPartCard part={part} />
  }
  if (part.type === 'question') {
    return (
      <div data-testid="message-question-card" className="rounded-md border border-border bg-background/70 p-2 text-xs">
        <div className="font-medium">{part.title ?? '需要确认'}</div>
        <p className="mt-1 text-muted-foreground">{part.content}</p>
      </div>
    )
  }
  if (part.type === 'diff') {
    return (
      <div data-testid="message-diff-card" className="rounded-md border border-border bg-background/70 p-2 text-xs">
        <div className="font-medium">{part.path ? `Diff：${part.path}` : 'Diff'}</div>
        <pre className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-2">{part.diff}</pre>
      </div>
    )
  }
  return (
    <div data-testid="message-artifact-card" className="rounded-md border border-border bg-background/70 p-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{part.title}</span>
        <Badge variant="secondary">{part.artifactType}</Badge>
      </div>
      {part.sourcePath && <p className="mt-1 text-muted-foreground">来源：{part.sourcePath}</p>}
    </div>
  )
}

function AgentMessageContent({ content, parts, streaming }: { content: string; parts?: RuntimeMessagePart[]; streaming?: boolean }) {
  const visibleContent = useSmoothStreamingText(content, streaming === true)
  const hasVisibleContent = visibleContent.trim().length > 0
  return (
    <div className="space-y-2">
      {hasVisibleContent ? (
        <MessageMarkdown content={visibleContent} streaming={streaming === true && visibleContent.length < content.length} />
      ) : streaming ? (
        <ThinkingIndicator />
      ) : null}
      {streaming && hasVisibleContent && visibleContent.length >= content.length && (
        <div className="mt-1">
          <ThinkingIndicator />
        </div>
      )}
      {parts?.map((part) => <RuntimePartCard key={part.id} part={part} />)}
    </div>
  )
}

function MessageComposer({
  roleAgents,
  readOnly,
  readOnlyReason,
  onRefreshRuntimeStatus,
}: {
  roleAgents: RoleAgent[]
  readOnly: boolean
  readOnlyReason: string | null
  onRefreshRuntimeStatus: () => void
}) {
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [selectedRoles, setSelectedRoles] = useState<RoleAgent[]>([])
  const [permissionMode, setPermissionMode] = useState<(typeof PERMISSION_MODES)[number]['value']>('standard')
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([])
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  const [uploadingAttachment, setUploadingAttachment] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [slashOpen, setSlashOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number; width: number; maxHeight: number; placement: 'above' | 'below' } | null>(null)
  const [mounted, setMounted] = useState(false)
  const triggerRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const { sendMessage, activeSessionId } = useSessionStore()
  const currentMode = PERMISSION_MODES.find((mode) => mode.value === permissionMode)
  const defaultRole = roleAgents.find((role) => role.is_orchestrator || role.name === 'Orchestrator') ?? roleAgents[0] ?? null
  const effectiveRoles = selectedRoles.length > 0 ? selectedRoles : defaultRole ? [defaultRole] : []

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
    if (!input.trim() || !activeSessionId || sending || readOnly) return
    setSending(true)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      await sendMessage({
        content: input.trim(),
        roleAgentIds: effectiveRoles.map((role) => role.id),
        attachmentIds: attachments.map((attachment) => attachment.id),
        permissionMode,
        signal: controller.signal,
      })
      if (!controller.signal.aborted) {
        setInput('')
        setAttachments([])
        setSlashOpen(false)
      }
    } finally {
      abortRef.current = null
      setSending(false)
    }
  }

  const stopSending = () => {
    abortRef.current?.abort()
  }

  const uploadFiles = async (files: File[]) => {
    if (!activeSessionId || readOnly || files.length === 0) return
    setUploadingAttachment(true)
    setAttachmentError(null)
    try {
      const uploaded: UploadedAttachment[] = []
      for (const file of files) {
        const form = new FormData()
        form.append('session_id', activeSessionId)
        form.append('file', file)
        const res = await fetch('/api/attachments', { method: 'POST', body: form })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error((body as { error?: string }).error || `上传附件失败（${res.status}）`)
        uploaded.push(body as UploadedAttachment)
      }
      setAttachments((current) => {
        const seen = new Set(current.map((attachment) => attachment.id))
        return [...current, ...uploaded.filter((attachment) => !seen.has(attachment.id))]
      })
    } catch (error) {
      setAttachmentError(error instanceof Error ? error.message : '上传附件失败')
    } finally {
      setUploadingAttachment(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div data-testid="message-composer" className="shrink-0 border-t border-border p-4">
      {readOnly && (
        <div data-testid="readonly-composer-gate" className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
          <span>{readOnlyReason ?? '当前为只读模式，不能继续执行本地任务。'}</span>
          <button
            type="button"
            className="rounded border border-warning/50 px-2 py-1 hover:bg-warning/10"
            onClick={onRefreshRuntimeStatus}
          >
            刷新连接状态
          </button>
        </div>
      )}
      <div className="rounded-lg border border-border bg-background p-2 shadow-sm">
        <div data-testid="composer-toolbar" className="mb-2 flex flex-wrap items-center gap-2">
          <div ref={triggerRef} className="relative">
            <IconButton
              icon={AtSign}
              label="提及角色"
              variant="ghost"
              size="sm"
              data-testid="mention-role-btn"
              disabled={!activeSessionId || readOnly}
              onClick={() => setPickerOpen((v) => !v)}
            />
            <RolePicker
              open={mounted && pickerOpen}
              pos={pos}
              roleAgents={roleAgents}
              onSelect={(r) => {
                setSelectedRoles((current) => current.some((role) => role.id === r.id) ? current : [...current, r])
                setPickerOpen(false)
              }}
            />
          </div>
          {selectedRoles.length === 0 && defaultRole && (
            <Badge data-testid="selected-role-default" variant="secondary">
              默认 @{defaultRole.name}
            </Badge>
          )}
          {selectedRoles.map((role) => (
            <Badge key={role.id} data-testid="selected-role" variant="secondary">
              @{role.name}
              <button
                type="button"
                aria-label="取消选择角色"
                className="ml-1"
                onClick={() => setSelectedRoles((current) => current.filter((item) => item.id !== role.id))}
              >
                ×
              </button>
            </Badge>
          ))}
          <IconButton
            icon={Plus}
            label={uploadingAttachment ? '上传中...' : '添加附件或上下文'}
            variant="ghost"
            size="sm"
            data-testid="attachment-btn"
            disabled={!activeSessionId || readOnly || uploadingAttachment}
            onClick={() => fileRef.current?.click()}
          />
          <input
            ref={fileRef}
            data-testid="attachment-file-input"
            type="file"
            multiple
            className="hidden"
            onChange={(event) => {
              void uploadFiles(Array.from(event.target.files ?? []))
            }}
          />
          <label className="ml-auto flex items-center gap-1 rounded-md border border-border bg-muted/30 px-2 py-1 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span className="sr-only">权限预设</span>
            <select
              data-testid="permission-mode-select"
              value={permissionMode}
              disabled={!activeSessionId || readOnly}
              onChange={(event) => setPermissionMode(event.target.value as typeof permissionMode)}
              className="h-6 rounded border-0 bg-transparent px-1 text-xs text-foreground outline-none"
            >
              {PERMISSION_MODES.map((mode) => (
                <option key={mode.value} value={mode.value}>{mode.label}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {currentMode && <span>权限：{currentMode.label} · {currentMode.description}</span>}
          {attachments.length > 0 && <span>附件 {attachments.length} 个</span>}
          {uploadingAttachment && <span>附件上传中...</span>}
        </div>
        {attachmentError && <p className="mb-2 text-xs text-destructive">{attachmentError}</p>}
        {attachments.length > 0 && (
          <div data-testid="attachment-chips" className="mb-2 flex flex-wrap gap-1">
            {attachments.map((attachment) => (
              <Badge key={attachment.id} variant="secondary" className="max-w-full">
                <span className="max-w-[180px] truncate">{attachment.name}</span>
                <button
                  type="button"
                  aria-label={`移除附件 ${attachment.name}`}
                  className="ml-1"
                  onClick={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))}
                >
                  ×
                </button>
              </Badge>
            ))}
          </div>
        )}
        {slashOpen && input.trim().startsWith('/') && (
          <div data-testid="slash-command-menu" className="mb-2 rounded-md border border-border bg-popover p-1 shadow-sm">
            {SLASH_COMMANDS
              .filter((item) => item.command.startsWith(input.trim()))
              .map((item) => (
                <button
                  key={item.command}
                  type="button"
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                  onClick={() => {
                    setInput(item.template)
                    setSlashOpen(false)
                  }}
                >
                  <WandSparkles className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{item.command}</span>
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                </button>
              ))}
          </div>
        )}
        <div data-testid="composer-input-row" className="flex items-end gap-2">
          <textarea
            data-testid="composer-input"
            value={input}
            rows={1}
            onChange={(e) => {
              setInput(e.target.value)
              setSlashOpen(e.target.value.trim().startsWith('/'))
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setSlashOpen(false)
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void handleSend()
              }
            }}
            placeholder={readOnly ? '只读模式下不能发送消息' : effectiveRoles.length > 0 ? `发送给 ${effectiveRoles.map((role) => `@${role.name}`).join('、')}...` : '输入消息...'}
            disabled={!activeSessionId || sending || readOnly}
            className="max-h-40 min-h-10 flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
          {sending ? (
            <IconButton icon={Square} label="停止" data-testid="stop-btn" onClick={stopSending} disabled={!activeSessionId} />
          ) : (
            <IconButton icon={Send} label="发送" data-testid="send-btn" onClick={handleSend} disabled={!activeSessionId || !input.trim() || readOnly || uploadingAttachment} />
          )}
        </div>
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
  pos: { top: number; left: number; width: number; maxHeight: number; placement: 'above' | 'below' } | null
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
        transform: pos?.placement === 'above' ? 'translateY(-100%)' : undefined,
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

export function ChatPanel({
  onTogglePanel,
  readOnly = false,
  readOnlyReason = null,
  onRefreshRuntimeStatus = () => undefined,
}: {
  onTogglePanel: () => void
  readOnly?: boolean
  readOnlyReason?: string | null
  onRefreshRuntimeStatus?: () => void
}) {
  const { activeSessionId, activeWorkspaceId, sessions } = useSessionStore()
  const activeSession = sessions.find((s) => s.id === activeSessionId)
  const roleAgents = useRoleAgents(activeWorkspaceId)

  return (
    <div data-testid="chat-panel" className="flex h-full min-h-0 flex-col border-r border-border">
      <div className="shrink-0 flex items-center justify-between p-4 border-b border-border">
        <h2 className="text-sm font-semibold">
          {activeSession?.title ?? '选择一个会话'}
        </h2>
        <IconButton icon={PanelRight} label="切换面板" variant="ghost" size="sm" data-testid="toggle-artifact-btn" onClick={onTogglePanel} />
      </div>
      <MessageList roleAgents={roleAgents} />
      <MessageComposer
        roleAgents={roleAgents}
        readOnly={readOnly}
        readOnlyReason={readOnlyReason}
        onRefreshRuntimeStatus={onRefreshRuntimeStatus}
      />
    </div>
  )
}
