'use client'

import React, { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Button, Input, StateCard, Badge } from '@agenthub/ui'
import { ChevronLeft, ExternalLink, FileText, GitBranch, Globe2, Paperclip, PlayCircle, Presentation, RefreshCcw, Rocket, ShieldCheck, Square, UserPlus } from 'lucide-react'
import { createRuntimeOutputAccumulator, type Message, type Plan, type PlanNode, type PlanNodeControl, type RuntimeMessagePart, type RuntimeOutputEvent } from '@agenthub/shared'
import { AgentHubAvatar } from '@/components/workspace/AgentHubAvatar'
import { MobileActionCard, type MobilePermissionAction } from './mobile-permission-readback'

interface RoleAgent {
  id: string
  name: string
  is_orchestrator: boolean
}

interface SessionDetail {
  id: string
  name?: string | null
  workspace_id: string
  chat_kind?: string | null
  direct_role_agent_id?: string | null
  participant_role_agent_ids?: string[] | null
  metadata?: Record<string, unknown> | null
}

type PlanWithNodes = Plan & { plan_nodes?: PlanNode[] }

// Runtime terminal events must surface a clear status, never silence or a fake success.
// Shown as a system notice (no role_agent_id) so it is not mistaken for a real agent answer.
const statusText: Record<string, string> = {
  endpoint_unavailable: '⚠️ 公共云端 Runtime 未就绪，请稍后再试或切换到本地 Desktop 运行时',
  local_runtime_offline: '⚠️ 本地 Desktop 运行时离线，未收到回复',
  tunnel_disconnected: '⚠️ 本地运行时连接已断开，未收到回复',
  runtime_failed: '⚠️ 运行时执行失败，未收到回复',
}

function messageParts(metadata: Message['metadata']): RuntimeMessagePart[] {
  const parts = metadata?.runtimeParts
  if (!Array.isArray(parts)) return []
  return parts.filter((part): part is RuntimeMessagePart => (
    Boolean(part) && typeof part === 'object' && typeof (part as { id?: unknown }).id === 'string'
  ))
}


function partStatusVariant(status: string): 'secondary' | 'default' | 'warning' | 'success' | 'destructive' {
  if (status === 'pending' || status === 'running') return 'warning'
  if (status === 'completed' || status === 'approved' || status === 'created' || status === 'stopped') return 'success'
  if (status === 'failed' || status === 'rejected' || status === 'unavailable') return 'destructive'
  return 'secondary'
}

function previewHref(part: RuntimeMessagePart) {
  if (part.type === 'artifact' && part.artifactId) return part.previewUrl ?? `/m/preview?artifactId=${part.artifactId}`
  if ((part.type === 'document_preview' || part.type === 'presentation_preview') && part.artifactId) return part.previewUrl ?? `/m/preview?artifactId=${part.artifactId}`
  if (part.type === 'web_preview') return part.iframeUrl ?? part.url ?? null
  if (part.type === 'image_preview') return part.url ?? part.downloadUrl ?? null
  if (part.type === 'attachment') return part.downloadUrl ?? null
  return null
}

