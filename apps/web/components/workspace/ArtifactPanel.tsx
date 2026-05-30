'use client'

import { useEffect, useState } from 'react'
import { Button, StateCard } from '@agenthub/ui'
import { OrchestratorPanel } from '../orchestrator/OrchestratorPanel'
import { useSessionStore } from '@/store/session-store'

const TABS = ['产物', '编排', '上下文', 'Agents'] as const

type RoleAgentRow = { id: string; name: string; role_type: string; capabilities: string[] | null; is_orchestrator: boolean }
type MessageRow = {
  id: string
  content: string
  message_type: string
  is_pinned: boolean
  metadata: Record<string, unknown> | null
}

function AgentsTab() {
  const { activeWorkspaceId } = useSessionStore()
  const [agents, setAgents] = useState<RoleAgentRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!activeWorkspaceId) return
    setLoaded(false)
    fetch(`/api/role-agents?workspace_id=${activeWorkspaceId}`)
      .then((r) => { if (!r.ok) throw new Error('加载 Agents 失败'); return r.json() })
      .then((d: RoleAgentRow[]) => setAgents(d))
      .catch((e) => setError(e instanceof Error ? e.message : '加载 Agents 失败'))
      .finally(() => setLoaded(true))
  }, [activeWorkspaceId])

  if (!activeWorkspaceId) return <StateCard variant="empty" title="未选择工作区" description="选择工作区后，其 Role Agent 将在此展示" />
  if (error) return <p data-testid="artifact-agents-error" className="text-sm text-destructive">{error}</p>
  if (loaded && agents.length === 0) return <StateCard variant="empty" title="暂无 Agent" description="当前工作区还没有 Role Agent" />
  return (
    <div data-testid="artifact-agents" className="space-y-3">
      {agents.map((a) => (
        <div key={a.id} className="rounded-lg border border-border p-3">
          <div className="font-medium">{a.name}</div>
          <div className="text-xs text-muted-foreground">{a.role_type}{a.is_orchestrator ? ' · 编排者' : ''}</div>
          {a.capabilities && a.capabilities.length > 0 && (
            <div className="mt-1 text-xs text-muted-foreground">能力: {a.capabilities.join('、')}</div>
          )}
        </div>
      ))}
    </div>
  )
}

function useSessionMessages() {
  const { activeSessionId } = useSessionStore()
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    if (!activeSessionId) return
    setLoaded(false)
    fetch(`/api/messages?session_id=${activeSessionId}`)
      .then((r) => { if (!r.ok) throw new Error('加载消息失败'); return r.json() })
      .then((d: MessageRow[]) => setMessages(d))
      .catch((e) => setError(e instanceof Error ? e.message : '加载消息失败'))
      .finally(() => setLoaded(true))
  }, [activeSessionId])
  return { activeSessionId, messages, error, loaded }
}

function ContextTab() {
  const { activeSessionId, messages, error, loaded } = useSessionMessages()
  const refs = messages.filter((m) => m.is_pinned || (m.metadata && Object.keys(m.metadata).length > 0))
  if (!activeSessionId) return <StateCard variant="empty" title="未选择会话" description="选择会话后，其引用上下文将在此展示" />
  if (error) return <p data-testid="artifact-context-error" className="text-sm text-destructive">{error}</p>
  if (loaded && refs.length === 0) return <StateCard variant="empty" title="暂无上下文" description="当前会话还没有被引用或固定的上下文" />
  return (
    <div data-testid="artifact-context" className="space-y-2">
      {refs.map((m) => (
        <div key={m.id} className="rounded-lg border border-border p-3 text-sm">
          {m.is_pinned && <span className="mr-1 text-xs text-primary">📌</span>}
          {m.content}
        </div>
      ))}
    </div>
  )
}

function OutputTab() {
  const { activeSessionId, messages, error, loaded } = useSessionMessages()
  const artifacts = messages.filter(
    (m) => m.message_type === 'plan_card' || m.message_type === 'result_card' || (m.metadata && 'artifact' in m.metadata),
  )
  if (!activeSessionId) return <StateCard variant="empty" title="未选择会话" description="选择会话后，Agent 产出的产物将在此展示" />
  if (error) return <p data-testid="artifact-output-error" className="text-sm text-destructive">{error}</p>
  if (loaded && artifacts.length === 0) return <StateCard variant="empty" title="暂无产物" description="当前会话还没有 Agent 产出的代码、文件或结果" />
  return (
    <div data-testid="artifact-output" className="space-y-2">
      {artifacts.map((m) => (
        <div key={m.id} className="rounded-lg border border-border p-3 text-sm">
          <div className="text-xs text-muted-foreground">{m.message_type}</div>
          {m.content}
        </div>
      ))}
    </div>
  )
}

export function ArtifactPanel({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>('产物')

  return (
    <aside data-testid="artifact-panel" className="flex flex-col h-full bg-card">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex gap-1">
          {TABS.map((tab) => (
            <Button
              key={tab}
              variant={activeTab === tab ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </Button>
          ))}
        </div>
        <Button variant="ghost" size="sm" data-testid="artifact-close-btn" onClick={onClose}>
          关闭
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === '产物' && <OutputTab />}
        {activeTab === '编排' && <OrchestratorPanel />}
        {activeTab === '上下文' && <ContextTab />}
        {activeTab === 'Agents' && <AgentsTab />}
      </div>
    </aside>
  )
}
