'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { Button, Input, Card, CardContent, StateCard, Badge } from '@agenthub/ui'
import { Paperclip } from 'lucide-react'
import type { Message } from '@agenthub/shared'

interface RoleAgent {
  id: string
  name: string
  is_orchestrator: boolean
}

// Runtime terminal events must surface a clear status, never silence or a fake success.
// Shown as a system notice (no role_agent_id) so it is not mistaken for a real agent answer.
const statusText: Record<string, string> = {
  endpoint_unavailable: '⚠️ 公共云端 Runtime 未就绪，请稍后再试或切换到本地 Desktop 运行时',
  local_runtime_offline: '⚠️ 本地 Desktop 运行时离线，未收到回复',
  tunnel_disconnected: '⚠️ 本地运行时连接已断开，未收到回复',
  runtime_failed: '⚠️ 运行时执行失败，未收到回复',
}

export default function MobileSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const [messages, setMessages] = useState<Message[]>([])
  const [roleAgents, setRoleAgents] = useState<RoleAgent[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Resolve the session's workspace, then its role agents. GET /api/role-agents auto-seeds the
  // default 架构师 orchestrator, guaranteeing at least one role context for the default strategy.
  useEffect(() => {
    let cancelled = false
    fetch(`/api/messages?session_id=${sessionId}`)
      .then(r => r.json())
      .then(d => { if (!cancelled && Array.isArray(d)) setMessages(d) })
      .finally(() => { if (!cancelled) setLoading(false) })

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
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let noticed = false

      const upsertReply = () => {
        setMessages(prev => {
          const exists = prev.some(m => m.id === replyId)
          if (!exists) {
            return [...prev, { id: replyId, session_id: sessionId, sender_type: 'agent', role_agent_id: roleAgentId, content: reply } as unknown as Message]
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
          let evt: { type?: string; delta?: string }
          try {
            evt = JSON.parse(line.slice(5).trim())
          } catch {
            continue
          }
          if (evt.type === 'runtime_output' && evt.delta) {
            reply += evt.delta
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
      <div className="flex-1 overflow-auto flex flex-col gap-2 pb-4">
        {messages.length === 0 && (
          <StateCard variant="empty" title="暂无消息" description="发送第一条消息开始对话" />
        )}
        {messages.map(msg => {
          const isUser = msg.sender_type === 'user'
          const name = !isUser ? roleName(msg.role_agent_id) : undefined
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