function MobilePartShell({
  testId,
  icon,
  title,
  badge,
  children,
  actions,
  tone = 'default',
}: {
  testId: string
  icon: React.ReactNode
  title: string
  badge?: React.ReactNode
  children?: React.ReactNode
  actions?: React.ReactNode
  tone?: 'default' | 'warning' | 'success' | 'danger'
}) {
  const toneClass = tone === 'warning'
    ? 'border-warning/40 bg-warning/10'
    : tone === 'success'
      ? 'border-success/30 bg-success/10'
      : tone === 'danger'
        ? 'border-destructive/35 bg-destructive/10'
        : 'border-border bg-background/80'
  return (
    <div data-testid={testId} className={`mt-2 rounded-lg border p-2.5 text-xs ${toneClass}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 font-medium">
          {icon}
          <span className="min-w-0 truncate">{title}</span>
        </div>
        {badge}
      </div>
      {children}
      {actions && <div className="mt-2 flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

function MobileLinkButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-background px-3 text-xs font-medium transition-colors hover:bg-muted"
    >
      {children}
    </a>
  )
}

function MobilePartCard({
  part,
  onApprove,
  onPublish,
  publishingArtifactId,
}: {
  part: RuntimeMessagePart
  onApprove: (actionId: string, approved: boolean) => void | Promise<void>
  onPublish: (artifactId: string, action: 'start' | 'stop') => void | Promise<void>
  publishingArtifactId: string | null
}) {
  if (part.type === 'tool') {
    return (
      <MobilePartShell
        testId="mobile-tool-card"
        icon={<Rocket className="h-3.5 w-3.5 text-muted-foreground" />}
        title={`工具执行：${part.toolName}`}
        badge={<Badge variant={partStatusVariant(part.status)}>{part.status === 'completed' ? '完成' : part.status === 'failed' ? '失败' : '运行中'}</Badge>}
      >
        {part.delta && <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-muted-foreground">{part.delta}</p>}
      </MobilePartShell>
    )
  }
  if (part.type === 'permission') {
    const statusText = part.autoApproved
      ? part.status === 'completed' ? '已自动通过并执行' : '已自动通过'
      : part.status === 'pending' ? '需要授权' : part.status === 'rejected' ? '已拒绝' : part.status === 'failed' ? '执行失败' : '已允许'
    const pending = part.status === 'pending' && Boolean(part.actionId)
    return (
      <MobilePartShell
        testId="mobile-permission-card"
        icon={<ShieldCheck className="h-3.5 w-3.5" />}
        title={part.title ?? '需要授权'}
        badge={<Badge variant={statusText.includes('失败') || statusText === '已拒绝' ? 'destructive' : part.status === 'pending' ? 'warning' : 'success'}>{statusText}</Badge>}
        tone={part.status === 'failed' || part.status === 'rejected' ? 'danger' : part.status === 'pending' ? 'warning' : 'success'}
        actions={pending && part.actionId ? (
          <>
            <Button size="sm" onClick={() => void onApprove(part.actionId!, true)}>允许本次</Button>
            <Button size="sm" variant="outline" onClick={() => void onApprove(part.actionId!, false)}>拒绝</Button>
          </>
        ) : null}
      >
        <p className="mt-1 text-muted-foreground">{part.description}</p>
        {(part.commandPreview || part.cwd || part.targetPaths?.length) && (
          <dl className="mt-2 grid gap-1 rounded-md bg-background/70 p-2 text-[11px] leading-4">
            {part.commandPreview && (
              <div className="grid grid-cols-[52px_minmax(0,1fr)] gap-2">
                <dt className="text-muted-foreground">命令</dt>
                <dd className="break-words font-mono">{part.commandPreview}</dd>
              </div>
            )}
            {part.cwd && (
              <div className="grid grid-cols-[52px_minmax(0,1fr)] gap-2">
                <dt className="text-muted-foreground">目录</dt>
                <dd className="break-words font-mono">{part.cwd}</dd>
              </div>
            )}
            {part.targetPaths && part.targetPaths.length > 0 && (
              <div className="grid grid-cols-[52px_minmax(0,1fr)] gap-2">
                <dt className="text-muted-foreground">路径</dt>
                <dd className="break-words font-mono">{part.targetPaths.join('\n')}</dd>
              </div>
            )}
          </dl>
        )}
      </MobilePartShell>
    )
  }
  if (part.type === 'agent_draft') {
    return (
      <MobilePartShell
        testId="mobile-agent-draft-card"
        icon={<UserPlus className="h-3.5 w-3.5 text-primary" />}
        title={`Agent 草稿：${part.draft.name}`}
        badge={<Badge variant={part.status === 'created' ? 'success' : 'secondary'}>{part.status === 'created' ? '已保存' : '待确认'}</Badge>}
      >
        <p className="mt-1 text-muted-foreground">请在 Web 端确认保存为联系人。</p>
        <p className="mt-1 break-words text-muted-foreground">工具边界：{part.draft.enabled_tool_ids.join('、') || '未启用工具'}</p>
      </MobilePartShell>
    )
  }
  if (part.type === 'diff') {
    return (
      <MobilePartShell
        testId="mobile-diff-card"
        icon={<GitBranch className="h-3.5 w-3.5 text-muted-foreground" />}
        title={part.path ? `Diff：${part.path}` : 'Diff'}
        badge={<Badge variant="secondary">只读</Badge>}
      >
        <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-2 text-[11px] leading-4">{part.diff}</pre>
      </MobilePartShell>
    )
  }
  if (part.type === 'change_summary') {
    return (
      <MobilePartShell
        testId="mobile-change-summary-card"
        icon={<GitBranch className="h-3.5 w-3.5 text-muted-foreground" />}
        title={part.title ?? 'Git 变更摘要'}
        badge={<Badge variant={part.files.length > 0 ? 'warning' : 'secondary'}>{part.files.length} 个文件</Badge>}
      >
        {part.summary && <p className="mt-1 text-muted-foreground">{part.summary}</p>}
        {part.files.length > 0 && (
          <div className="mt-2 space-y-1">
            {part.files.slice(0, 3).map((file) => (
              <p key={file.path} className="truncate rounded bg-muted px-2 py-1 font-mono text-[11px]">{file.status ?? 'modified'} · {file.path}</p>
            ))}
          </div>
        )}
      </MobilePartShell>
    )
  }
  if (part.type === 'artifact') {
    const href = previewHref(part)
    return (
      <MobilePartShell
        testId="mobile-artifact-card"
        icon={<FileText className="h-3.5 w-3.5 text-muted-foreground" />}
        title={part.title}
        badge={<Badge variant="secondary">{part.artifactType}</Badge>}
        actions={href ? (
          <MobileLinkButton href={href}>
            <ExternalLink className="mr-1 h-3.5 w-3.5" />
            打开
          </MobileLinkButton>
        ) : null}
      >
        {part.sourcePath && <p className="mt-1 truncate text-muted-foreground">{part.sourcePath}</p>}
      </MobilePartShell>
    )
  }
  if (part.type === 'image_preview') {
    const href = previewHref(part)
    return (
      <MobilePartShell
        testId="mobile-image-preview-card"
        icon={<FileText className="h-3.5 w-3.5 text-muted-foreground" />}
        title={part.title}
        badge={<Badge variant={partStatusVariant(part.status)}>{part.status === 'created' ? '可预览' : '不可用'}</Badge>}
        actions={href ? <MobileLinkButton href={href}>打开</MobileLinkButton> : null}
      >
        {part.sourcePath && <p className="mt-1 text-muted-foreground">{part.sourcePath}</p>}
      </MobilePartShell>
    )
  }
  if (part.type === 'document_preview' || part.type === 'presentation_preview') {
    const href = previewHref(part)
    const isPresentation = part.type === 'presentation_preview'
    return (
      <MobilePartShell
        testId={isPresentation ? 'mobile-presentation-preview-card' : 'mobile-document-preview-card'}
        icon={isPresentation ? <Presentation className="h-3.5 w-3.5 text-muted-foreground" /> : <FileText className="h-3.5 w-3.5 text-muted-foreground" />}
        title={part.title}
        badge={<Badge variant={part.status === 'created' ? 'success' : 'destructive'}>{isPresentation ? '演示稿' : '文档'}</Badge>}
        actions={href ? (
          <MobileLinkButton href={href}>
            <ExternalLink className="mr-1 h-3.5 w-3.5" />
            预览
          </MobileLinkButton>
        ) : null}
      >
        {part.summary && <p className="mt-1 text-muted-foreground">{part.summary}</p>}
        {part.sourcePath && <p className="mt-1 truncate text-muted-foreground">{part.sourcePath}</p>}
      </MobilePartShell>
    )
  }
  if (part.type === 'question') {
    return (
      <MobilePartShell
        testId="mobile-question-card"
        icon={<ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />}
        title={part.title ?? '需要确认'}
        badge={<Badge variant="warning">待确认</Badge>}
        tone="warning"
      >
        <p className="mt-1 text-muted-foreground">{part.content}</p>
      </MobilePartShell>
    )
  }
  if (part.type === 'web_preview') {
    const href = previewHref(part)
    return (
      <MobilePartShell
        testId="mobile-web-preview-card"
        icon={<Globe2 className="h-3.5 w-3.5 text-muted-foreground" />}
        title={part.title}
        badge={<Badge variant={part.status === 'created' ? 'success' : 'destructive'}>{part.status === 'created' ? '网页预览' : '不可用'}</Badge>}
        actions={href ? <MobileLinkButton href={href}>打开</MobileLinkButton> : null}
      >
        {(part.description || part.url) && <p className="mt-1 break-words text-muted-foreground">{part.description ?? part.url}</p>}
      </MobilePartShell>
    )
  }
  if (part.type === 'publish_status') {
    const canStart = Boolean(part.artifactId && part.status !== 'running')
    const canStop = Boolean(part.artifactId && part.status === 'running')
    const busy = publishingArtifactId === part.artifactId
    return (
      <MobilePartShell
        testId="mobile-publish-status-card"
        icon={<Rocket className="h-3.5 w-3.5 text-muted-foreground" />}
        title={part.title}
        badge={<Badge variant={part.status === 'failed' ? 'destructive' : part.status === 'running' ? 'warning' : 'secondary'}>{part.status === 'running' ? '运行中' : part.status === 'failed' ? '失败' : part.status === 'stopped' ? '已停止' : '待启动'}</Badge>}
        tone={part.status === 'failed' ? 'danger' : part.status === 'running' ? 'warning' : 'default'}
        actions={part.artifactId ? (
          <>
            {canStart && (
              <Button size="sm" disabled={busy} onClick={() => void onPublish(part.artifactId!, 'start')}>
                <PlayCircle className="mr-1 h-3.5 w-3.5" />
                {busy ? '启动中' : '启动'}
              </Button>
            )}
            {canStop && (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void onPublish(part.artifactId!, 'stop')}>
                <Square className="mr-1 h-3.5 w-3.5" />
                {busy ? '停止中' : '停止'}
              </Button>
            )}
            {part.url && <MobileLinkButton href={part.url}>打开</MobileLinkButton>}
          </>
        ) : null}
      >
        {(part.message || part.error || part.url || part.port) && (
          <div className="mt-1 space-y-1 text-muted-foreground">
            {part.message && <p>{part.message}</p>}
            {part.error && <p className="text-destructive">{part.error}</p>}
            {part.url && <p className="break-words">URL：{part.url}</p>}
            {part.port && <p>端口：{part.port}</p>}
          </div>
        )}
      </MobilePartShell>
    )
  }
  const fallbackTitle = part.type === 'attachment'
    ? part.name
    : '消息卡片'
  const fallbackContent = part.type === 'attachment'
    ? part.contentRef
    : ''
  const href = previewHref(part)
  return (
    <MobilePartShell
      testId="mobile-question-card"
      icon={<FileText className="h-3.5 w-3.5 text-muted-foreground" />}
      title={fallbackTitle}
      actions={href ? <MobileLinkButton href={href}>打开</MobileLinkButton> : null}
    >
      {fallbackContent && <p className="mt-1 text-muted-foreground">{fallbackContent}</p>}
    </MobilePartShell>
  )
}

const nodeStatusLabel: Record<string, string> = {
  pending: '等待',
  ready: '就绪',
  waiting: '等待',
  running: '执行中',
  completed: '完成',
  failed: '失败',
  blocked: '阻塞',
  cancelled: '取消',
  skipped: '跳过',
}

const nodeStatusVariant: Record<string, 'secondary' | 'default' | 'warning' | 'success' | 'destructive'> = {
  pending: 'secondary',
  ready: 'default',
  waiting: 'secondary',
  running: 'warning',
  completed: 'success',
  failed: 'destructive',
  blocked: 'destructive',
  cancelled: 'secondary',
  skipped: 'secondary',
}

function formatMessageTime(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(date)
}

function nodeControls(node: PlanNode): Array<{ control: PlanNodeControl; label: string; icon: typeof RefreshCcw }> {
  if (node.status === 'failed' || node.status === 'blocked') {
    return [
      { control: 'retry', label: '重试', icon: RefreshCcw },
      { control: 'resume', label: '恢复', icon: PlayCircle },
    ]
  }
  return []
}

export default function MobileSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const [messages, setMessages] = useState<Message[]>([])
  const [sessionInfo, setSessionInfo] = useState<SessionDetail | null>(null)
  const [roleAgents, setRoleAgents] = useState<RoleAgent[]>([])
  const [plans, setPlans] = useState<PlanWithNodes[]>([])
  const [actions, setActions] = useState<MobilePermissionAction[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [publishingArtifactId, setPublishingArtifactId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadPlans = async () => {
    const res = await fetch(`/api/plans?session_id=${sessionId}`)
    if (!res.ok) return
    const body = await res.json()
    if (Array.isArray(body)) setPlans(body)
  }

  const loadActions = async () => {
    const res = await fetch(`/api/actions?session_id=${sessionId}`)
    if (!res.ok) return
    const body = await res.json()
    if (Array.isArray(body)) setActions(body)
  }

  // Resolve the session's workspace, then its role agents. GET /api/role-agents auto-seeds the
  // default Orchestrator, guaranteeing at least one role context for the default strategy.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/messages?session_id=${sessionId}`)
      .then(async (r) => {
        const body = await r.json().catch(() => null)
        if (!r.ok) {
          const detail = body && typeof body === 'object' && 'error' in body ? String((body as { error?: unknown }).error) : r.statusText
          throw new Error(detail || '消息读取失败')
        }
        return body
      })
      .then(d => {
        if (!cancelled) {
          if (Array.isArray(d)) {
            setMessages(d)
          } else {
            setMessages([])
            setError('消息读取失败：响应格式不正确')
          }
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setMessages([])
          setError(err.message || '消息读取失败')
        }
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    loadPlans().catch(() => undefined)
    loadActions().catch(() => undefined)

    fetch(`/api/sessions/${sessionId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(s => {
        if (cancelled || !s?.workspace_id) return
        setSessionInfo(s as SessionDetail)
        return fetch(`/api/role-agents?workspace_id=${s.workspace_id}`)
          .then(r => (r.ok ? r.json() : []))
          .then(rs => { if (!cancelled && Array.isArray(rs)) setRoleAgents(rs) })
      })
    return () => { cancelled = true }
  }, [sessionId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const roleName = (id: string | null) => roleAgents.find(r => r.id === id)?.name
  const defaultRole = sessionInfo?.direct_role_agent_id
    ? roleAgents.find(r => r.id === sessionInfo.direct_role_agent_id) ?? null
    : roleAgents.find(r => r.is_orchestrator) ?? roleAgents[0] ?? null
  const participantIds = [
    ...(Array.isArray(sessionInfo?.participant_role_agent_ids) ? sessionInfo?.participant_role_agent_ids ?? [] : []),
    ...(Array.isArray(sessionInfo?.metadata?.participant_role_agent_ids) ? sessionInfo?.metadata?.participant_role_agent_ids as string[] : []),
  ].filter((value, index, array) => value && array.indexOf(value) === index)
  const participantNames = sessionInfo?.direct_role_agent_id
    ? [roleName(sessionInfo.direct_role_agent_id) ?? sessionInfo.name ?? '联系人']
    : participantIds.map((id) => roleName(id)).filter((name): name is string => Boolean(name))
  const conversationTitle = sessionInfo?.direct_role_agent_id
    ? roleName(sessionInfo.direct_role_agent_id) ?? sessionInfo.name ?? '单聊'
    : sessionInfo?.name ?? '群聊'
  const isDirectSession = Boolean(sessionInfo?.direct_role_agent_id)
  const pendingActions = actions.filter((action) => action.status === 'pending')

  const reloadMessages = async () => {
    const res = await fetch(`/api/messages?session_id=${sessionId}`)
    if (!res.ok) return
    const body = await res.json().catch(() => null)
    if (Array.isArray(body)) setMessages(body)
  }

  const controlNode = async (nodeId: string, control: PlanNodeControl) => {
    const res = await fetch(`/api/plan-nodes/${nodeId}/${control}`, { method: 'POST' })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError((body as { error?: string }).error || '计划节点操作失败')
      return
    }
    await loadPlans()
  }

  const approveAction = async (actionId: string, approved: boolean) => {
    const res = await fetch(`/api/actions/${actionId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError((body as { error?: string }).error || '授权动作失败')
      return
    }
    await loadActions()
    await reloadMessages()
  }

  const publishArtifact = async (artifactId: string, action: 'start' | 'stop') => {
    setPublishingArtifactId(artifactId)
    setError(null)
    try {
      const res = await fetch(`/api/artifacts/${artifactId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((body as { error?: string }).error || (action === 'start' ? '启动失败' : '停止失败'))
      await Promise.all([loadActions(), reloadMessages()])
    } catch (e) {
      setError(e instanceof Error ? e.message : action === 'start' ? '启动失败' : '停止失败')
    } finally {
      setPublishingArtifactId(null)
    }
  }

  // Mirrors the Web sendMessage runtime path: POST /api/chat, stream SSE, accumulate
  // runtime_output deltas into one agent reply, map terminal events to explicit notices.
  const send = async () => {
    if (!input.trim() || sending) return
    const content = input.trim()
    const roleAgentId = defaultRole?.id ?? null
    setSending(true)
    setError(null)

    const optimistic = {
      id: `tmp-${Date.now()}`,
      session_id: sessionId,
      sender_type: 'user',
      role_agent_id: roleAgentId,
      content,
    } as unknown as Message
    setMessages(m => [...m, optimistic])
    setInput('')

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          content,
          roleAgentId,
          roleAgentIds: roleAgentId ? [roleAgentId] : [],
          mentions: roleAgentId ? [roleAgentId] : null,
        }),
      })
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({ error: res.statusText }))
        setError(body.error || '发送失败，请重试')
        return
      }

      const replyId = `reply-${Date.now()}`
      let reply = ''
      const replyAccumulator = createRuntimeOutputAccumulator()
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let noticed = false
      let respondingRoleAgentId = roleAgentId

      const upsertReply = () => {
        setMessages(prev => {
          const exists = prev.some(m => m.id === replyId)
          if (!exists) {
            return [...prev, { id: replyId, session_id: sessionId, sender_type: 'agent', role_agent_id: respondingRoleAgentId, content: reply } as unknown as Message]
          }
          return prev.map(m => (m.id === replyId ? ({ ...m, content: reply } as Message) : m))
        })
      }

      const showNotice = (text: string) => {
        setMessages(prev => [...prev, { id: `sys-${Date.now()}`, session_id: sessionId, sender_type: 'agent', role_agent_id: null, content: text } as unknown as Message])
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const frames = buffer.split('\n\n')
        buffer = frames.pop() ?? ''
        for (const frame of frames) {
          const line = frame.trim()
          if (!line.startsWith('data:')) continue
          let evt: { type?: string; delta?: string; mode?: RuntimeOutputEvent['mode']; seq?: number; roleAgentId?: string | null }
          try {
            evt = JSON.parse(line.slice(5).trim())
          } catch {
            continue
          }
          if (evt.type === 'role_selected' && evt.roleAgentId) {
            respondingRoleAgentId = evt.roleAgentId
          }
          if (evt.type === 'runtime_output' && evt.delta) {
            reply = replyAccumulator.append(evt as RuntimeOutputEvent)
            upsertReply()
          } else if (evt.type && statusText[evt.type] && !reply && !noticed) {
            noticed = true
            showNotice(statusText[evt.type])
          }
        }
      }
    } catch {
      setError('网络错误，请检查连接')
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return <StateCard variant="loading" />
  }

  return (
    <div data-testid="mobile-chat-session" className="flex h-[calc(100vh-120px)] flex-col overflow-hidden">
      <header data-testid="mobile-chat-header" className="shrink-0 rounded-lg border border-border bg-card px-3 py-2.5">
        <div className="flex items-center gap-3">
          <Link href="/m" aria-label="返回聊天列表" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-background hover:bg-muted">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <AgentHubAvatar
            name={conversationTitle}
            id={sessionInfo?.direct_role_agent_id ?? sessionInfo?.id ?? sessionId}
            group={!isDirectSession}
            size="sm"
          />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="truncate text-sm font-semibold">{conversationTitle}</h2>
              <Badge variant={isDirectSession ? 'secondary' : 'default'}>{isDirectSession ? '单聊' : '群聊'}</Badge>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {participantNames.length > 0 ? participantNames.join('、') : '等待联系人信息'}
            </p>
          </div>
          {pendingActions.length > 0 && <Badge variant="warning">{pendingActions.length} 个待授权</Badge>}
        </div>
      </header>

      {(plans.length > 0 || actions.length > 0) && (
        <section data-testid="mobile-session-status-strip" className="mt-3 shrink-0 space-y-2 rounded-lg border border-border bg-card p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <GitBranch className="h-4 w-4 text-muted-foreground" />
              会话进度
            </div>
            <div className="flex items-center gap-1">
              {plans.length > 0 && <Badge variant="secondary">{plans.length} 个计划</Badge>}
              {actions.length > 0 && <Badge variant={pendingActions.length > 0 ? 'warning' : 'secondary'}>{actions.length} 条授权</Badge>}
            </div>
          </div>
          {plans.slice(0, 1).map((plan) => {
            const nodes = plan.plan_nodes ?? []
            const completed = nodes.filter((node) => node.status === 'completed').length
            return (
              <div key={plan.id} data-testid="mobile-plan-supervision" className="rounded-md border border-border bg-background p-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{plan.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{completed}/{nodes.length} 个节点完成</p>
                  </div>
                  <Badge variant={plan.status === 'running' ? 'warning' : plan.status === 'failed' ? 'destructive' : 'secondary'}>
                    {plan.status === 'running' ? '执行中' : plan.status === 'failed' ? '失败' : plan.status}
                  </Badge>
                </div>
                <div className="mt-2 space-y-1">
                  {nodes.slice(0, 3).map((node) => (
                    <div key={node.id} className="flex items-center gap-1.5 rounded border border-border px-2 py-1">
                      <span className="min-w-0 flex-1 truncate text-xs">{node.label}</span>
                      <Badge variant={nodeStatusVariant[node.status] ?? 'secondary'}>
                        {nodeStatusLabel[node.status] ?? node.status}
                      </Badge>
                      {nodeControls(node).map((item) => {
                        const ControlIcon = item.icon
                        return (
                          <Button
                            key={item.control}
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={() => controlNode(node.id, item.control)}
                          >
                            <ControlIcon className="mr-1 h-3 w-3" />
                            {item.label}
                          </Button>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
          {actions.length > 0 && (
            <div data-testid="mobile-permission-readback" className="space-y-2">
              {(pendingActions.length > 0 ? pendingActions : actions.slice(0, 1)).map((action) => (
                <MobileActionCard key={action.id} action={action} onApprove={approveAction} />
              ))}
            </div>
          )}
        </section>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto py-3">
        {error && messages.length === 0 ? (
          <StateCard variant="error" title="消息读取失败" description={error} />
        ) : messages.length === 0 && (
          <StateCard variant="empty" title="暂无消息" description="发送第一条消息开始对话" />
        )}
        <div className="flex flex-col gap-3">
          {messages.map(msg => {
            const isUser = msg.sender_type === 'user'
            const isSystem = msg.sender_type === 'system' || (!isUser && !msg.role_agent_id)
            const name = !isUser && !isSystem ? roleName(msg.role_agent_id) : undefined
            const parts = !isUser ? messageParts(msg.metadata) : []
            const time = formatMessageTime(msg.created_at)
            return (
              <div
                key={msg.id}
                data-testid="mobile-message-row"
                className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'} ${isSystem ? 'px-4' : ''}`}
              >
                {!isUser && !isSystem && (
                  <AgentHubAvatar name={name ?? 'Agent'} id={msg.role_agent_id} size="sm" />
                )}
                <div className={`min-w-0 ${isUser ? 'max-w-[82%]' : isSystem ? 'max-w-full flex-1' : 'max-w-[84%]'}`}>
                  {(name || time) && !isUser && !isSystem && (
                    <div className="mb-1 flex items-center gap-2 px-1">
                      {name && <span data-testid="message-role-badge" className="truncate text-xs font-medium text-muted-foreground">{name}</span>}
                      {time && <span className="text-[11px] text-muted-foreground">{time}</span>}
                    </div>
                  )}
                  <div className={`rounded-lg px-3 py-2 shadow-sm ${isUser ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}>
                    <p className="whitespace-pre-wrap break-words text-sm leading-5">{msg.content}</p>
                    {parts.map((part) => (
                      <MobilePartCard
                        key={part.id}
                        part={part}
                        onApprove={approveAction}
                        onPublish={publishArtifact}
                        publishingArtifactId={publishingArtifactId}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <div ref={bottomRef} />
      </div>

      <div data-testid="mobile-message-composer" className="shrink-0 border-t border-border bg-background pt-2">
        {error && <p className="mb-2 rounded-md bg-destructive/10 px-2 py-1.5 text-xs text-destructive">{error}</p>}
        <div className="mb-2 flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2 py-1.5 text-xs text-muted-foreground">
          <Paperclip className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate">附件上传和产物编辑请在 Web 工作台处理</span>
          {defaultRole && <Badge variant="secondary">@{defaultRole.name}</Badge>}
        </div>
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder={defaultRole ? `输入给 ${defaultRole.name} 的消息...` : '正在加载联系人...'}
            className="min-w-0 flex-1"
          />
          <Button onClick={send} disabled={sending || !input.trim() || !defaultRole} size="sm">
            {sending ? '发送中' : '发送'}
          </Button>
        </div>
      </div>
    </div>
  )
}
