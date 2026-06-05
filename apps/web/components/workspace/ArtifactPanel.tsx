'use client'

import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Badge, Button, StateCard } from '@agenthub/ui'
import { Bot, Boxes, CheckCircle2, Clock, Copy, Download, FileCode2, FileText, FolderTree, GitBranch, History, PackagePlus, Pencil, Presentation, Rocket, Route, RotateCcw, Save, SendHorizontal, ShieldCheck, Terminal, Trash2, Upload, WandSparkles, X } from 'lucide-react'
import { OrchestratorPanel } from '../orchestrator/OrchestratorPanel'
import { useSessionStore } from '@/store/session-store'
import { defaultDocumentContent, defaultPresentationDeck, parsePresentationDeck, serializePresentationDeck, type ArtifactDbType, type PresentationDeck } from '@/lib/artifacts/rich-artifacts'

const TABS = ['角色', '过程', '编排', '文件', 'Git', '产物', '部署'] as const

const ROLE_TYPE_LABELS: Record<string, string> = {
  orchestrator: '编排者',
  engineer: '工程师',
  reviewer: '审查者',
  tester: '测试者',
  custom: '自定义',
  general: '通用',
}

const ARTIFACT_TYPE_LABELS: Record<ArtifactRow['artifact_type'], string> = {
  html: '网页预览',
  markdown: 'Markdown',
  code: '代码',
  image: '图片',
  diff: 'Diff',
  folder: '目录',
  document: '富文档',
  presentation: '演示稿',
  generic_file: '文件',
}

type RoleAgentRow = {
  id: string
  name: string
  role_type: string
  system_prompt: string
  capabilities: string[] | null
  runtime_type: 'claude_code' | 'codex'
  is_orchestrator: boolean
}
type FileTreeNode = {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileTreeNode[]
}
type FilePreview = {
  path: string
  name: string
  type: 'file' | 'directory'
  size: number
  mime: string
  previewKind: 'html' | 'markdown' | 'code' | 'image' | 'text' | 'binary' | 'folder' | 'diff' | 'document' | 'presentation'
  content: string | null
  truncated: boolean
  downloadUrl: string
}
type ArtifactRow = {
  id: string
  workspace_id: string
  session_id: string | null
  source_path: string | null
  artifact_type: ArtifactDbType
  title: string
  content: string | null
  content_ref: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}
type GitChangeRow = {
  path: string
  status: string
  staged: boolean
  untracked: boolean
  unstaged?: boolean
  indexStatus?: string
  workingTreeStatus?: string
}
type PatchDraft = {
  path: string
  selectionStart: number
  selectionEnd: number
  selectedText: string
  replacement: string
  content: string
  diff: string
}
type GitCommitRow = {
  hash: string
  shortHash: string
  author: string
  date: string
  message: string
}
type TimelineKind = 'message' | 'plan' | 'plan_node' | 'attempt' | 'mailbox' | 'runtime' | 'action' | 'artifact' | 'deployment'
type TimelineItem = {
  id: string
  kind: TimelineKind
  status: string
  title: string
  summary: string
  createdAt: string
  roleAgentId?: string | null
  roleName?: string | null
  refs?: Record<string, unknown>
}

export function formatPanelTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '暂无时间'
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function artifactTypeLabel(artifactType: ArtifactRow['artifact_type']) {
  return ARTIFACT_TYPE_LABELS[artifactType] ?? artifactType
}

export function artifactPreviewLabel(artifact: Pick<ArtifactRow, 'artifact_type' | 'content'>) {
  const hasInlinePreview = artifact.content !== null || artifact.artifact_type === 'folder' || artifact.artifact_type === 'image'
  return hasInlinePreview ? '可预览' : '需下载'
}

function roleTypeLabel(agent: Pick<RoleAgentRow, 'role_type' | 'is_orchestrator'>) {
  if (agent.is_orchestrator) return '编排者'
  return ROLE_TYPE_LABELS[agent.role_type] ?? agent.role_type
}

function toPreview(value: unknown) {
  if (typeof value === 'string') return value
  return JSON.stringify(value, null, 2)
}

function quoteToComposer(input: { id?: string; author: string; preview: string; text: string }) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('agenthub:quote-to-composer', { detail: input }))
}

function artifactTypeForPreview(preview: FilePreview) {
  if (preview.previewKind === 'html') return 'html'
  if (preview.previewKind === 'markdown') return 'markdown'
  if (preview.previewKind === 'code') return 'code'
  if (preview.previewKind === 'image') return 'image'
  if (preview.previewKind === 'document') return 'document'
  if (preview.previewKind === 'presentation') return 'presentation'
  if (preview.previewKind === 'folder') return 'folder'
  return 'generic_file'
}

function isEditablePreview(preview: FilePreview | null) {
  return Boolean(preview && preview.content !== null && ['markdown', 'code', 'text'].includes(preview.previewKind))
}

function runtimeLabel(runtimeType: RoleAgentRow['runtime_type']) {
  return runtimeType === 'codex' ? 'Codex' : 'Claude Code'
}

function timelineKindLabel(kind: TimelineKind) {
  const labels: Record<TimelineKind, string> = {
    message: '消息',
    plan: '计划',
    plan_node: '节点',
    attempt: '尝试',
    mailbox: '交接',
    runtime: '运行',
    action: '权限',
    artifact: '产物',
    deployment: '部署',
  }
  return labels[kind] ?? kind
}

function timelineStatusVariant(status: string): 'secondary' | 'default' | 'warning' | 'success' | 'destructive' {
  if (['completed', 'complete', 'created', 'approved', 'success'].includes(status)) return 'success'
  if (['running', 'queued', 'pending', 'pending_confirm', 'waiting'].includes(status)) return 'warning'
  if (['failed', 'rejected', 'blocked', 'cancelled', 'unavailable'].includes(status)) return 'destructive'
  return 'secondary'
}

function isDeploymentItem(item: TimelineItem) {
  return item.kind === 'deployment' || item.kind === 'action' && item.refs?.actionId && item.title.includes('部署')
}

