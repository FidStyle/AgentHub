'use client'

import React from 'react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { StateCard, IconButton, Badge } from '@agenthub/ui'
import { AtSign, Copy, Pin, PinOff, Plus, Quote, RefreshCcw, Send, PanelRight, ShieldCheck, Square, WandSparkles, X } from 'lucide-react'
import { useSessionStore, type Message, type Session } from '@/store/session-store'
import { MessageContent } from './MessageContent'
import { AgentHubAvatar } from './AgentHubAvatar'
import { roleTypeLabel as configuredRoleTypeLabel } from '@/config/ui/role-type-labels'

interface RoleAgent {
  id: string
  name: string
  role_type?: string
  capability_tags?: string[] | null
  is_orchestrator: boolean
}

type QuotedMessage = {
  id: string
  author: string
  preview: string
  text?: string
  suggestedPrompt?: string
}

type ComposerQuoteEvent = {
  id?: string
  author?: string
  preview?: string
  text?: string
  suggestedPrompt?: string
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
  { value: 'standard', label: '标准', description: '工具执行前需要授权确认' },
  { value: 'auto', label: '自动规划', description: '按流程推进，工具执行仍需授权' },
  { value: 'full_control', label: '完全控制', description: '最大授权，保留审计和安全阻断' },
] as const
const SLASH_COMMANDS = [
  { command: '/plan', label: '生成计划', template: '请先制定执行计划，列出关键步骤、风险和验收方式。' },
  { command: '/review', label: '审查当前结果', template: '请审查当前实现，优先指出阻塞验收的问题、风险和缺失测试。' },
  { command: '/fix', label: '修复问题', template: '请定位并修复当前问题，完成后说明验证结果。' },
] as const
const SUGGESTED_TASKS = [
  { title: '生成可运行网页', prompt: '做一个生成姓名的网页，需存储姓名记录，使用 sqlite' },
  { title: '检查配置与依赖', prompt: '帮我检查当前项目配置、启动命令和潜在问题，并给出可执行修复建议' },
  { title: '整理文档产物', prompt: '根据当前需求生成一份结构清晰的说明文档，并作为产物保存' },
] as const

export function roleTypeLabel(role: RoleAgent) {
  return configuredRoleTypeLabel(role)
}

export function messagePreview(content: string, max = 96) {
  const normalized = content.replace(/\s+/g, ' ').trim()
  if (!normalized) return '空消息'
  return normalized.length > max ? `${normalized.slice(0, max)}...` : normalized
}

export function quotedContent(input: string, quoted: QuotedMessage | null) {
  const body = input.trim()
  if (!quoted) return body
  const quotedText = quoted.text?.trim()
  const block = quotedText ? `\n\n\`\`\`text\n${quotedText}\n\`\`\`` : ''
  return `> 引用 ${quoted.author}：${quoted.preview}${block}\n\n${body}`
}

export function messageAutoScrollSignature(messages: Message[]) {
  return messages
    .map((message) => [
      message.id,
      message.content.length,
      message.visibleStatus ?? '',
      message.streaming === true ? 'streaming' : '',
      message.parts?.map((part) => {
        if (part.type === 'permission') return `${part.type}:${part.actionId ?? ''}:${part.status}`
        if (part.type === 'publish_status') return `${part.type}:${part.status ?? ''}:${part.url ?? ''}`
        if (part.type === 'artifact') return `${part.type}:${part.artifactId ?? ''}:${part.status ?? ''}`
        if (part.type === 'diff') return `${part.type}:${part.actionId ?? ''}:${part.status ?? ''}`
        return part.type
      }).join('|') ?? '',
    ].join(':'))
    .join(';')
}

function roleById(roleAgents: RoleAgent[], id: string | null | undefined) {
  return roleAgents.find((role) => role.id === id) ?? null
}

