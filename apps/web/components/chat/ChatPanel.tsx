'use client'

import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import 'highlight.js/styles/github.css'
import type { Message } from '@agenthub/shared'

interface ChatPanelProps {
  messages: Message[]
  onSend: (content: string) => void
  streaming: boolean
  selectedMessageId?: string | null
  onSelectMessage?: (id: string | null) => void
  onPinMessage?: (id: string, isPinned: boolean) => void
}

export function ChatPanel({
  messages,
  onSend,
  streaming,
  selectedMessageId,
  onSelectMessage,
  onPinMessage,
}: ChatPanelProps) {
  const [input, setInput] = useState('')
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || streaming) return
    onSend(input.trim())
    setInput('')
  }

  const renderMessageContent = (msg: Message) => {
    const { message_type, content, metadata } = msg

    if (message_type === 'plan_card') {
      return (
        <div className="bg-accent border border-border rounded-lg p-3">
          <div className="font-semibold text-sm text-accent-foreground mb-2">Plan</div>
          <div className="text-xs text-accent-foreground/80 whitespace-pre-wrap">{content}</div>
          {metadata && typeof metadata === 'object' && 'steps' in metadata && Array.isArray((metadata as Record<string, unknown>).steps) && (
            <ol className="mt-2 space-y-1">
              {((metadata as Record<string, unknown>).steps as string[]).map((step: string, i: number) => (
                <li key={i} className="flex gap-2 text-xs">
                  <span className="font-medium">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )
    }

    if (message_type === 'result_card') {
      return (
        <div className="bg-success/10 border border-success/30 rounded-lg p-3">
          <div className="font-semibold text-sm text-success mb-2">Result</div>
          <div className="text-xs text-foreground/80 whitespace-pre-wrap">{content}</div>
          {metadata && typeof metadata === 'object' && 'status' in metadata && (
            <div className="mt-2 text-xs font-medium">
              Status: <span className={(metadata as Record<string, unknown>).status === 'success' ? 'text-success' : 'text-destructive'}>{(metadata as Record<string, unknown>).status as string}</span>
            </div>
          )}
        </div>
      )
    }

    if (message_type === 'approval') {
      return (
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-3">
          <div className="font-semibold text-sm text-warning-foreground mb-2">Pending Approval</div>
          <div className="text-xs text-warning-foreground/80 whitespace-pre-wrap">{content}</div>
        </div>
      )
    }

    if (message_type === 'system_event') {
      return (
        <div className="bg-muted border border-border rounded px-2 py-1 text-xs text-muted-foreground italic">
          {content}
        </div>
      )
    }

    return (
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
        {content}
      </ReactMarkdown>
    )
  }

  return (
    <main className="flex-1 flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            onMouseEnter={() => setHoveredId(msg.id)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={() => onSelectMessage?.(msg.id)}
            className={`flex ${msg.sender_type === 'user' ? 'justify-end' : 'justify-start'} ${
              selectedMessageId === msg.id ? 'ring-2 ring-ring rounded-lg' : ''
            }`}
          >
            <div
              className={`max-w-[70%] rounded-lg px-4 py-2 relative group ${
                msg.sender_type === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : msg.sender_type === 'system'
                  ? 'bg-warning/10 text-warning-foreground border border-warning/30'
                  : 'bg-muted text-foreground'
              }`}
            >
              {msg.sender_type === 'user' ? (
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              ) : (
                <div className="text-sm">
                  {renderMessageContent(msg)}
                </div>
              )}

              {/* Pin button — shown on hover for non-user messages */}
              {hoveredId === msg.id && msg.sender_type !== 'user' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onPinMessage?.(msg.id, !msg.is_pinned)
                  }}
                  className={`absolute -top-2 -right-2 p-1 rounded-full bg-card border shadow-sm hover:bg-muted ${
                    msg.is_pinned ? 'text-primary' : 'text-muted-foreground'
                  }`}
                  title={msg.is_pinned ? 'Unpin' : 'Pin'}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16 4V2H8v2l-4 4v2l4 4v7l2 3h4l2-3v-7l4-4V8l-4-4zm-1 8h-2v2H9v-2H7v-2h2V8h2v2h2v2z"/>
                  </svg>
                </button>
              )}

              {msg.streaming_status === 'streaming' && (
                <span className="inline-block w-2 h-4 bg-current animate-pulse ml-1" />
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSubmit} className="border-t p-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Input message..."
          className="flex-1 border border-input rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          disabled={streaming}
        />
        <button
          type="submit"
          disabled={!input.trim() || streaming}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </main>
  )
}
