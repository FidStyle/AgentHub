'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { Button, Input, Card, CardContent, StateCard, Badge } from '@agenthub/ui'
import { GitBranch, Paperclip, PlayCircle, RefreshCcw, ShieldCheck } from 'lucide-react'
import { createRuntimeOutputAccumulator, type Message, type Plan, type PlanNode, type PlanNodeControl, type RuntimeMessagePart, type RuntimeOutputEvent } from '@agenthub/shared'
import { MobileActionCard, type MobilePermissionAction } from './mobile-permission-readback'

interface RoleAgent {
  id: string
  name: string
  is_orchestrator: boolean
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


function MobilePartCard({ part }: { part: RuntimeMessagePart }) {
  if (part.type === 'tool') {
    return (
      <div data-testid="mobile-tool-card" className="mt-2 rounded border border-border bg-background/70 p-2 text-xs">
        <div className="flex justify-between gap-2">
          <span>工具：{part.toolName}</span>
          <Badge variant={part.status === 'completed' ? 'success' : 'warning'}>
            {part.status === 'completed' ? '完成' : '运行中'}
          </Badge>
        </div>
      </div>
    )
  }
  if (part.type === 'permission') {
    const statusText = part.autoApproved
      ? part.status === 'completed' ? '已自动通过并执行' : '已自动通过'
      : part.status === 'pending' ? '需要授权' : part.status === 'rejected' ? '已拒绝' : part.status === 'failed' ? '执行失败' : '已允许'
    return (
      <div data-testid="mobile-permission-card" className="mt-2 rounded border border-warning/40 bg-warning/10 p-2 text-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="font-medium">{part.title ?? '需要授权'}</div>
          <Badge variant={statusText.includes('失败') || statusText === '已拒绝' ? 'destructive' : part.status === 'pending' ? 'warning' : 'success'}>{statusText}</Badge>
        </div>
        <p className="mt-1 text-muted-foreground">{part.description}</p>
      </div>
    )
  }
  if (part.type === 'diff') {
    return (
      <div data-testid="mobile-diff-card" className="mt-2 rounded border border-border bg-background/70 p-2 text-xs">
        <div className="font-medium">{part.path ? `Diff：${part.path}` : 'Diff'}</div>
      </div>
    )
  }
  if (part.type === 'artifact') {
    return (
      <div data-testid="mobile-artifact-card" className="mt-2 rounded border border-border bg-background/70 p-2 text-xs">
        <div className="flex justify-between gap-2">
          <span className="font-medium">{part.title}</span>
          <Badge variant="secondary">{part.artifactType}</Badge>
        </div>
      </div>
    )
  }
  if (part.type === 'question') {
    return (
      <div data-testid="mobile-question-card" className="mt-2 rounded border border-border bg-background/70 p-2 text-xs">
        <div className="font-medium">{part.title ?? '需要确认'}</div>
        <p className="mt-1 text-muted-foreground">{part.content}</p>
      </div>
    )
  }
  const fallbackTitle = part.type === 'attachment'
    ? part.name
    : part.type === 'web_preview'
      ? part.title
      : part.type === 'publish_status'
        ? part.title
        : '消息卡片'
  const fallbackContent = part.type === 'attachment'
    ? part.contentRef
    : part.type === 'web_preview'
      ? part.description ?? part.url
      : part.type === 'publish_status'
        ? part.message ?? part.url
        : ''
  return (
    <div data-testid="mobile-question-card" className="mt-2 rounded border border-border bg-background/70 p-2 text-xs">
      <div className="font-medium">{fallbackTitle}</div>
      {fallbackContent && <p className="mt-1 text-muted-foreground">{fallbackContent}</p>}
    </div>
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
  const [roleAgents, setRoleAgents] = useState<RoleAgent[]>([])
  const [plans, setPlans] = useState<PlanWithNodes[]>([])
  const [actions, setActions] = useState<MobilePermissionAction[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
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
        return fetch(`/api/role-agents?workspace_id=${s.workspace_id}`)
          .then(r => (r.ok ? r.json() : []))
          .then(rs => { if (!cancelled && Array.isArray(rs)) setRoleAgents(rs) })
      })
    return () => { cancelled = true }
  }, [sessionId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const defaultRole = roleAgents.find(r => r.is_orchestrator) ?? roleAgents[0] ?? null
  const roleName = (id: string | null) => roleAgents.find(r => r.id === id)?.name

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
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {plans.length > 0 && (
        <div data-testid="mobile-plan-supervision" className="mb-3 space-y-2 rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-medium">计划监督</h2>
            <Badge variant="secondary">{plans.length}</Badge>
          </div>
          <div className="space-y-2">
            {plans.slice(0, 2).map((plan) => {
              const nodes = plan.plan_nodes ?? []
              const completed = nodes.filter((node) => node.status === 'completed').length
              return (
                <div key={plan.id} className="rounded-md border border-border bg-background p-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{plan.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{completed}/{nodes.length} 个节点完成</p>
                    </div>
                    <Badge variant={plan.status === 'running' ? 'default' : plan.status === 'failed' ? 'destructive' : 'secondary'}>
                      {plan.status}
                    </Badge>
                  </div>
                  <div className="mt-2 space-y-1">
                    {nodes.slice(0, 4).map((node) => (
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
          </div>
        </div>
      )}
      {actions.length > 0 && (
        <div data-testid="mobile-permission-readback" className="mb-3 space-y-2 rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-medium">授权记录</h2>
            <Badge variant="secondary">{actions.length}</Badge>
          </div>
          <div className="space-y-2">
            {actions.map((action) => (
              <MobileActionCard key={action.id} action={action} onApprove={approveAction} />
            ))}
          </div>
        </div>
      )}
      <div className="flex-1 overflow-auto flex flex-col gap-2 pb-4">
        {error && messages.length === 0 ? (
          <StateCard variant="error" title="消息读取失败" description={error} />
        ) : messages.length === 0 && (
          <StateCard variant="empty" title="暂无消息" description="发送第一条消息开始对话" />
        )}
        {messages.map(msg => {
          const isUser = msg.sender_type === 'user'
          const name = !isUser ? roleName(msg.role_agent_id) : undefined
          const parts = !isUser ? messageParts(msg.metadata) : []
          return (
            <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <Card className={`max-w-[80%] ${isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                <CardContent className="px-3 py-2">
                  {name && (
                    <Badge data-testid="message-role-badge" variant="secondary" className="mb-1">
                      {name}
                    </Badge>
                  )}
                  <p className="text-sm break-words">{msg.content}</p>
                  {parts.map((part) => <MobilePartCard key={part.id} part={part} />)}
                </CardContent>
              </Card>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div className="flex flex-col gap-1.5 pt-2 border-t border-border">
        {error && <p className="text-xs text-destructive">{error}</p>}
        {defaultRole && (
          <p className="text-xs text-muted-foreground">将发送给 @{defaultRole.name}</p>
        )}
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2 py-1.5 text-xs text-muted-foreground">
          <Paperclip className="h-3.5 w-3.5" />
          <span>移动端附件上传和产物编辑暂未开放，请在 Web 工作台处理附件与产物。</span>
        </div>
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="输入消息..."
            className="flex-1"
          />
          <Button onClick={send} disabled={sending || !input.trim() || !defaultRole} size="sm">
            {sending ? '发送中' : '发送'}
          </Button>
        </div>
      </div>
    </div>
  )
}