function EmptyConversationPanel({
  conversation,
  composer,
}: {
  conversation: Session | null
  composer: React.ReactNode
}) {
  const title = conversation?.title ?? 'AgentHub'
  const isGroup = conversation?.kind === 'group'
  const subtitle = isGroup
    ? `群聊成员：${conversation?.participants?.map((participant) => participant.name).join('、') || '等待成员加入'}`
    : '随时在线，等待你的任务'

  const useSuggestion = (prompt: string) => {
    window.dispatchEvent(new CustomEvent('agenthub:quote-to-composer', {
      detail: {
        id: `suggestion-${Date.now()}`,
        author: title,
        preview: prompt,
        suggestedPrompt: prompt,
      },
    }))
  }

  return (
    <div data-testid="chat-empty-conversation" className="flex h-full min-h-0 flex-col overflow-y-auto px-5 py-8">
      <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col justify-center gap-8">
        <div className="flex items-center gap-4">
          <AgentHubAvatar name={title} id={conversation?.roleAgentId ?? conversation?.id} group={isGroup} size="lg" />
          <div className="min-w-0">
            <h2 className="truncate text-3xl font-semibold tracking-normal">{title}</h2>
            <p className="mt-1 truncate text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <div className="w-full">
          {composer}
        </div>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="font-medium">推荐</span>
            <span className="text-muted-foreground">办公学习</span>
            <span className="text-muted-foreground">电脑设置</span>
            <span className="text-muted-foreground">生活日常</span>
            <span className="text-muted-foreground">游戏娱乐</span>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {SUGGESTED_TASKS.map((item) => (
              <button
                key={item.title}
                type="button"
                data-testid="chat-suggested-task"
                className="min-h-32 rounded-xl border border-transparent bg-background/75 p-4 text-left shadow-sm transition-colors hover:border-border hover:bg-background"
                onClick={() => useSuggestion(item.prompt)}
              >
                <span className="block text-sm font-medium">{item.title}</span>
                <span className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">{item.prompt}</span>
                <span className="mt-4 block text-right text-muted-foreground">↑</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

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

export function PinnedContextPanel({
  pinnedMessages,
  roleName,
  onJumpToMessage,
}: {
  pinnedMessages: Message[]
  roleName: (id: string | null) => string | undefined
  onJumpToMessage: (messageId: string) => void
}) {
  if (pinnedMessages.length === 0) return null

  return (
    <section
      data-testid="pinned-context-panel"
      className="sticky top-0 z-10 rounded-md border border-border bg-background/95 p-3 shadow-sm backdrop-blur"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Pin className="h-4 w-4 text-muted-foreground" />
          <span>固定上下文</span>
          <Badge variant="secondary">{pinnedMessages.length}</Badge>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          固定上下文会在后续回复中持续带给智能体，适合放关键需求、约束或结论。
        </p>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {pinnedMessages.map((msg) => {
          const name = msg.role === 'agent' ? roleName(msg.roleAgentId) : '用户'
          const preview = msg.content.replace(/\s+/g, ' ').trim() || '空消息'
          return (
            <button
              key={msg.id}
              type="button"
              data-testid="pinned-context-jump"
              className="max-w-full rounded-md border border-border bg-muted/50 px-2 py-1 text-left text-xs leading-5 hover:bg-accent"
              onClick={() => onJumpToMessage(msg.id)}
              title={`定位到 ${name ?? '消息'}：${preview}`}
            >
              <span className="font-medium">{name ?? '智能体'}：</span>
              <span className="text-muted-foreground">{preview.slice(0, 72)}{preview.length > 72 ? '...' : ''}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function MessageList({
  roleAgents,
  onQuote,
}: {
  roleAgents: RoleAgent[]
  onQuote: (message: QuotedMessage) => void
}) {
  const { activeSessionId, messages, messagesRevision, loading, error, setMessagePinned, regenerateMessage } = useSessionStore()
  const [pinningId, setPinningId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null)
  const [focusedMessageId, setFocusedMessageId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const sessionMessages = activeSessionId ? messages.filter((m) => m.sessionId === activeSessionId) : []
  const pinnedMessages = sessionMessages.filter((m) => m.isPinned)
  const scrollSignature = messageAutoScrollSignature(sessionMessages)

  useEffect(() => {
    if (sessionMessages.length === 0 || focusedMessageId) return
    bottomRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' })
  }, [focusedMessageId, messagesRevision, scrollSignature, sessionMessages.length])

  const emptyFrame = (node: React.ReactNode) => (
    <div data-testid="message-list-empty-frame" className="min-h-0 flex-1 overflow-y-auto p-6">
      {node}
    </div>
  )

  if (loading) return emptyFrame(<StateCard variant="loading" />)
  if (error) return emptyFrame(<StateCard variant="error" />)
  if (!activeSessionId) return emptyFrame(null)
  if (sessionMessages.length === 0) return emptyFrame(null)

  const roleName = (id: string | null) => roleAgents.find((r) => r.id === id)?.name
  const messageAuthor = (msg: Message) => {
    if (msg.role === 'user') return '用户'
    return roleName(msg.roleAgentId) ?? '智能体'
  }
  const jumpToMessage = (messageId: string) => {
    setFocusedMessageId(messageId)
    document.getElementById(`message-${messageId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    window.setTimeout(() => setFocusedMessageId((current) => (current === messageId ? null : current)), 1400)
  }
  const copyMessage = async (msg: Message) => {
    await navigator.clipboard.writeText(msg.content)
    setCopiedId(msg.id)
    window.setTimeout(() => setCopiedId((current) => (current === msg.id ? null : current)), 1200)
  }

  return (
    <div data-testid="message-list-scroll" className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
      <PinnedContextPanel pinnedMessages={pinnedMessages} roleName={roleName} onJumpToMessage={jumpToMessage} />
      {sessionMessages.map((msg) => {
        const role = msg.role === 'agent' ? roleById(roleAgents, msg.roleAgentId) : null
        const name = msg.role === 'agent' ? role?.name ?? roleName(msg.roleAgentId) : undefined
        const canPin = !msg.id.startsWith('tmp-') && !msg.id.startsWith('reply-') && !msg.id.startsWith('sys-')
        const canRegenerate = msg.role === 'agent' && !msg.id.startsWith('tmp-') && !msg.id.startsWith('reply-') && !msg.id.startsWith('sys-')
        const isProcessMessage = msg.messageType === 'system_event' || msg.messageType === 'plan_card' || msg.messageType === 'result_card'
        const isUser = msg.role === 'user'
        return (
          <div
            key={msg.id}
            id={`message-${msg.id}`}
            data-message-id={msg.id}
            data-testid={isProcessMessage ? 'role-process-message' : 'chat-message'}
            className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex max-w-[82%] items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
              {!isUser && <AgentHubAvatar name={name ?? '智能体'} id={msg.roleAgentId} size="sm" className="mt-0.5" />}
              <div className={`min-w-0 rounded-2xl px-4 py-3 shadow-sm transition-shadow ${focusedMessageId === msg.id ? 'ring-2 ring-ring ring-offset-2 ring-offset-background' : ''} ${isUser ? 'bg-muted text-foreground' : 'border border-border bg-background/95'}`}>
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {name && (
                      <div data-testid="message-role-badge" className="truncate text-xs font-medium leading-5 text-muted-foreground">
                        {name}
                      </div>
                    )}
                    {msg.isPinned && (
                      <Badge data-testid="message-pinned-badge" variant="secondary" className={name ? 'mt-1' : ''}>
                        已固定
                      </Badge>
                    )}
                    {msg.visibleStatus && (
                      <Badge data-testid="message-status-badge" variant={
                        msg.visibleStatus === '等待授权' ? 'warning'
                          : msg.visibleStatus === '执行失败' ? 'destructive'
                            : msg.visibleStatus === '已完成' ? 'success'
                              : 'secondary'
                      } className={name || msg.isPinned ? 'mt-1' : ''}>
                        {msg.visibleStatus}
                      </Badge>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1 opacity-70 transition-opacity hover:opacity-100">
                    <IconButton
                      icon={Copy}
                      label={copiedId === msg.id ? '已复制' : '复制消息'}
                      variant="ghost"
                      size="sm"
                      data-testid="message-copy-btn"
                      disabled={!msg.content.trim()}
                      onClick={() => void copyMessage(msg)}
                    />
                    <IconButton
                      icon={Quote}
                      label="引用回复"
                      variant="ghost"
                      size="sm"
                      data-testid="message-quote-btn"
                      disabled={!msg.content.trim()}
                      onClick={() => onQuote({ id: msg.id, author: messageAuthor(msg), preview: messagePreview(msg.content) })}
                    />
                    {canRegenerate && (
                      <IconButton
                        icon={RefreshCcw}
                        label="重新生成"
                        variant="ghost"
                        size="sm"
                        data-testid="message-regenerate-btn"
                        disabled={regeneratingId === msg.id}
                        onClick={async () => {
                          setRegeneratingId(msg.id)
                          try {
                            await regenerateMessage(msg.id)
                          } finally {
                            setRegeneratingId(null)
                          }
                        }}
                      />
                    )}
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
                </div>
                <MessageContent content={msg.content} parts={msg.parts} streaming={msg.streaming === true} />
              </div>
            </div>
          </div>
        )
      })}
      <div ref={bottomRef} data-testid="message-list-bottom" aria-hidden="true" />
    </div>
  )
}

function MessageComposer({
  roleAgents,
  readOnly,
  readOnlyReason,
  onRefreshRuntimeStatus,
  quotedMessage,
  onClearQuote,
  variant = 'dock',
}: {
  roleAgents: RoleAgent[]
  readOnly: boolean
  readOnlyReason: string | null
  onRefreshRuntimeStatus: () => void
  quotedMessage: QuotedMessage | null
  onClearQuote: () => void
  variant?: 'dock' | 'home'
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
  const sessions = useSessionStore((state) => state.sessions)
  const activeConversation = sessions.find((session) => (session.sessionId ?? session.id) === activeSessionId) ?? null
  const directRole = activeConversation?.kind === 'contact' && activeConversation.roleAgentId
    ? roleAgents.find((role) => role.id === activeConversation.roleAgentId) ?? null
    : null
  const directMode = Boolean(directRole)
  const currentMode = PERMISSION_MODES.find((mode) => mode.value === permissionMode)
  const defaultRole = directRole ?? roleAgents.find((role) => role.is_orchestrator || role.name === 'Orchestrator') ?? roleAgents[0] ?? null
  const effectiveRoles = directRole ? [directRole] : selectedRoles.length > 0 ? selectedRoles : defaultRole ? [defaultRole] : []

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    setPickerOpen(false)
    setSelectedRoles([])
  }, [activeSessionId])

  useEffect(() => {
    if (!quotedMessage?.suggestedPrompt) return
    setInput((current) => current.trim() ? current : quotedMessage.suggestedPrompt ?? current)
  }, [quotedMessage])

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
        content: quotedContent(input, quotedMessage),
        roleAgentIds: effectiveRoles.map((role) => role.id),
        attachmentIds: attachments.map((attachment) => attachment.id),
        permissionMode,
        signal: controller.signal,
      })
      if (!controller.signal.aborted) {
        setInput('')
        setAttachments([])
        onClearQuote()
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

  const containerClass = variant === 'home'
    ? 'w-full'
    : 'shrink-0 px-5 pb-5 pt-2'
  const composerClass = variant === 'home'
    ? 'rounded-2xl border border-border bg-background/95 p-4 shadow-sm'
    : 'rounded-3xl border border-border bg-background/95 p-3 shadow-sm'

  return (
    <div data-testid="message-composer" className={containerClass}>
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
      <div className={composerClass}>
        <div data-testid="composer-input-row" className="flex items-end gap-3">
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
            placeholder={readOnly ? '只读模式下不能发送消息' : '请输入任务，交给我来帮你完成'}
            disabled={!activeSessionId || sending || readOnly}
            className={`${variant === 'home' ? 'min-h-20 text-lg' : 'min-h-16 text-base'} max-h-40 flex-1 resize-none border-0 bg-transparent px-0 py-2 leading-6 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50`}
          />
          {sending ? (
            <IconButton icon={Square} label="停止" data-testid="stop-btn" onClick={stopSending} disabled={!activeSessionId} className="h-10 w-10 rounded-full bg-muted text-foreground" />
          ) : (
            <IconButton icon={Send} label="发送" data-testid="send-btn" onClick={handleSend} disabled={!activeSessionId || !input.trim() || readOnly || uploadingAttachment} className="h-10 w-10 rounded-full bg-foreground text-background hover:bg-foreground/90" />
          )}
        </div>
        <div data-testid="composer-toolbar" className="mt-3 flex flex-wrap items-center gap-2">
          {!directMode && (
            <div ref={triggerRef} className="relative">
              <IconButton
                icon={AtSign}
                label="提及角色"
                variant="outline"
                size="sm"
                className="bg-background text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground"
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
          )}
          {selectedRoles.length === 0 && defaultRole && (
            <Badge data-testid="selected-role-default" variant="secondary">
              {directMode ? `单聊 @${defaultRole.name}` : `默认 @${defaultRole.name}`}
            </Badge>
          )}
          {!directMode && selectedRoles.map((role) => (
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
            variant="outline"
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
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {currentMode && <span>权限：{currentMode.label} · {currentMode.description}</span>}
          {attachments.length > 0 && <span>附件 {attachments.length} 个</span>}
          {uploadingAttachment && <span>附件上传中...</span>}
        </div>
        {attachmentError && <p className="mt-2 text-xs text-destructive">{attachmentError}</p>}
        {attachments.length > 0 && (
          <div data-testid="attachment-chips" className="mt-2 flex flex-wrap gap-1">
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
        {quotedMessage && (
          <div data-testid="composer-quote-preview" className="mt-2 flex items-start justify-between gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-xs">
            <div className="min-w-0">
              <div className="font-medium text-foreground">引用 {quotedMessage.author}</div>
              <p className="mt-1 line-clamp-2 text-muted-foreground">{quotedMessage.preview}</p>
            </div>
            <IconButton
              icon={X}
              label="取消引用"
              variant="ghost"
              size="sm"
              data-testid="composer-clear-quote"
              onClick={onClearQuote}
            />
          </div>
        )}
        {slashOpen && input.trim().startsWith('/') && (
          <div data-testid="slash-command-menu" className="mt-2 rounded-md border border-border bg-popover p-1 shadow-sm">
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
            className="flex w-full items-start gap-2 rounded-sm px-2 py-2 text-left text-sm hover:bg-accent"
            onClick={() => onSelect(r)}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-xs font-medium">
              {r.name.slice(0, 1)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate font-medium">@{r.name}</span>
                {r.is_orchestrator && <Badge variant="warning">编排</Badge>}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{roleTypeLabel(r)}</span>
              {r.capability_tags && r.capability_tags.length > 0 && (
                <span className="mt-1 flex flex-wrap gap-1">
                  {r.capability_tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="secondary" className="max-w-full truncate">
                      #{tag}
                    </Badge>
                  ))}
                </span>
              )}
            </span>
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
  const { activeSessionId, activeWorkspaceId, sessions, messages, loading, error } = useSessionStore()
  const [quotedMessage, setQuotedMessage] = useState<QuotedMessage | null>(null)
  const activeSession = sessions.find((s) => (s.sessionId ?? s.id) === activeSessionId)
  const roleAgents = useRoleAgents(activeWorkspaceId)
  const activeMessages = activeSessionId ? messages.filter((message) => message.sessionId === activeSessionId) : []
  const showHomeConversation = Boolean(activeSessionId && activeMessages.length === 0 && !loading && !error)
  const composer = (
    <MessageComposer
      roleAgents={roleAgents}
      readOnly={readOnly}
      readOnlyReason={readOnlyReason}
      onRefreshRuntimeStatus={onRefreshRuntimeStatus}
      quotedMessage={quotedMessage}
      onClearQuote={() => setQuotedMessage(null)}
      variant={showHomeConversation ? 'home' : 'dock'}
    />
  )

  useEffect(() => {
    const onQuote = (event: Event) => {
      const detail = (event as CustomEvent<ComposerQuoteEvent>).detail
      const text = typeof detail?.text === 'string' ? detail.text : ''
      const preview = typeof detail?.preview === 'string' && detail.preview.trim()
        ? detail.preview.trim()
        : messagePreview(text)
      setQuotedMessage({
        id: typeof detail?.id === 'string' ? detail.id : `external-${Date.now()}`,
        author: typeof detail?.author === 'string' && detail.author.trim() ? detail.author.trim() : '引用内容',
        preview,
        text: text.trim() ? text : undefined,
        suggestedPrompt: typeof detail?.suggestedPrompt === 'string' ? detail.suggestedPrompt : undefined,
      })
    }
    window.addEventListener('agenthub:quote-to-composer', onQuote)
    return () => window.removeEventListener('agenthub:quote-to-composer', onQuote)
  }, [])

  if (!activeSessionId) {
    return (
      <div data-testid="chat-panel" className="flex h-full min-h-0 border-r border-border bg-background">
        <div data-testid="chat-empty-selection" className="flex min-h-0 flex-1 items-center justify-center p-8">
          <p className="text-center text-xl font-medium text-muted-foreground">请选择联系人或者群聊</p>
        </div>
      </div>
    )
  }

  return (
    <div data-testid="chat-panel" className="flex h-full min-h-0 flex-col border-r border-border bg-muted/20">
      {!showHomeConversation && (
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-background/80 p-4">
          <h2 className="text-sm font-semibold">
            {activeSession?.title ?? '选择一个联系人或群聊'}
          </h2>
          <IconButton icon={PanelRight} label="切换面板" variant="ghost" size="sm" data-testid="toggle-artifact-btn" onClick={onTogglePanel} />
        </div>
      )}
      {showHomeConversation ? (
        <EmptyConversationPanel conversation={activeSession ?? null} composer={composer} />
      ) : (
        <>
          <MessageList roleAgents={roleAgents} onQuote={setQuotedMessage} />
          {composer}
        </>
      )}
    </div>
  )
}
