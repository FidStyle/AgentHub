'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { Button, Input, Card, CardContent, StateCard } from '@agenthub/ui'
import type { Message } from '@agenthub/shared'

export default function MobileSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`/api/messages?session_id=${sessionId}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setMessages(d) })
      .finally(() => setLoading(false))
  }, [sessionId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    if (!input.trim() || sending) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, content: input.trim(), sender_type: 'user' }),
      })
      if (res.ok) {
        const msg = await res.json()
        setMessages(m => [...m, msg])
        setInput('')
      } else {
        setError('发送失败，请重试')
      }
    } catch {
      setError('网络错误，请检查连接')
    }
    setSending(false)
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
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.sender_type === 'user' ? 'justify-end' : 'justify-start'}`}>
            <Card className={`max-w-[80%] ${msg.sender_type === 'user' ? 'bg-primary text-primary-foreground' : ''}`}>
              <CardContent className="px-3 py-2">
                <p className="text-sm break-words">{msg.content}</p>
              </CardContent>
            </Card>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="flex flex-col gap-1.5 pt-2 border-t border-border">
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="输入消息..."
            className="flex-1"
          />
          <Button onClick={send} disabled={sending || !input.trim()} size="sm">
            {sending ? '发送中' : '发送'}
          </Button>
        </div>
      </div>
    </div>
  )
}
