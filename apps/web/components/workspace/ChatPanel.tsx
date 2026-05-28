'use client'

import { useState } from 'react'
import { Input, Card, StateCard, IconButton } from '@agenthub/ui'
import { Paperclip, AtSign, Send, PanelRight } from 'lucide-react'
import { useSessionStore } from '@/store/session-store'

function MessageList() {
  const { activeSessionId, messages, loading, error } = useSessionStore()

  if (loading) return <StateCard variant="loading" />
  if (error) return <StateCard variant="error" />
  if (!activeSessionId) return <StateCard variant="empty" />

  const sessionMessages = messages.filter((m) => m.sessionId === activeSessionId)

  if (sessionMessages.length === 0) return <StateCard variant="empty" />

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {sessionMessages.map((msg) => (
        <div
          key={msg.id}
          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <Card className={`max-w-[75%] p-3 ${msg.role === 'user' ? 'bg-primary/10' : 'bg-muted'}`}>
            <p className="text-sm">{msg.content}</p>
          </Card>
        </div>
      ))}
    </div>
  )
}

function MessageComposer() {
  const [input, setInput] = useState('')
  const { sendMessage, activeSessionId } = useSessionStore()

  const handleSend = () => {
    if (!input.trim() || !activeSessionId) return
    sendMessage(input.trim())
    setInput('')
  }

  return (
    <div data-testid="message-composer" className="flex flex-col gap-2 p-4 border-t border-border">
      <div className="flex gap-1">
        <IconButton icon={AtSign} label="提及 Agent" variant="ghost" size="sm" disabled={!activeSessionId} />
        <IconButton icon={Paperclip} label="附件" variant="ghost" size="sm" disabled={!activeSessionId} />
      </div>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder="输入消息..."
          disabled={!activeSessionId}
        />
        <IconButton icon={Send} label="发送" onClick={handleSend} disabled={!activeSessionId || !input.trim()} />
      </div>
    </div>
  )
}

export function ChatPanel({ onTogglePanel }: { onTogglePanel: () => void }) {
  const { activeSessionId, sessions } = useSessionStore()
  const activeSession = sessions.find((s) => s.id === activeSessionId)

  return (
    <div data-testid="chat-panel" className="flex flex-col h-full border-r border-border">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="text-sm font-semibold">
          {activeSession?.title ?? '选择一个会话'}
        </h2>
        <IconButton icon={PanelRight} label="切换面板" variant="ghost" size="sm" onClick={onTogglePanel} />
      </div>
      <MessageList />
      <MessageComposer />
    </div>
  )
}
