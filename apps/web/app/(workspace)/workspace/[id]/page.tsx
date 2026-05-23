'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { DetailPanel } from '@/components/layout/DetailPanel'
import { createClient } from '@/lib/supabase-browser'
import type { Message } from '@agenthub/shared'

let msgCounter = 0
const genId = () => `msg-${++msgCounter}-${Date.now()}`

export default function WorkspaceChatPage() {
  const { id: workspaceId } = useParams<{ id: string }>()
  const [sessions, setSessions] = useState<{ id: string; name: string }[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [streaming, setStreaming] = useState(false)
  const realtimeRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)

  // Load messages when session changes
  useEffect(() => {
    if (!currentSessionId) return

    fetch(`/api/messages?session_id=${currentSessionId}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setMessages(data)
      })

    // Cleanup previous subscription
    if (realtimeRef.current) {
      realtimeRef.current.unsubscribe()
    }

    // Subscribe to new messages via Realtime
    const supabase = createClient()
    realtimeRef.current = supabase
      .channel(`messages:${currentSessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `session_id=eq.${currentSessionId}`,
        },
        (payload) => {
          setMessages((m) => {
            if (m.some((msg) => msg.id === (payload.new as Message).id)) return m
            return [...m, payload.new as Message]
          })
        },
      )
      .subscribe()

    return () => {
      if (realtimeRef.current) {
        realtimeRef.current.unsubscribe()
        realtimeRef.current = null
      }
    }
  }, [currentSessionId])

  // Load sessions on mount
  useEffect(() => {
    fetch(`/api/sessions?workspace_id=${workspaceId}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setSessions(data.map((s: any) => ({ id: s.id, name: s.name })))
          if (data.length > 0 && !currentSessionId) setCurrentSessionId(data[0].id)
        }
      })
  }, [workspaceId])

  const handleNewSession = async () => {
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace_id: workspaceId, name: `会话 ${sessions.length + 1}` }),
    })
    if (res.ok) {
      const s = await res.json()
      setSessions((prev) => [{ id: s.id, name: s.name }, ...prev])
      setCurrentSessionId(s.id)
      setMessages([])
    }
  }

  const handleSend = useCallback(
    async (content: string) => {
      if (!currentSessionId) return

      // POST user message via API
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: currentSessionId,
          content,
          sender_type: 'user',
          sender_id: null,
          message_type: 'text',
          streaming_status: 'complete',
          is_pinned: false,
        }),
      })
      if (!res.ok) return
      const userMsg: Message = await res.json()
      setMessages((m) => {
        if (m.some((msg) => msg.id === userMsg.id)) return m
        return [...m, userMsg]
      })

      // Simulate AI streaming response
      const aiMsgId = genId()
      const aiMsg: Message = {
        id: aiMsgId,
        session_id: currentSessionId,
        sender_type: 'agent',
        sender_id: null,
        role_agent_id: null,
        content: '',
        message_type: 'text',
        streaming_status: 'streaming',
        metadata: null,
        is_pinned: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      setMessages((m) => {
        if (m.some((msg) => msg.id === aiMsgId)) return m
        return [...m, aiMsg]
      })
      setStreaming(true)

      const response = `收到您的消息："${content}"。我是 AgentHub Orchestrator，正在为您协调处理...`
      let i = 0
      const interval = setInterval(() => {
        i++
        setMessages((m) =>
          m.map((msg) =>
            msg.id === aiMsgId
              ? {
                  ...msg,
                  content: response.slice(0, i * 2),
                  streaming_status: i * 2 >= response.length ? 'complete' : 'streaming',
                }
              : msg,
          ),
        )
        if (i * 2 >= response.length) {
          clearInterval(interval)
          setStreaming(false)
        }
      }, 30)
    },
    [currentSessionId],
  )

  return (
    <div className="flex h-screen">
      <Sidebar
        sessions={sessions}
        currentId={currentSessionId}
        onSelect={(id) => setCurrentSessionId(id)}
        onNew={handleNewSession}
      />
      <ChatPanel messages={messages} onSend={handleSend} streaming={streaming} />
      <DetailPanel />
    </div>
  )
}
