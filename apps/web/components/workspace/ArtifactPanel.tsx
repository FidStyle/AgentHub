'use client'

import type React from 'react'
import { useEffect, useState } from 'react'
import { Badge, Button, StateCard } from '@agenthub/ui'
import { Bot, Boxes, FileCode2, FileText, GitBranch, MessageSquareText, ShieldCheck, X } from 'lucide-react'
import { OrchestratorPanel } from '../orchestrator/OrchestratorPanel'
import { useSessionStore } from '@/store/session-store'

const TABS = ['上下文', '变更', '产物'] as const

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

function truncate(text: string, max = 160) {
  return text.length > max ? `${text.slice(0, max)}...` : text
}

function toPreview(value: unknown) {
  if (typeof value === 'string') return value
  return JSON.stringify(value, null, 2)
}

function metadataValue(metadata: MessageRow['metadata'], keys: string[]) {
  if (!metadata) return undefined
  return keys.find((key) => key in metadata)
}

function PanelSection({
  icon: Icon,
  title,
  description,
  action,
  children,
}: {
  icon: typeof MessageSquareText
  title: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">{title}</h3>
          </div>
          {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
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
  return (
    <div data-testid="artifact-context" className="space-y-4">
      <PanelSection
        icon={MessageSquareText}
        title="会话上下文"
        description="固定消息、引用材料与本轮运行携带的结构化上下文"
        action={<Badge variant="secondary">{refs.length} 条</Badge>}
      >
        {loaded && refs.length === 0 ? (
          <StateCard variant="empty" title="暂无上下文" description="当前会话还没有被引用或固定的上下文" />
        ) : (
          refs.map((m) => (
            <div key={m.id} className="rounded-lg border border-border bg-background p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <Badge variant={m.is_pinned ? 'default' : 'secondary'}>
                  {m.is_pinned ? '已固定' : m.message_type}
                </Badge>
                {m.metadata && <Badge variant="secondary">{Object.keys(m.metadata).length} 个字段</Badge>}
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{truncate(m.content, 260)}</p>
            </div>
          ))
        )}
      </PanelSection>
      <PanelSection icon={Bot} title="Role Agents" description="当前工作区可提及和调度的角色">
        <AgentsTab />
      </PanelSection>
    </div>
  )
}

function hasChangeMetadata(metadata: MessageRow['metadata']) {
  if (!metadata) return false
  return ['diff', 'git_diff', 'patch', 'changes', 'files', 'changed_files'].some((key) => key in metadata)
}

function metadataPreview(metadata: MessageRow['metadata']) {
  if (!metadata) return null
  const keys = ['diff', 'git_diff', 'patch', 'changes', 'files', 'changed_files'].filter((key) => key in metadata)
  if (keys.length === 0) return null
  const preview = Object.fromEntries(keys.map((key) => [key, metadata[key]]))
  return JSON.stringify(preview, null, 2)
}

function DiffPreview({ value }: { value: unknown }) {
  const text = toPreview(value)
  const lines = text.split('\n').slice(0, 80)
  const added = lines.filter((line) => line.startsWith('+') && !line.startsWith('+++')).length
  const removed = lines.filter((line) => line.startsWith('-') && !line.startsWith('---')).length
  return (
    <div data-testid="git-diff-preview" className="overflow-hidden rounded-md border border-border bg-muted/40">
      <div className="flex items-center justify-between border-b border-border px-2 py-1.5">
        <div className="flex items-center gap-2">
          <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">Git diff</span>
        </div>
        <div className="flex items-center gap-1 text-xs">
          <span className="text-success">+{added}</span>
          <span className="text-destructive">-{removed}</span>
        </div>
      </div>
      <pre className="max-h-64 overflow-auto p-2 text-xs leading-relaxed">
        {lines.map((line, index) => (
          <div
            key={`${index}-${line}`}
            className={
              line.startsWith('+') && !line.startsWith('+++')
                ? 'text-success'
                : line.startsWith('-') && !line.startsWith('---')
                  ? 'text-destructive'
                  : line.startsWith('@@')
                    ? 'text-primary'
                    : 'text-muted-foreground'
            }
          >
            {line || ' '}
          </div>
        ))}
      </pre>
    </div>
  )
}

function ChangeRecordCard({ message }: { message: MessageRow }) {
  const diffKey = metadataValue(message.metadata, ['diff', 'git_diff', 'patch'])
  const filesKey = metadataValue(message.metadata, ['files', 'changed_files'])
  const preview = metadataPreview(message.metadata)
  return (
    <div className="rounded-lg border border-border bg-background p-3 text-sm">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FileCode2 className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{message.message_type === 'approval' ? '授权动作' : '运行变更'}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">关联消息：{message.id}</p>
        </div>
        <Badge variant={message.message_type === 'approval' ? 'warning' : 'secondary'}>
          {message.message_type}
        </Badge>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{truncate(message.content, 220)}</p>
      {filesKey && message.metadata && (
        <div className="mt-2 rounded-md border border-border bg-muted/30 p-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">文件：</span>{toPreview(message.metadata[filesKey])}
        </div>
      )}
      {diffKey && message.metadata ? (
        <div className="mt-2">
          <DiffPreview value={message.metadata[diffKey]} />
        </div>
      ) : preview ? (
        <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-muted p-2 text-xs">
          {preview}
        </pre>
      ) : null}
    </div>
  )
}

function ChangesTab() {
  const { activeSessionId, messages, error, loaded } = useSessionMessages()
  const changes = messages.filter(
    (m) => m.message_type === 'result_card' || m.message_type === 'approval' || hasChangeMetadata(m.metadata),
  )
  if (!activeSessionId) return <StateCard variant="empty" title="未选择会话" description="选择会话后，其运行、授权和变更记录将在此展示" />
  if (error) return <p data-testid="artifact-changes-error" className="text-sm text-destructive">{error}</p>
  return (
    <div data-testid="artifact-changes" className="space-y-4">
      <OrchestratorPanel />
      <PanelSection
        icon={GitBranch}
        title="变更记录"
        description="Git diff、文件变更、运行结果和需要授权的动作会关联到对应会话记录"
        action={<Badge variant="secondary">{changes.length} 条</Badge>}
      >
        {loaded && changes.length === 0 ? (
          <StateCard variant="empty" title="暂无变更" description="当前会话还没有文件变更、diff 或运行结果" />
        ) : (
          changes.map((m) => <ChangeRecordCard key={m.id} message={m} />)
        )}
      </PanelSection>
    </div>
  )
}

function ArtifactCard({ message }: { message: MessageRow }) {
  const artifact = message.metadata?.artifact
  const title = typeof artifact === 'object' && artifact && 'title' in artifact
    ? String((artifact as { title?: unknown }).title ?? '未命名产物')
    : message.message_type === 'file'
      ? '文件产物'
      : '会话产物'
  const artifactType = typeof artifact === 'object' && artifact && 'type' in artifact
    ? String((artifact as { type?: unknown }).type ?? message.message_type)
    : message.message_type

  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="truncate text-sm font-medium">{title}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">来源消息：{message.id}</p>
        </div>
        <Badge variant="secondary">{artifactType}</Badge>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{truncate(message.content, 240)}</p>
      {artifact ? (
        <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-muted p-2 text-xs">
          {toPreview(artifact)}
        </pre>
      ) : null}
    </div>
  )
}

function ArtifactsTab() {
  const { activeSessionId, messages, error, loaded } = useSessionMessages()
  const artifacts = messages.filter(
    (m) => m.message_type === 'artifact' || m.message_type === 'file' || m.message_type === 'result_card' || (m.metadata && 'artifact' in m.metadata),
  )
  if (!activeSessionId) return <StateCard variant="empty" title="未选择会话" description="选择会话后，Agent 产出的产物将在此展示" />
  if (error) return <p data-testid="artifact-output-error" className="text-sm text-destructive">{error}</p>
  if (loaded && artifacts.length === 0) return <StateCard variant="empty" title="暂无产物" description="当前会话还没有 Agent 产出的代码、文件或结果" />
  return (
    <div data-testid="artifact-output" className="space-y-2">
      {artifacts.map((m) => <ArtifactCard key={m.id} message={m} />)}
    </div>
  )
}

export function ArtifactPanel({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>('上下文')

  return (
    <aside data-testid="artifact-panel" className="flex flex-col h-full bg-card">
      <div className="border-b border-border p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Boxes className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">会话工作台</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">上下文、变更和产物按当前 Session 关联</p>
          </div>
          <Button variant="ghost" size="sm" data-testid="artifact-close-btn" onClick={onClose} aria-label="关闭右侧面板">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-1">
          {TABS.map((tab) => (
            <Button
              key={tab}
              variant={activeTab === tab ? 'default' : 'ghost'}
              size="sm"
              className="flex-1"
              onClick={() => setActiveTab(tab)}
            >
              {tab === '变更' && <GitBranch className="mr-1 h-3.5 w-3.5" />}
              {tab === '上下文' && <ShieldCheck className="mr-1 h-3.5 w-3.5" />}
              {tab === '产物' && <FileText className="mr-1 h-3.5 w-3.5" />}
              {tab}
            </Button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === '上下文' && <ContextTab />}
        {activeTab === '变更' && <ChangesTab />}
        {activeTab === '产物' && <ArtifactsTab />}
      </div>
    </aside>
  )
}