function PreviewBlock({
  preview,
  downloadUrl,
}: {
  preview: Pick<FilePreview, 'previewKind' | 'content' | 'mime' | 'path' | 'name' | 'truncated'>
  downloadUrl?: string | null
}) {
  if (preview.previewKind === 'html' && preview.content) {
    return (
      <iframe
        data-testid="workspace-html-preview"
        sandbox=""
        title={preview.name}
        srcDoc={preview.content}
        className="h-72 w-full rounded-md border border-border bg-white"
      />
    )
  }
  if (preview.previewKind === 'markdown' && preview.content) {
    return (
      <div data-testid="workspace-markdown-preview" className="prose prose-sm max-w-none rounded-md border border-border bg-background p-3 dark:prose-invert">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{preview.content}</ReactMarkdown>
      </div>
    )
  }
  if (preview.previewKind === 'document') {
    if (preview.content) {
      return (
        <div data-testid="workspace-document-preview" className="prose prose-sm max-w-none rounded-md border border-border bg-background p-3 dark:prose-invert">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{preview.content}</ReactMarkdown>
        </div>
      )
    }
    return (
      <div data-testid="workspace-document-preview" className="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">
        该文档可下载查看；当前文件没有可内联编辑的源内容。
      </div>
    )
  }
  if (preview.previewKind === 'presentation') {
    if (preview.content) {
      return <PresentationPreview deck={parsePresentationDeck(preview.content, preview.name)} />
    }
    return (
      <div data-testid="workspace-presentation-preview" className="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">
        该演示稿可下载查看；当前文件没有可内联编辑的源内容。
      </div>
    )
  }
  if ((preview.previewKind === 'code' || preview.previewKind === 'text' || preview.previewKind === 'folder' || preview.previewKind === 'diff') && preview.content !== null) {
    return (
      <pre data-testid="workspace-code-preview" className="max-h-72 overflow-auto rounded-md border border-border bg-muted p-3 text-xs leading-relaxed">
        {preview.content}
      </pre>
    )
  }
  if (preview.previewKind === 'image' && downloadUrl) {
    return (
      <img
        data-testid="workspace-image-preview"
        src={downloadUrl}
        alt={preview.name}
        className="max-h-72 w-full rounded-md border border-border object-contain"
      />
    )
  }
  return (
    <div data-testid="workspace-binary-preview" className="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">
      该文件类型暂不支持在线预览，请下载后查看。
    </div>
  )
}

