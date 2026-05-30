'use client'

import { useEffect, useState } from 'react'
import { Button, StateCard } from '@agenthub/ui'
import { OrchestratorPanel } from '../orchestrator/OrchestratorPanel'
import { useSessionStore } from '@/store/session-store'

const TABS = ['产物', '编排', '上下文', 'Agents'] as const

type RoleAgentRow = {
  id: string
  name: string
  role_type: string
  system_prompt: string
  capabilities: string[] | null
  is_orchestrator: boolean
}
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
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    name: '',
    role_type: 'engineer',
    system_prompt: '',
    capabilities: '',
    is_orchestrator: false,
  })
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)

  const selected = agents.find((agent) => agent.id === selectedId) ?? agents[0] ?? null

  const loadAgents = async () => {
    if (!activeWorkspaceId) return
    setLoaded(false)
    setError(null)
    try {
      const res = await fetch(`/api/role-agents?workspace_id=${activeWorkspaceId}`)
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((body as { error?: string }).error || `加载 Agents 失败（${res.status}）`)
      const rows = Array.isArray(body) ? (body as RoleAgentRow[]) : []
      setAgents(rows)
      setSelectedId((current) => current && rows.some((row) => row.id === current) ? current : rows[0]?.id ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载 Agents 失败')
    } finally {
      setLoaded(true)
    }
  }

  useEffect(() => {
    void loadAgents()
  }, [activeWorkspaceId])

  function emitRoleAgentsChanged() {
    window.dispatchEvent(new CustomEvent('role-agents:changed', { detail: { workspaceId: activeWorkspaceId } }))
  }

  function startEdit(agent: RoleAgentRow) {
    setEditing(true)
    setSelectedId(agent.id)
    setForm({
      name: agent.name,
      role_type: agent.role_type,
      system_prompt: agent.system_prompt ?? '',
      capabilities: (agent.capabilities ?? []).join(', '),
      is_orchestrator: agent.is_orchestrator,
    })
  }

  function startCreate() {
    setEditing(true)
    setSelectedId(null)
    setForm({
      name: '',
      role_type: 'engineer',
      system_prompt: '',
      capabilities: '',
      is_orchestrator: false,
    })
  }

  async function saveAgent() {
    if (!activeWorkspaceId || !form.name.trim()) {
      setError('Agent 名称不能为空')
      return
    }
    setSaving(true)
    setError(null)
    const payload = {
      workspace_id: activeWorkspaceId,
      name: form.name.trim(),
      role_type: form.role_type,
      system_prompt: form.system_prompt,
      capabilities: form.capabilities.split(',').map((item) => item.trim()).filter(Boolean),
      is_orchestrator: form.is_orchestrator,
    }
    try {
      const res = await fetch(selectedId ? `/api/role-agents/${selectedId}` : '/api/role-agents', {
        method: selectedId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((body as { error?: string }).error || `保存 Agent 失败（${res.status}）`)
      const saved = body as RoleAgentRow
      setEditing(false)
      setSelectedId(saved.id)
      await loadAgents()
      emitRoleAgentsChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存 Agent 失败')
    } finally {
      setSaving(false)
    }
  }

  async function deleteAgent(agent: RoleAgentRow) {
    if (!confirm(`确定删除 Agent「${agent.name}」吗？删除后 @角色列表会同步移除。`)) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/role-agents/${agent.id}`, { method: 'DELETE' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((body as { error?: string }).error || `删除 Agent 失败（${res.status}）`)
      setEditing(false)
      setSelectedId(null)
      await loadAgents()
      emitRoleAgentsChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除 Agent 失败')
    } finally {
      setSaving(false)
    }
  }

  if (!activeWorkspaceId) return <StateCard variant="empty" title="未选择工作区" description="选择工作区后，其 Role Agent 将在此展示" />
  return (
    <div data-testid="artifact-agents" className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium">Role Agents</h3>
          <p className="text-xs text-muted-foreground">管理当前工作区可 @ 的角色</p>
        </div>
        <Button size="sm" onClick={startCreate} data-testid="agent-create-btn">新建</Button>
      </div>
      {error && <p data-testid="artifact-agents-error" className="text-sm text-destructive">{error}</p>}
      {!loaded && <p className="text-sm text-muted-foreground">加载中...</p>}
      {loaded && agents.length === 0 && !editing && (
        <StateCard variant="empty" title="暂无 Agent" description="点击新建，为当前工作区创建第一个 Role Agent" />
      )}
      <div className="space-y-2">
        {agents.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => { setSelectedId(a.id); setEditing(false) }}
            className={`w-full rounded-lg border border-border p-3 text-left hover:bg-muted ${selected?.id === a.id && !editing ? 'bg-muted' : ''}`}
          >
            <div className="font-medium">{a.name}</div>
            <div className="text-xs text-muted-foreground">{a.role_type}{a.is_orchestrator ? ' · 编排者' : ''}</div>
            {a.capabilities && a.capabilities.length > 0 && (
              <div className="mt-1 text-xs text-muted-foreground">能力: {a.capabilities.join('、')}</div>
            )}
          </button>
        ))}
      </div>

      {editing ? (
        <div data-testid="agent-editor" className="space-y-3 rounded-lg border border-border bg-background p-3">
          <div className="grid gap-2">
            <label htmlFor="agent-name" className="text-xs font-medium">名称</label>
            <input
              id="agent-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="例如：前端工程师"
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="agent-role-type" className="text-xs font-medium">角色类型</label>
            <select
              id="agent-role-type"
              value={form.role_type}
              onChange={(e) => setForm({ ...form, role_type: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="orchestrator">编排者</option>
              <option value="engineer">工程师</option>
              <option value="reviewer">审查者</option>
              <option value="tester">测试者</option>
              <option value="custom">自定义</option>
              <option value="general">通用</option>
            </select>
          </div>
          <div className="grid gap-2">
            <label htmlFor="agent-system-prompt" className="text-xs font-medium">系统提示词</label>
            <textarea
              id="agent-system-prompt"
              rows={5}
              value={form.system_prompt}
              onChange={(e) => setForm({ ...form, system_prompt: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="描述这个角色如何参与对话"
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="agent-capabilities" className="text-xs font-medium">能力标签</label>
            <input
              id="agent-capabilities"
              value={form.capabilities}
              onChange={(e) => setForm({ ...form, capabilities: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="用英文逗号分隔，例如 architecture, review"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_orchestrator}
              onChange={(e) => setForm({ ...form, is_orchestrator: e.target.checked })}
              className="h-4 w-4"
            />
            设为编排者
          </label>
          <div className="flex gap-2">
            <Button size="sm" onClick={saveAgent} disabled={saving} data-testid="agent-save-btn">
              {saving ? '保存中...' : '保存'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>取消</Button>
          </div>
        </div>
      ) : selected && (
        <div data-testid="agent-detail" className="space-y-3 rounded-lg border border-border bg-background p-3">
          <div>
            <div className="text-sm font-medium">{selected.name}</div>
            <div className="text-xs text-muted-foreground">{selected.role_type}{selected.is_orchestrator ? ' · 编排者' : ''}</div>
          </div>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {selected.system_prompt || '未设置系统提示词'}
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => startEdit(selected)} data-testid="agent-edit-btn">编辑</Button>
            <Button size="sm" variant="destructive" onClick={() => deleteAgent(selected)} disabled={saving} data-testid="agent-delete-btn">
              删除
            </Button>
          </div>
        </div>
      )}
      <div className="rounded-md border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
        本地 Claude Code / Codex 由 AgentHub Desktop 在本机调用，AgentHub 不托管本地 CLI 的 API Key。
      </div>
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