function PresentationPreview({ deck }: { deck: PresentationDeck }) {
  return (
    <div data-testid="workspace-presentation-preview" className="space-y-3">
      <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{deck.title}</div>
          <p className="text-xs text-muted-foreground">{deck.slides.length} 页演示稿</p>
        </div>
        <Presentation className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="space-y-3">
        {deck.slides.map((slide, index) => (
          <section key={`${index}-${slide.title}`} className="aspect-video rounded-md border border-border bg-background p-4">
            <div className="text-xs text-muted-foreground">第 {index + 1} 页</div>
            <h4 className="mt-3 text-base font-semibold">{slide.title}</h4>
            <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
              {slide.body.map((line) => <li key={line}>• {line}</li>)}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}

function PanelSection({
  icon: Icon,
  title,
  description,
  action,
  children,
}: {
  icon: typeof Bot
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
    runtime_type: 'claude_code' as RoleAgentRow['runtime_type'],
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
      runtime_type: agent.runtime_type,
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
      runtime_type: 'claude_code',
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
      runtime_type: form.runtime_type,
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
          <h3 className="text-sm font-medium">角色智能体联系人</h3>
          <p className="text-xs text-muted-foreground">管理当前工作区可 @ 的协作角色</p>
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
            className={`flex w-full items-start gap-3 rounded-lg border border-border p-3 text-left hover:bg-muted ${selected?.id === a.id && !editing ? 'bg-muted' : ''}`}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-sm font-medium">
              {a.name.slice(0, 1)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate font-medium">{a.name}</span>
                {a.is_orchestrator && <Badge variant="warning">编排者</Badge>}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">{roleTypeLabel(a)} · 配置摘要：{runtimeLabel(a.runtime_type)}</span>
              {a.capabilities && a.capabilities.length > 0 && (
                <span className="mt-2 flex flex-wrap gap-1">
                  {a.capabilities.slice(0, 4).map((capability) => (
                    <Badge key={capability} variant="secondary" className="max-w-full truncate">
                      {capability}
                    </Badge>
                  ))}
                </span>
              )}
            </span>
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
            <label htmlFor="agent-runtime-type" className="text-xs font-medium">执行运行时</label>
            <select
              id="agent-runtime-type"
              value={form.runtime_type}
              onChange={(e) => setForm({ ...form, runtime_type: e.target.value as RoleAgentRow['runtime_type'] })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="claude_code">Claude Code</option>
              <option value="codex">Codex</option>
            </select>
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
            <div className="text-xs text-muted-foreground">{roleTypeLabel(selected)}{selected.is_orchestrator ? ' · 可协调分工' : ''}</div>
            <div className="mt-1 text-xs text-muted-foreground">运行时配置摘要：{runtimeLabel(selected.runtime_type)}</div>
          </div>
          {selected.capabilities && selected.capabilities.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {selected.capabilities.map((capability) => (
                <Badge key={capability} variant="secondary">{capability}</Badge>
              ))}
            </div>
          )}
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

function RolesTab() {
  return <AgentsTab />
}

function OrchestrationTab() {
  return (
    <div data-testid="artifact-orchestration" className="space-y-3">
      <OrchestratorPanel />
    </div>
  )
}

function TimelineTab({ deploymentsOnly = false }: { deploymentsOnly?: boolean }) {
  const { activeSessionId } = useSessionStore()
  const [items, setItems] = useState<TimelineItem[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    if (!activeSessionId) return
    setLoaded(false)
    setError(null)
    try {
      const res = await fetch(`/api/sessions/${activeSessionId}/timeline`)
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((body as { error?: string }).error || `读取过程失败（${res.status}）`)
      const rows = Array.isArray((body as { items?: unknown }).items) ? (body as { items: TimelineItem[] }).items : []
      setItems(deploymentsOnly ? rows.filter(isDeploymentItem) : rows)
    } catch (e) {
      setError(e instanceof Error ? e.message : '读取过程失败')
    } finally {
      setLoaded(true)
    }
  }

  useEffect(() => {
    void load()
    const onChanged = () => void load()
    window.addEventListener('actions:changed', onChanged)
    window.addEventListener('artifacts:changed', onChanged)
    window.addEventListener('messages:changed', onChanged)
    return () => {
      window.removeEventListener('actions:changed', onChanged)
      window.removeEventListener('artifacts:changed', onChanged)
      window.removeEventListener('messages:changed', onChanged)
    }
  }, [activeSessionId, deploymentsOnly])

  if (!activeSessionId) return <StateCard variant="empty" title="未选择会话" description="选择会话后可查看完整过程记录" />

  return (
    <div data-testid={deploymentsOnly ? 'artifact-deployment-timeline' : 'artifact-process-timeline'} className="space-y-3">
      <PanelSection
        icon={deploymentsOnly ? Rocket : Route}
        title={deploymentsOnly ? '部署记录' : '会话过程'}
        description={deploymentsOnly ? '只显示当前 session 的部署审批、manifest 和部署产物' : '从真实 DB/API 聚合消息、计划、角色交接、Runtime、权限和产物'}
        action={(
          <Button size="sm" variant="outline" onClick={() => void load()}>
            <RotateCcw className="mr-1 h-3.5 w-3.5" />
            刷新
          </Button>
        )}
      >
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!loaded ? (
          <StateCard variant="loading" title="读取过程记录" />
        ) : items.length === 0 ? (
          <StateCard
            variant="empty"
            title={deploymentsOnly ? '暂无部署记录' : '暂无过程记录'}
            description={deploymentsOnly ? '当前会话还没有部署审批或部署结果' : '当前会话还没有可读回的编排、运行或产物记录'}
          />
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} data-testid="timeline-item" className="rounded-md border border-border bg-background p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <Badge variant="secondary">{timelineKindLabel(item.kind)}</Badge>
                      <span className="truncate font-medium">{item.title}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-muted-foreground">{item.summary}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{formatPanelTime(item.createdAt)}{item.roleName ? ` · @${item.roleName}` : ''}</p>
                    {deploymentsOnly && item.refs && (
                      <dl className="mt-2 grid gap-1 rounded-md bg-muted/40 p-2 text-[11px] leading-4">
                        {(['previewPath', 'manifestPath', 'artifactId'] as const).map((key) => {
                          const value = item.refs?.[key]
                          return typeof value === 'string' && value ? (
                            <div key={key} className="grid grid-cols-[72px_minmax(0,1fr)] gap-2">
                              <dt className="text-muted-foreground">{key}</dt>
                              <dd className="break-all font-mono">{value}</dd>
                            </div>
                          ) : null
                        })}
                      </dl>
                    )}
                  </div>
                  <Badge variant={timelineStatusVariant(item.status)}>{item.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </PanelSection>
    </div>
  )
}

function FileTreeNodeView({
  node,
  level = 0,
  onOpen,
  onContextAction,
}: {
  node: FileTreeNode
  level?: number
  onOpen: (node: FileTreeNode) => void
  onContextAction: (node: FileTreeNode, action: 'rename' | 'delete' | 'artifact') => void
}) {
  const isDir = node.type === 'directory'
  return (
    <div>
      <div
        className="group flex min-w-0 items-center gap-1 rounded-sm pr-1 hover:bg-muted"
        style={{ paddingLeft: 8 + level * 12 }}
        onContextMenu={(event) => {
          event.preventDefault()
          onContextAction(node, 'artifact')
        }}
      >
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left text-xs"
          onClick={() => onOpen(node)}
        >
          {isDir ? <FolderTree className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
          <span className="truncate" title={node.path}>{node.name}</span>
        </button>
        <button
          type="button"
          className="hidden rounded-sm p-1 text-muted-foreground hover:bg-background hover:text-foreground group-hover:inline-flex"
          aria-label={`重命名 ${node.path}`}
          onClick={() => onContextAction(node, 'rename')}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="hidden rounded-sm p-1 text-muted-foreground hover:bg-background hover:text-foreground group-hover:inline-flex"
          aria-label={`存为产物 ${node.path}`}
          onClick={() => onContextAction(node, 'artifact')}
        >
          <PackagePlus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="hidden rounded-sm p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive group-hover:inline-flex"
          aria-label={`删除 ${node.path}`}
          onClick={() => onContextAction(node, 'delete')}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {isDir && node.children?.map((child) => (
        <FileTreeNodeView
          key={child.path}
          node={child}
          level={level + 1}
          onOpen={onOpen}
          onContextAction={onContextAction}
        />
      ))}
    </div>
  )
}

function FileTreeTab() {
  const { activeWorkspaceId, activeSessionId } = useSessionStore()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const editorRef = useRef<HTMLTextAreaElement | null>(null)
  const [tree, setTree] = useState<FileTreeNode[]>([])
  const [root, setRoot] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<FilePreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [artifactStatus, setArtifactStatus] = useState<string | null>(null)
  const [operationStatus, setOperationStatus] = useState<string | null>(null)
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number; text: string } | null>(null)
  const [editInstruction, setEditInstruction] = useState('')
  const [replacementText, setReplacementText] = useState('')
  const [patchDraft, setPatchDraft] = useState<PatchDraft | null>(null)
  const [patchStatus, setPatchStatus] = useState<string | null>(null)

  const loadTree = async () => {
    if (!activeWorkspaceId) return
    setLoaded(false)
    setError(null)
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspaceId}/files`)
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((body as { error?: string }).error || `加载文件树失败（${res.status}）`)
      const payload = body as { root: string; tree: FileTreeNode[] }
      setRoot(payload.root)
      setTree(Array.isArray(payload.tree) ? payload.tree : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载文件树失败')
    } finally {
      setLoaded(true)
    }
  }

  useEffect(() => {
    void loadTree()
  }, [activeWorkspaceId])

  function emitFilesChanged() {
    window.dispatchEvent(new CustomEvent('workspace-files:changed', { detail: { workspaceId: activeWorkspaceId } }))
  }

  async function openNode(node: FileTreeNode) {
    if (!activeWorkspaceId) return
    setPreviewLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspaceId}/files/read?path=${encodeURIComponent(node.path)}`)
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((body as { error?: string }).error || `读取文件失败（${res.status}）`)
      setPreview(body as FilePreview)
      setSelectionRange(null)
      setReplacementText('')
      setPatchDraft(null)
      setPatchStatus(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '读取文件失败')
    } finally {
      setPreviewLoading(false)
    }
  }

  function captureEditorSelection() {
    const editor = editorRef.current
    if (!editor || !preview?.content) return
    const start = editor.selectionStart
    const end = editor.selectionEnd
    const text = preview.content.slice(start, end)
    setSelectionRange({ start, end, text })
    setReplacementText(text)
    setPatchDraft(null)
    setPatchStatus(text ? `已选择 ${text.length} 个字符` : '当前选区为空，将作为插入点')
  }

  function quoteSelection() {
    if (!preview || !selectionRange) return
    const text = selectionRange.text || ''
    if (!text.trim()) {
      setPatchStatus('当前选区为空，无法引用')
      return
    }
    quoteToComposer({
      id: `${preview.path}:${selectionRange.start}-${selectionRange.end}`,
      author: `文件选区：${preview.path}`,
      preview: text.replace(/\s+/g, ' ').trim().slice(0, 120),
      text,
    })
    setPatchStatus('已引用选区到输入框')
  }

  async function generatePatchDraft() {
    if (!activeWorkspaceId || !preview || !selectionRange) return
    setPatchStatus('正在生成编辑草案...')
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspaceId}/files/patch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: preview.path,
          selectionStart: selectionRange.start,
          selectionEnd: selectionRange.end,
          replacement: replacementText,
          instruction: editInstruction,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((body as { error?: string }).error || `生成草案失败（${res.status}）`)
      setPatchDraft((body as { draft: PatchDraft }).draft)
      setPatchStatus('草案已生成，应用前不会写入文件')
    } catch (e) {
      setPatchStatus(e instanceof Error ? e.message : '生成草案失败')
    }
  }

  async function applyPatchDraft() {
    if (!activeWorkspaceId || !preview || !patchDraft) return
    setPatchStatus('正在应用修改...')
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspaceId}/files/patch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: preview.path,
          selectionStart: patchDraft.selectionStart,
          selectionEnd: patchDraft.selectionEnd,
          expectedText: patchDraft.selectedText,
          replacement: patchDraft.replacement,
          apply: true,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((body as { error?: string }).error || `应用修改失败（${res.status}）`)
      setPreview((body as { preview: FilePreview }).preview)
      setPatchDraft(null)
      setSelectionRange(null)
      setReplacementText('')
      setPatchStatus('修改已应用，Git 变更已刷新')
      await loadTree()
      emitFilesChanged()
    } catch (e) {
      setPatchStatus(e instanceof Error ? e.message : '应用修改失败')
    }
  }

  function rejectPatchDraft() {
    setPatchDraft(null)
    setPatchStatus('已拒绝草案，文件未修改')
  }

  async function markFileAsArtifact(filePreview: FilePreview) {
    if (!activeWorkspaceId) return
    setArtifactStatus('正在保存产物...')
    try {
      const res = await fetch('/api/artifacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: activeWorkspaceId,
          session_id: activeSessionId,
          source_path: filePreview.path,
          title: filePreview.name,
          artifact_type: artifactTypeForPreview(filePreview),
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((body as { error?: string }).error || `保存产物失败（${res.status}）`)
      setArtifactStatus('已保存到产物')
      window.dispatchEvent(new CustomEvent('artifacts:changed', { detail: { workspaceId: activeWorkspaceId, sessionId: activeSessionId } }))
    } catch (e) {
      setArtifactStatus(e instanceof Error ? e.message : '保存产物失败')
    }
  }

  async function markPreviewAsArtifact() {
    if (!preview) return
    await markFileAsArtifact(preview)
  }

  async function uploadFile(file: File | null) {
    if (!activeWorkspaceId || !file) return
    setOperationStatus('正在上传文件...')
    setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`/api/workspaces/${activeWorkspaceId}/files/upload`, { method: 'POST', body: form })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((body as { error?: string }).error || `上传失败（${res.status}）`)
      setOperationStatus(`已上传 ${(body as { path?: string }).path ?? file.name}`)
      await loadTree()
      emitFilesChanged()
    } catch (e) {
      setOperationStatus(e instanceof Error ? e.message : '上传失败')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function renameEntry(node: FileTreeNode) {
    if (!activeWorkspaceId) return
    const nextPath = window.prompt('输入新的工作区相对路径', node.path)?.trim()
    if (!nextPath || nextPath === node.path) return
    setOperationStatus('正在重命名...')
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspaceId}/files/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: node.path, to: nextPath }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((body as { error?: string }).error || `重命名失败（${res.status}）`)
      setOperationStatus(`已重命名为 ${(body as { path?: string }).path ?? nextPath}`)
      if (preview?.path === node.path) setPreview(null)
      await loadTree()
      emitFilesChanged()
    } catch (e) {
      setOperationStatus(e instanceof Error ? e.message : '重命名失败')
    }
  }

  async function deleteEntry(node: FileTreeNode) {
    if (!activeWorkspaceId) return
    if (!window.confirm(`确定删除「${node.path}」吗？`)) return
    setOperationStatus('正在删除...')
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspaceId}/files/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: node.path }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((body as { error?: string }).error || `删除失败（${res.status}）`)
      setOperationStatus(`已删除 ${node.path}`)
      if (preview?.path === node.path || preview?.path.startsWith(`${node.path}/`)) setPreview(null)
      await loadTree()
      emitFilesChanged()
    } catch (e) {
      setOperationStatus(e instanceof Error ? e.message : '删除失败')
    }
  }

  async function handleContextAction(node: FileTreeNode, action: 'rename' | 'delete' | 'artifact') {
    if (action === 'rename') {
      await renameEntry(node)
      return
    }
    if (action === 'delete') {
      await deleteEntry(node)
      return
    }
    if (!activeWorkspaceId) return
    setPreviewLoading(true)
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspaceId}/files/read?path=${encodeURIComponent(node.path)}`)
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((body as { error?: string }).error || `读取文件失败（${res.status}）`)
      const filePreview = body as FilePreview
      setPreview(filePreview)
      await markFileAsArtifact(filePreview)
    } catch (e) {
      setArtifactStatus(e instanceof Error ? e.message : '保存产物失败')
    } finally {
      setPreviewLoading(false)
    }
  }

  if (!activeWorkspaceId) return <StateCard variant="empty" title="未选择工作区" description="选择工作区后，其云端项目文件将在此展示" />
  if (error) return <p data-testid="artifact-files-error" className="text-sm text-destructive">{error}</p>
  if (!loaded) return <StateCard variant="loading" title="加载文件树" />
  return (
    <div data-testid="artifact-files" className="space-y-3">
      <div className="rounded-md border border-border bg-muted/30 p-2 text-xs text-muted-foreground">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-medium text-foreground">云端项目目录</div>
            <div className="mt-1 break-all">{root}</div>
          </div>
          <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} data-testid="workspace-file-upload-btn">
            <Upload className="mr-1 h-3.5 w-3.5" />
            上传
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          data-testid="workspace-file-upload-input"
          onChange={(event) => void uploadFile(event.target.files?.[0] ?? null)}
        />
      </div>
      {operationStatus && <p className="text-xs text-muted-foreground">{operationStatus}</p>}
      <div className="rounded-md border border-border bg-background py-1">
        {tree.length === 0 ? (
          <div className="p-3">
            <StateCard variant="empty" title="暂无文件" description="云端项目目录已创建，可上传文件或等待运行时产出文件" />
          </div>
        ) : (
          tree.map((node) => (
            <FileTreeNodeView
              key={node.path}
              node={node}
              onOpen={openNode}
              onContextAction={handleContextAction}
            />
          ))
        )}
      </div>
      <div data-testid="workspace-file-preview" className="space-y-2 rounded-lg border border-border bg-background p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="truncate text-sm font-medium">{preview?.name ?? '文件预览'}</span>
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {preview ? `${preview.path} · ${preview.mime} · ${preview.size} bytes${preview.truncated ? ' · 已截断预览' : ''}` : '点击左侧文件或文件夹查看内容'}
            </p>
          </div>
          {preview && (
            <div className="flex shrink-0 gap-1">
              <Button size="sm" variant="outline" onClick={markPreviewAsArtifact}>
                <PackagePlus className="mr-1 h-3.5 w-3.5" />
                存为产物
              </Button>
              <a
                href={preview.downloadUrl}
                className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-muted"
              >
                <Download className="mr-1 h-3.5 w-3.5" />
                下载
              </a>
            </div>
          )}
        </div>
        {artifactStatus && <p className="text-xs text-muted-foreground">{artifactStatus}</p>}
        {previewLoading && <StateCard variant="loading" title="正在读取文件" />}
        {preview && !previewLoading && <PreviewBlock preview={preview} downloadUrl={preview.downloadUrl} />}
        {isEditablePreview(preview) && preview?.content !== null && !previewLoading && (
          <div data-testid="mini-ide-editor" className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <WandSparkles className="h-4 w-4 text-muted-foreground" />
                  选区编辑草案
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  在下方内容中选择片段，填写替换内容后先生成 diff，确认后再应用到真实文件。
                </p>
              </div>
              <Badge variant={selectionRange?.text ? 'secondary' : 'default'}>
                {selectionRange ? `${selectionRange.end - selectionRange.start} 字符` : '未选择'}
              </Badge>
            </div>
            <textarea
              ref={editorRef}
              readOnly
              value={preview?.content ?? ''}
              onSelect={captureEditorSelection}
              data-testid="mini-ide-source-editor"
              aria-label="文件内容选区"
              className="h-40 w-full resize-y rounded-md border border-border bg-background p-3 font-mono text-xs leading-relaxed outline-none focus:border-primary"
            />
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-xs">
                <span className="font-medium text-foreground">编辑指令</span>
                <input
                  value={editInstruction}
                  onChange={(event) => setEditInstruction(event.target.value)}
                  placeholder="例如：改成更清晰的变量名"
                  className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                />
              </label>
              <label className="space-y-1 text-xs">
                <span className="font-medium text-foreground">替换后的选区内容</span>
                <textarea
                  value={replacementText}
                  onChange={(event) => {
                    setReplacementText(event.target.value)
                    setPatchDraft(null)
                  }}
                  data-testid="mini-ide-replacement"
                  className="h-24 w-full resize-y rounded-md border border-border bg-background p-2 font-mono text-xs leading-relaxed outline-none focus:border-primary"
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={quoteSelection} disabled={!selectionRange?.text}>
                <Copy className="mr-1 h-3.5 w-3.5" />
                引用选区
              </Button>
              <Button size="sm" onClick={() => void generatePatchDraft()} disabled={!selectionRange}>
                <WandSparkles className="mr-1 h-3.5 w-3.5" />
                生成 diff
              </Button>
              {patchDraft && (
                <>
                  <Button size="sm" onClick={() => void applyPatchDraft()}>
                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                    应用修改
                  </Button>
                  <Button size="sm" variant="outline" onClick={rejectPatchDraft}>
                    <RotateCcw className="mr-1 h-3.5 w-3.5" />
                    拒绝
                  </Button>
                </>
              )}
              {patchStatus && <span className="text-xs text-muted-foreground">{patchStatus}</span>}
            </div>
            {patchDraft && (
              <div data-testid="mini-ide-patch-diff" className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">待应用 patch</div>
                <DiffPreview value={patchDraft.diff || '无内容变化'} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
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

function GitTab() {
  const { activeWorkspaceId, activeSessionId } = useSessionStore()
  const [gitChanges, setGitChanges] = useState<GitChangeRow[]>([])
  const [gitCommits, setGitCommits] = useState<GitCommitRow[]>([])
  const [gitLoaded, setGitLoaded] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [gitError, setGitError] = useState<string | null>(null)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [selectedDiffPath, setSelectedDiffPath] = useState<string | null>(null)
  const [selectedDiffStaged, setSelectedDiffStaged] = useState(false)
  const [selectedDiff, setSelectedDiff] = useState('')
  const [diffStatus, setDiffStatus] = useState<string | null>(null)
  const [actionStatus, setActionStatus] = useState<string | null>(null)
  const [pendingDiscardPath, setPendingDiscardPath] = useState<string | null>(null)
  const [pendingDiscardActionId, setPendingDiscardActionId] = useState<string | null>(null)

  const loadGitChanges = async () => {
    if (!activeWorkspaceId) return
    setGitLoaded(false)
    setGitError(null)
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspaceId}/git/status`)
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((body as { error?: string }).error || `读取 Git 状态失败（${res.status}）`)
      setGitChanges(Array.isArray((body as { changes?: unknown }).changes) ? (body as { changes: GitChangeRow[] }).changes : [])
    } catch (e) {
      setGitError(e instanceof Error ? e.message : '读取 Git 状态失败')
    } finally {
      setGitLoaded(true)
    }
  }

  const loadGitHistory = async () => {
    if (!activeWorkspaceId) return
    setHistoryLoaded(false)
    setHistoryError(null)
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspaceId}/git/history?limit=8`)
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((body as { error?: string }).error || `读取提交历史失败（${res.status}）`)
      setGitCommits(Array.isArray((body as { commits?: unknown }).commits) ? (body as { commits: GitCommitRow[] }).commits : [])
    } catch (e) {
      setHistoryError(e instanceof Error ? e.message : '读取提交历史失败')
    } finally {
      setHistoryLoaded(true)
    }
  }

  useEffect(() => {
    void loadGitChanges()
    void loadGitHistory()
    const onChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ workspaceId?: string }>).detail
      if (!detail?.workspaceId || detail.workspaceId === activeWorkspaceId) void loadGitChanges()
    }
    window.addEventListener('workspace-files:changed', onChanged)
    return () => window.removeEventListener('workspace-files:changed', onChanged)
  }, [activeWorkspaceId])

  async function openDiff(filePath: string, staged = false) {
    if (!activeWorkspaceId) return
    setSelectedDiffPath(filePath)
    setSelectedDiffStaged(staged)
    setDiffStatus('正在读取 diff...')
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspaceId}/git/diff?path=${encodeURIComponent(filePath)}&staged=${staged ? 'true' : 'false'}`)
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((body as { error?: string }).error || `读取 diff 失败（${res.status}）`)
      setSelectedDiff(String((body as { diff?: string }).diff ?? ''))
      setDiffStatus(null)
    } catch (e) {
      setDiffStatus(e instanceof Error ? e.message : '读取 diff 失败')
      setSelectedDiff('')
    }
  }

  async function runGitAction(action: 'stage' | 'unstage' | 'discard', filePath: string, confirm = false) {
    if (!activeWorkspaceId) return
    if (action === 'discard' && !confirm) {
      setActionStatus('正在创建丢弃改动授权...')
      try {
        const res = await fetch(`/api/workspaces/${activeWorkspaceId}/git/discard`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: filePath, session_id: activeSessionId }),
        })
        const body = await res.json().catch(() => ({}))
        if (res.status !== 409 || !(body as { approvalRequired?: boolean }).approvalRequired) {
          if (!res.ok) throw new Error((body as { error?: string }).error || `创建授权失败（${res.status}）`)
        }
        setPendingDiscardPath(filePath)
        setPendingDiscardActionId((body as { action?: { id?: string } }).action?.id ?? null)
        setActionStatus(null)
      } catch (e) {
        setActionStatus(e instanceof Error ? e.message : '创建授权失败')
      }
      return
    }
    const labels = { stage: '暂存', unstage: '取消暂存', discard: '丢弃改动' }
    setActionStatus(`正在${labels[action]}...`)
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspaceId}/git/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, confirm, session_id: activeSessionId, action_id: pendingDiscardActionId }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((body as { error?: string }).error || `${labels[action]}失败（${res.status}）`)
      setGitChanges(Array.isArray((body as { changes?: unknown }).changes) ? (body as { changes: GitChangeRow[] }).changes : [])
      setPendingDiscardPath(null)
      setPendingDiscardActionId(null)
      setSelectedDiff('')
      setSelectedDiffPath(null)
      setActionStatus(`${labels[action]}完成`)
    } catch (e) {
      setActionStatus(e instanceof Error ? e.message : `${labels[action]}失败`)
    }
  }

  async function approveDiscard(approved: boolean) {
    if (!pendingDiscardPath) return
    if (!pendingDiscardActionId) {
      if (approved) await runGitAction('discard', pendingDiscardPath, true)
      else setPendingDiscardPath(null)
      return
    }
    setActionStatus(approved ? '正在授权丢弃改动...' : '正在拒绝丢弃改动...')
    try {
      const res = await fetch(`/api/actions/${pendingDiscardActionId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((body as { error?: string }).error || `更新授权失败（${res.status}）`)
      if (approved) {
        await runGitAction('discard', pendingDiscardPath, true)
      } else {
        setPendingDiscardPath(null)
        setPendingDiscardActionId(null)
        setActionStatus('已拒绝丢弃改动')
      }
    } catch (e) {
      setActionStatus(e instanceof Error ? e.message : '更新授权失败')
    }
  }

  async function saveDiffArtifact() {
    if (!activeWorkspaceId || !selectedDiffPath) return
    setDiffStatus('正在保存 diff 产物...')
    try {
      const res = await fetch('/api/artifacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: activeWorkspaceId,
          session_id: activeSessionId,
          title: `${selectedDiffPath}.patch`,
          artifact_type: 'diff',
          content: selectedDiff,
          metadata: { source: 'git_diff', path: selectedDiffPath },
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((body as { error?: string }).error || `保存 diff 产物失败（${res.status}）`)
      setDiffStatus('已保存到产物')
      window.dispatchEvent(new CustomEvent('artifacts:changed', { detail: { workspaceId: activeWorkspaceId, sessionId: activeSessionId } }))
    } catch (e) {
      setDiffStatus(e instanceof Error ? e.message : '保存 diff 产物失败')
    }
  }

  if (!activeWorkspaceId) return <StateCard variant="empty" title="未选择工作区" description="选择工作区后，其 Git 变更将在此展示" />
  const stagedChanges = gitChanges.filter((change) => change.staged)
  const unstagedChanges = gitChanges.filter((change) => change.unstaged || change.untracked || !change.staged)
  const renderChange = (change: GitChangeRow, group: 'staged' | 'unstaged') => (
    <div key={`${group}-${change.status}-${change.path}`} data-testid="git-change-row" className="rounded-lg border border-border bg-background p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <button
            type="button"
            data-testid="git-change-file"
            className="flex max-w-full min-w-0 items-center gap-2 text-left hover:text-primary"
            onClick={() => void openDiff(change.path, group === 'staged')}
          >
            <FileCode2 className="h-4 w-4 text-muted-foreground" />
            <span className="truncate font-medium">{change.path}</span>
          </button>
          <p className="mt-1 text-xs text-muted-foreground">
            {change.untracked ? '未跟踪文件' : group === 'staged' ? '已暂存变更' : '工作区变更'}
          </p>
        </div>
        <Badge variant={change.untracked ? 'warning' : group === 'staged' ? 'success' : 'secondary'}>{change.status.trim() || 'M'}</Badge>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => void openDiff(change.path, group === 'staged')}>
          查看 diff
        </Button>
        {group === 'unstaged' && (
          <Button size="sm" variant="outline" onClick={() => void runGitAction('stage', change.path)}>
            暂存
          </Button>
        )}
        {group === 'staged' && (
          <Button size="sm" variant="outline" onClick={() => void runGitAction('unstage', change.path)}>
            取消暂存
          </Button>
        )}
        {group === 'unstaged' && (
          <Button size="sm" variant="outline" onClick={() => void runGitAction('discard', change.path)}>
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            丢弃
          </Button>
        )}
      </div>
    </div>
  )
  return (
    <div data-testid="artifact-git" className="space-y-4">
      <PanelSection
        icon={GitBranch}
        title="Git 变更"
        description="读取当前云端项目目录的真实 Git 状态；先选文件，再查看 diff"
        action={<Badge variant="secondary">{gitChanges.length} 项</Badge>}
      >
        {gitError && <p className="text-sm text-destructive">{gitError}</p>}
        {actionStatus && <p className="text-xs text-muted-foreground">{actionStatus}</p>}
        {pendingDiscardPath && (
          <div data-testid="git-discard-approval" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">
            <div className="font-medium text-destructive">确认丢弃未暂存改动</div>
            <p className="mt-1 text-xs text-muted-foreground">
              将丢弃 `{pendingDiscardPath}` 的工作区改动。该操作会修改真实 Git 工作区，不能通过 AgentHub 自动恢复。
            </p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={() => void approveDiscard(true)}>
                确认丢弃
              </Button>
              <Button size="sm" variant="outline" onClick={() => void approveDiscard(false)}>
                取消
              </Button>
            </div>
          </div>
        )}
        {!gitLoaded ? (
          <StateCard variant="loading" title="读取 Git 变更" />
        ) : gitChanges.length === 0 ? (
          <StateCard variant="empty" title="暂无 Git 变更" description="当前云端项目没有未提交的文件变更" />
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">未暂存</div>
              {unstagedChanges.length > 0 ? unstagedChanges.map((change) => renderChange(change, 'unstaged')) : (
                <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">没有未暂存变更</div>
              )}
            </div>
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">已暂存</div>
              {stagedChanges.length > 0 ? stagedChanges.map((change) => renderChange(change, 'staged')) : (
                <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">没有已暂存变更</div>
              )}
            </div>
          </div>
        )}
        {selectedDiffPath && (
          <div className="mt-3 space-y-2 rounded-lg border border-border bg-background p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{selectedDiffPath}</div>
                <p className="text-xs text-muted-foreground">{selectedDiffStaged ? '已暂存 diff 预览' : '工作区 diff 预览'}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => void saveDiffArtifact()} disabled={!selectedDiff}>
                <PackagePlus className="mr-1 h-3.5 w-3.5" />
                存为产物
              </Button>
            </div>
            {diffStatus && <p className="text-xs text-muted-foreground">{diffStatus}</p>}
            {selectedDiff ? <DiffPreview value={selectedDiff} /> : !diffStatus ? <StateCard variant="empty" title="无 diff 内容" description="该文件当前没有可展示的 diff" /> : null}
          </div>
        )}
      </PanelSection>
      <PanelSection
        icon={History}
        title="提交历史"
        description="读取当前云端项目目录的真实 Git log"
        action={<Badge variant="secondary">{gitCommits.length} 条</Badge>}
      >
        {historyError && <p className="text-sm text-destructive">{historyError}</p>}
        {!historyLoaded ? (
          <StateCard variant="loading" title="读取提交历史" />
        ) : gitCommits.length === 0 ? (
          <StateCard variant="empty" title="暂无提交历史" description="当前仓库还没有可展示的 Git commit" />
        ) : (
          <div data-testid="git-commit-history" className="space-y-2">
            {gitCommits.map((commit) => (
              <div key={commit.hash} className="rounded-md border border-border bg-background p-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{commit.message}</div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {commit.author} · {commit.date ? new Date(commit.date).toLocaleString('zh-CN') : '未知时间'}
                    </p>
                  </div>
                  <Badge variant="secondary">{commit.shortHash}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </PanelSection>
    </div>
  )
}

function artifactEditableContent(artifact: ArtifactRow) {
  if (artifact.artifact_type === 'document') return artifact.content ?? defaultDocumentContent(artifact.title)
  if (artifact.artifact_type === 'presentation') return artifact.content ?? serializePresentationDeck(defaultPresentationDeck(artifact.title))
  return artifact.content ?? ''
}

function artifactPreviewKind(type: ArtifactDbType): FilePreview['previewKind'] {
  if (type === 'generic_file') return 'binary'
  if (type === 'document') return 'document'
  if (type === 'presentation') return 'presentation'
  return type
}

function ArtifactCard({ artifact, onChanged }: { artifact: ArtifactRow; onChanged: () => void }) {
  const downloadUrl = `/api/artifacts/${artifact.id}/download`
  const isDeploymentArtifact = artifact.metadata?.kind === 'deployment'
  const typeLabel = isDeploymentArtifact ? '部署结果' : artifactTypeLabel(artifact.artifact_type)
  const previewLabel = artifactPreviewLabel(artifact)
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(artifact.title)
  const [content, setContent] = useState(artifactEditableContent(artifact))
  const [instruction, setInstruction] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const editable = ['document', 'presentation', 'markdown', 'html', 'code'].includes(artifact.artifact_type)
  const startCommand = typeof artifact.metadata?.startCommand === 'string' ? artifact.metadata.startCommand : null
  const startScriptPath = typeof artifact.metadata?.startScriptPath === 'string' ? artifact.metadata.startScriptPath : null
  const runnable = ['html', 'folder', 'generic_file', 'code'].includes(artifact.artifact_type) && Boolean(artifact.source_path)

  useEffect(() => {
    setTitle(artifact.title)
    setContent(artifactEditableContent(artifact))
  }, [artifact])
  const preview = {
    previewKind: artifactPreviewKind(artifact.artifact_type),
    content: artifactEditableContent(artifact) || (artifact.artifact_type === 'folder' ? JSON.stringify(artifact.metadata?.manifest ?? {}, null, 2) : null),
    mime: String(artifact.metadata?.mime ?? 'application/octet-stream'),
    path: artifact.source_path ?? artifact.id,
    name: artifact.title,
    truncated: Boolean(artifact.metadata?.truncated),
  } as Pick<FilePreview, 'previewKind' | 'content' | 'mime' | 'path' | 'name' | 'truncated'>

  async function saveArtifact() {
    setStatus('正在保存产物...')
    try {
      const res = await fetch(`/api/artifacts/${artifact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          artifact_type: artifact.artifact_type,
          metadata: { editor: 'web_artifact_panel' },
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((body as { error?: string }).error || `保存失败（${res.status}）`)
      setStatus('已保存')
      setEditing(false)
      onChanged()
    } catch (e) {
      setStatus(e instanceof Error ? e.message : '保存失败')
    }
  }

  async function sendEditRequest() {
    if (!instruction.trim()) {
      setStatus('修改要求不能为空')
      return
    }
    setStatus('正在记录修改要求...')
    try {
      const res = await fetch(`/api/artifacts/${artifact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          edit_request: { instruction: instruction.trim() },
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((body as { error?: string }).error || `记录失败（${res.status}）`)
      setInstruction('')
      setStatus('已记录修改要求，后续 Agent 可基于该产物继续迭代')
      onChanged()
    } catch (e) {
      setStatus(e instanceof Error ? e.message : '记录失败')
    }
  }

  async function generateLaunchScript() {
    setStatus('正在生成启动脚本...')
    try {
      const res = await fetch(`/api/artifacts/${artifact.id}/launch-script`, { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((body as { error?: string }).error || `生成启动脚本失败（${res.status}）`)
      setStatus('启动脚本已生成')
      onChanged()
    } catch (e) {
      setStatus(e instanceof Error ? e.message : '生成启动脚本失败')
    }
  }

  async function copyStartCommand() {
    if (!startCommand || typeof window === 'undefined') return
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(startCommand)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = startCommand
        textarea.setAttribute('readonly', '')
        textarea.style.position = 'absolute'
        textarea.style.left = '-9999px'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        textarea.remove()
      }
      setStatus('启动命令已复制')
    } catch {
      setStatus('复制失败，请手动复制启动命令')
    }
  }

  return (
    <div data-testid="artifact-card" className="space-y-3 rounded-lg border border-border bg-background p-3">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {isDeploymentArtifact ? <PackagePlus className="h-4 w-4 text-muted-foreground" /> : artifact.artifact_type === 'presentation' ? <Presentation className="h-4 w-4 text-muted-foreground" /> : <FileText className="h-4 w-4 text-muted-foreground" />}
            <span className="truncate text-sm font-medium">{artifact.title}</span>
          </div>
          <div className="mt-1 space-y-1 text-xs text-muted-foreground">
            <p className="truncate">{artifact.source_path ? `来源文件：${artifact.source_path}` : `产物 ID：${artifact.id}`}</p>
            <p className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              创建时间：{formatPanelTime(artifact.created_at)}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge variant="secondary">{typeLabel}</Badge>
          <Badge variant={previewLabel === '可预览' ? 'success' : 'warning'}>
            {previewLabel}
          </Badge>
        </div>
      </div>
      {editing ? (
        <div data-testid="rich-artifact-editor" className="space-y-3">
          <div className="grid gap-2">
            <label htmlFor={`artifact-title-${artifact.id}`} className="text-xs font-medium">标题</label>
            <input
              id={`artifact-title-${artifact.id}`}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor={`artifact-content-${artifact.id}`} className="text-xs font-medium">
              {artifact.artifact_type === 'presentation' ? '演示稿 JSON' : '正文内容'}
            </label>
            <textarea
              id={`artifact-content-${artifact.id}`}
              rows={artifact.artifact_type === 'presentation' ? 10 : 8}
              value={content}
              onChange={(event) => setContent(event.target.value)}
              className="min-h-48 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs leading-relaxed"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void saveArtifact()}>
              <Save className="mr-1 h-3.5 w-3.5" />
              保存
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
              取消
            </Button>
          </div>
        </div>
      ) : (
        <PreviewBlock preview={preview} downloadUrl={downloadUrl} />
      )}
      <div data-testid="artifact-launch-panel" className="space-y-2 rounded-md border border-border bg-muted/30 p-2">
        <div className="flex items-center gap-2 text-xs font-medium">
          <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
          启动产物
        </div>
        {startCommand ? (
          <div className="space-y-2">
            {startScriptPath && <p className="break-all text-xs text-muted-foreground">脚本：{startScriptPath}</p>}
            <code data-testid="artifact-start-command" className="block overflow-x-auto rounded-md border border-border bg-background p-2 text-xs">
              {startCommand}
            </code>
            <Button size="sm" variant="outline" onClick={() => void copyStartCommand()}>
              <Copy className="mr-1 h-3.5 w-3.5" />
              复制启动命令
            </Button>
          </div>
        ) : runnable ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => void generateLaunchScript()} data-testid="artifact-generate-launch-script">
              <Terminal className="mr-1 h-3.5 w-3.5" />
              生成启动脚本
            </Button>
            <span className="text-xs text-muted-foreground">将在工作区写入持久脚本，离开当前页面后仍可通过终端启动。</span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">该产物不可启动，可下载或继续编辑。</p>
        )}
      </div>
      <div className="space-y-2 rounded-md border border-border bg-muted/30 p-2">
        <label htmlFor={`artifact-edit-request-${artifact.id}`} className="text-xs font-medium">二次交互编辑</label>
        <textarea
          id={`artifact-edit-request-${artifact.id}`}
          rows={2}
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
          placeholder="例如：把第二页改成问题、方案、收益三段"
        />
        <div className="flex flex-wrap gap-2">
          {editable && (
            <Button size="sm" variant="outline" onClick={() => setEditing((value) => !value)}>
              <Pencil className="mr-1 h-3.5 w-3.5" />
              {editing ? '返回预览' : '基础编辑'}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => void sendEditRequest()}>
            <SendHorizontal className="mr-1 h-3.5 w-3.5" />
            记录修改要求
          </Button>
          <a
            href={downloadUrl}
            className="inline-flex h-8 w-fit items-center justify-center rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-muted"
          >
            <Download className="mr-1 h-3.5 w-3.5" />
            下载产物
          </a>
        </div>
      </div>
      {status && <p className="text-xs text-muted-foreground">{status}</p>}
    </div>
  )
}

function ArtifactsTab() {
  const { activeWorkspaceId, activeSessionId } = useSessionStore()
  const [artifacts, setArtifacts] = useState<ArtifactRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [createStatus, setCreateStatus] = useState<string | null>(null)
  const loadRef = useRef<(() => void) | null>(null)
  useEffect(() => {
    if (!activeWorkspaceId) return
    const load = () => {
      setLoaded(false)
      const query = new URLSearchParams({ workspace_id: activeWorkspaceId })
      if (activeSessionId) query.set('session_id', activeSessionId)
      fetch(`/api/artifacts?${query.toString()}`)
        .then((r) => { if (!r.ok) throw new Error('加载产物失败'); return r.json() })
        .then((d: ArtifactRow[]) => setArtifacts(Array.isArray(d) ? d : []))
        .catch((e) => setError(e instanceof Error ? e.message : '加载产物失败'))
        .finally(() => setLoaded(true))
    }
    loadRef.current = load
    load()
    const onChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ workspaceId?: string; sessionId?: string | null }>).detail
      if (!detail?.workspaceId || detail.workspaceId === activeWorkspaceId) load()
    }
    window.addEventListener('artifacts:changed', onChanged)
    return () => window.removeEventListener('artifacts:changed', onChanged)
  }, [activeWorkspaceId, activeSessionId])

  async function createRichArtifact(type: 'document' | 'presentation') {
    if (!activeWorkspaceId || !activeSessionId) return
    const title = type === 'document' ? '新建富文档' : '新建演示稿'
    setCreateStatus(`正在创建${type === 'document' ? '富文档' : '演示稿'}...`)
    try {
      const content = type === 'document'
        ? defaultDocumentContent(title)
        : serializePresentationDeck(defaultPresentationDeck(title))
      const res = await fetch('/api/artifacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: activeWorkspaceId,
          session_id: activeSessionId,
          title,
          artifact_type: type,
          content,
          metadata: { source: 'web_artifact_panel', editor: 'web_artifact_panel' },
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((body as { error?: string }).error || `创建失败（${res.status}）`)
      setCreateStatus('已创建产物')
      window.dispatchEvent(new CustomEvent('artifacts:changed', { detail: { workspaceId: activeWorkspaceId, sessionId: activeSessionId } }))
      loadRef.current?.()
    } catch (e) {
      setCreateStatus(e instanceof Error ? e.message : '创建失败')
    }
  }

  if (!activeWorkspaceId) return <StateCard variant="empty" title="未选择工作区" description="选择工作区后，Agent 产出的产物将在此展示" />
  if (!activeSessionId) return <StateCard variant="empty" title="未选择会话" description="选择会话后，Agent 产出的产物将在此展示" />
  if (error) return <p data-testid="artifact-output-error" className="text-sm text-destructive">{error}</p>
  return (
    <div data-testid="artifact-output" className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/30 p-2">
        <Button size="sm" variant="outline" onClick={() => void createRichArtifact('document')} data-testid="create-document-artifact">
          <FileText className="mr-1 h-3.5 w-3.5" />
          新建富文档
        </Button>
        <Button size="sm" variant="outline" onClick={() => void createRichArtifact('presentation')} data-testid="create-presentation-artifact">
          <Presentation className="mr-1 h-3.5 w-3.5" />
          新建演示稿
        </Button>
        {createStatus && <span className="text-xs text-muted-foreground">{createStatus}</span>}
      </div>
      {!loaded ? (
        <StateCard variant="loading" title="加载产物" />
      ) : artifacts.length === 0 ? (
        <StateCard variant="empty" title="暂无产物" description="当前会话还没有 Agent 产出的代码、文件或结果，可先新建富文档或演示稿" />
      ) : (
        artifacts.map((artifact) => (
          <ArtifactCard
            key={artifact.id}
            artifact={artifact}
            onChanged={() => {
              window.dispatchEvent(new CustomEvent('artifacts:changed', { detail: { workspaceId: activeWorkspaceId, sessionId: activeSessionId } }))
              loadRef.current?.()
            }}
          />
        ))
      )}
    </div>
  )
}

export function ArtifactPanel({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>('角色')

  return (
    <aside data-testid="artifact-panel" className="flex flex-col h-full bg-card">
      <div className="border-b border-border p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Boxes className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">会话工作台</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">角色、编排、文件、Git 和产物按职责拆分</p>
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
              data-testid={`artifact-tab-${tab}`}
            >
              {tab === '角色' && <ShieldCheck className="mr-1 h-3.5 w-3.5" />}
              {tab === '过程' && <Route className="mr-1 h-3.5 w-3.5" />}
              {tab === '编排' && <Bot className="mr-1 h-3.5 w-3.5" />}
              {tab === '文件' && <FolderTree className="mr-1 h-3.5 w-3.5" />}
              {tab === 'Git' && <GitBranch className="mr-1 h-3.5 w-3.5" />}
              {tab === '产物' && <FileText className="mr-1 h-3.5 w-3.5" />}
              {tab === '部署' && <Rocket className="mr-1 h-3.5 w-3.5" />}
              {tab}
            </Button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {activeTab === '角色' && <RolesTab />}
        {activeTab === '过程' && <TimelineTab />}
        {activeTab === '编排' && <OrchestrationTab />}
        {activeTab === '文件' && <FileTreeTab />}
        {activeTab === 'Git' && <GitTab />}
        {activeTab === '产物' && <ArtifactsTab />}
        {activeTab === '部署' && <TimelineTab deploymentsOnly />}
      </div>
    </aside>
  )
}
