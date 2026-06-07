'use client'

import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Badge, Button, StateCard } from '@agenthub/ui'
import { Bot, Boxes, Check, ChevronDown, ChevronRight, Clock, Download, FileCode2, FileText, FolderTree, GitBranch, History, Maximize2, Minimize2, PackagePlus, Pencil, Plus, Presentation, Rocket, Route, RotateCcw, Save, SendHorizontal, ShieldCheck, Square, Trash2, Upload, X } from 'lucide-react'
import { OrchestratorPanel } from '../orchestrator/OrchestratorPanel'
import { useSessionStore } from '@/store/session-store'
import { defaultDocumentContent, defaultPresentationDeck, parsePresentationDeck, serializePresentationDeck, type ArtifactDbType, type PresentationDeck } from '@/lib/artifacts/rich-artifacts'
import { roleAvatarColorClass, roleBadgeColorClass, roleMessageColorClass } from '@/lib/role-colors'

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
type GitChangeTreeNode = {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: GitChangeTreeNode[]
  change?: GitChangeRow
  group?: 'staged' | 'unstaged'
  descendantCount?: number
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

function quoteToComposer(input: { id?: string; author: string; preview: string; text: string; suggestedPrompt?: string }) {
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

function lineColumnFromOffset(content: string, offset: number) {
  const before = content.slice(0, Math.max(0, offset))
  const lines = before.split('\n')
  return { line: lines.length, column: (lines.at(-1) ?? '').length + 1 }
}

function selectionReference(preview: FilePreview, range: { start: number; end: number; text: string }) {
  const start = lineColumnFromOffset(preview.content ?? '', range.start)
  const end = lineColumnFromOffset(preview.content ?? '', range.end)
  const count = Array.from(range.text).length
  const lineLabel = start.line === end.line ? `第 ${start.line} 行` : `第 ${start.line}-${end.line} 行`
  return {
    lineLabel,
    count,
    preview: `${preview.path} ${lineLabel}，${count} 字`,
    suggestedPrompt: `请根据引用的文件选区修改 ${preview.path} ${lineLabel}（${count} 字）。`,
  }
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

function ancestorDirectoryPaths(filePath: string) {
  const parts = filePath.split('/').filter(Boolean)
  return parts.slice(0, -1).map((_, index) => parts.slice(0, index + 1).join('/'))
}

function buildGitChangeTree(changes: GitChangeRow[], group: 'staged' | 'unstaged') {
  const roots: GitChangeTreeNode[] = []
  const dirMap = new Map<string, GitChangeTreeNode>()
  for (const change of changes) {
    const parts = change.path.split('/').filter(Boolean)
    let siblings = roots
    let currentPath = ''
    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index] ?? ''
      currentPath = currentPath ? `${currentPath}/${part}` : part
      const isFile = index === parts.length - 1
      if (isFile) {
        siblings.push({ name: part, path: change.path, type: 'file', change, group })
        continue
      }
      let dir = dirMap.get(`${group}:${currentPath}`)
      if (!dir) {
        dir = { name: part, path: currentPath, type: 'directory', children: [], descendantCount: 0 }
        dirMap.set(`${group}:${currentPath}`, dir)
        siblings.push(dir)
      }
      dir.descendantCount = (dir.descendantCount ?? 0) + 1
      siblings = dir.children ?? []
    }
  }
  return roots
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
            className={`flex w-full items-start gap-3 rounded-lg border border-l-4 border-border p-3 text-left hover:bg-muted ${roleMessageColorClass(a.id, a.name)} ${selected?.id === a.id && !editing ? 'ring-1 ring-ring' : ''}`}
          >
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border text-sm font-medium ${roleAvatarColorClass(a.id, a.name)}`}>
              {a.name.slice(0, 1)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate font-medium">{a.name}</span>
                {a.is_orchestrator && <Badge variant="secondary" className={roleBadgeColorClass(a.id, a.name)}>编排者</Badge>}
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
  selectedPath,
  expandedPaths,
  onToggle,
  onOpen,
  onContextAction,
}: {
  node: FileTreeNode
  level?: number
  selectedPath?: string | null
  expandedPaths: Set<string>
  onToggle: (path: string) => void
  onOpen: (node: FileTreeNode) => void
  onContextAction: (node: FileTreeNode, action: 'delete' | 'artifact') => void
}) {
  const isDir = node.type === 'directory'
  const expanded = isDir && expandedPaths.has(node.path)
  const selected = selectedPath === node.path
  return (
    <div>
      <div
        className={`group flex min-w-0 items-center gap-1 rounded-sm pr-1 hover:bg-muted ${selected ? 'bg-muted text-foreground' : ''}`}
        style={{ paddingLeft: 8 + level * 12 }}
        onContextMenu={(event) => {
          event.preventDefault()
          onContextAction(node, 'artifact')
        }}
      >
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left text-xs"
          data-testid={isDir ? 'workspace-folder-node' : 'workspace-file-node'}
          onClick={() => {
            if (isDir) {
              onToggle(node.path)
              return
            }
            onOpen(node)
          }}
        >
          {isDir ? (
            <>
              {expanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
              <FolderTree className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </>
          ) : <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
          <span className="truncate" title={node.path}>{node.name}</span>
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
      {expanded && node.children?.map((child) => (
        <FileTreeNodeView
          key={child.path}
          node={child}
          level={level + 1}
          selectedPath={selectedPath}
          expandedPaths={expandedPaths}
          onToggle={onToggle}
          onOpen={onOpen}
          onContextAction={onContextAction}
        />
      ))}
    </div>
  )
}

function FileTreeTab({ wideMode, onRequestWide }: { wideMode: boolean; onRequestWide: (wide?: boolean) => void }) {
  const { activeWorkspaceId, activeSessionId } = useSessionStore()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const editorRef = useRef<HTMLTextAreaElement | null>(null)
  const [tree, setTree] = useState<FileTreeNode[]>([])
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const [root, setRoot] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<FilePreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [artifactStatus, setArtifactStatus] = useState<string | null>(null)
  const [operationStatus, setOperationStatus] = useState<string | null>(null)
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number; text: string } | null>(null)
  const [patchStatus, setPatchStatus] = useState<string | null>(null)
  const [showCreateFile, setShowCreateFile] = useState(false)
  const [newFilePath, setNewFilePath] = useState('')
  const [newFileContent, setNewFileContent] = useState('')

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
      const nextTree = Array.isArray(payload.tree) ? payload.tree : []
      setTree(nextTree)
      setExpandedPaths((current) => current.size > 0 ? current : new Set())
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
    onRequestWide(true)
    setExpandedPaths((current) => {
      const next = new Set(current)
      ancestorDirectoryPaths(node.path).forEach((path) => next.add(path))
      return next
    })
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspaceId}/files/read?path=${encodeURIComponent(node.path)}`)
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((body as { error?: string }).error || `读取文件失败（${res.status}）`)
      setPreview(body as FilePreview)
      setSelectionRange(null)
      setPatchStatus(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '读取文件失败')
    } finally {
      setPreviewLoading(false)
    }
  }

  function toggleFolder(path: string) {
    setExpandedPaths((current) => {
      const next = new Set(current)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  function captureEditorSelection() {
    const editor = editorRef.current
    if (!editor || !preview?.content) return
    const start = editor.selectionStart
    const end = editor.selectionEnd
    const text = preview.content.slice(start, end)
    setSelectionRange({ start, end, text })
    if (text) {
      const ref = selectionReference(preview, { start, end, text })
      setPatchStatus(`已选择 ${ref.lineLabel}，${ref.count} 字`)
    } else {
      setPatchStatus('当前选区为空，请选择需要修改的内容')
    }
  }

  function sendSelectionEditRequest() {
    if (!preview || !selectionRange) return
    const text = selectionRange.text || ''
    if (!text.trim()) {
      setPatchStatus('当前选区为空，无法引用')
      return
    }
    const ref = selectionReference(preview, selectionRange)
    quoteToComposer({
      id: `${preview.path}:${selectionRange.start}-${selectionRange.end}`,
      author: `文件选区：${preview.path}`,
      preview: ref.preview,
      text,
      suggestedPrompt: ref.suggestedPrompt,
    })
    setPatchStatus(`已引用 ${ref.preview}`)
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

  async function createFile() {
    if (!activeWorkspaceId) return
    const pathValue = newFilePath.trim().replace(/^\/+/, '')
    if (!pathValue) {
      setOperationStatus('请输入工作区相对路径')
      return
    }
    setOperationStatus('正在创建文件...')
    setError(null)
    try {
      const form = new FormData()
      const basename = pathValue.split('/').filter(Boolean).pop() ?? 'new-file.txt'
      const targetDir = pathValue.includes('/') ? pathValue.split('/').slice(0, -1).join('/') : ''
      form.append('file', new File([newFileContent], basename, { type: 'text/plain' }))
      if (targetDir) form.append('target_dir', targetDir)
      const res = await fetch(`/api/workspaces/${activeWorkspaceId}/files/upload`, { method: 'POST', body: form })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((body as { error?: string }).error || `创建文件失败（${res.status}）`)
      const createdPath = (body as { path?: string }).path ?? pathValue
      setOperationStatus(`已创建 ${createdPath}`)
      setNewFilePath('')
      setNewFileContent('')
      setShowCreateFile(false)
      setExpandedPaths((current) => {
        const next = new Set(current)
        ancestorDirectoryPaths(createdPath).forEach((path) => next.add(path))
        return next
      })
      await loadTree()
      emitFilesChanged()
      await openNode({ name: basename, path: createdPath, type: 'file' })
    } catch (e) {
      setOperationStatus(e instanceof Error ? e.message : '创建文件失败')
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

  async function handleContextAction(node: FileTreeNode, action: 'delete' | 'artifact') {
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
          <div className="flex shrink-0 flex-wrap justify-end gap-1">
            <Button size="sm" variant="outline" onClick={() => setShowCreateFile((value) => !value)} data-testid="workspace-new-file-button">
              <Plus className="mr-1 h-3.5 w-3.5" />
              新建
            </Button>
            <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} data-testid="workspace-file-upload-btn">
              <Upload className="mr-1 h-3.5 w-3.5" />
              上传
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onRequestWide(!wideMode)} data-testid="workspace-file-wide-toggle" aria-label={wideMode ? '收起文件工作台' : '展开文件工作台'}>
              {wideMode ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          data-testid="workspace-file-upload-input"
          onChange={(event) => void uploadFile(event.target.files?.[0] ?? null)}
        />
      </div>
      {showCreateFile && (
        <div data-testid="workspace-new-file-form" className="space-y-2 rounded-md border border-border bg-background p-3">
          <label className="grid gap-1 text-xs">
            <span className="font-medium text-foreground">文件路径</span>
            <input
              value={newFilePath}
              onChange={(event) => setNewFilePath(event.target.value)}
              placeholder="例如：public/index.html"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="grid gap-1 text-xs">
            <span className="font-medium text-foreground">初始内容</span>
            <textarea
              value={newFileContent}
              onChange={(event) => setNewFileContent(event.target.value)}
              rows={5}
              className="rounded-md border border-input bg-background p-3 font-mono text-xs outline-none focus:border-primary"
            />
          </label>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void createFile()}>创建文件</Button>
            <Button size="sm" variant="outline" onClick={() => setShowCreateFile(false)}>取消</Button>
          </div>
        </div>
      )}
      {operationStatus && <p className="text-xs text-muted-foreground">{operationStatus}</p>}
      <div className={wideMode ? 'grid min-h-0 gap-3 lg:grid-cols-[280px_minmax(0,1fr)]' : 'space-y-3'}>
        <div data-testid="workspace-file-tree" className="max-h-[56vh] overflow-auto rounded-md border border-border bg-background py-1">
          {tree.length === 0 ? (
            <div className="p-3">
              <StateCard variant="empty" title="暂无文件" description="云端项目目录已创建，可上传文件或新建文件" />
            </div>
          ) : (
            tree.map((node) => (
              <FileTreeNodeView
                key={node.path}
                node={node}
                selectedPath={preview?.path}
                expandedPaths={expandedPaths}
                onToggle={toggleFolder}
                onOpen={openNode}
                onContextAction={handleContextAction}
              />
            ))
          )}
        </div>
      <div data-testid="workspace-file-preview" className="space-y-2 rounded-lg border border-border bg-background p-3">
        <div data-testid="workspace-file-viewer" className="space-y-2">
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
        {isEditablePreview(preview) && preview?.content !== null && !previewLoading && (
          <div data-testid="mini-ide-editor" className="relative">
            <textarea
              ref={editorRef}
              readOnly
              value={preview?.content ?? ''}
              onSelect={captureEditorSelection}
              data-testid="mini-ide-source-editor"
              aria-label="文件内容选区"
              className="h-72 w-full resize-y rounded-md border border-border bg-muted p-3 font-mono text-xs leading-relaxed outline-none focus:border-primary"
            />
            {selectionRange?.text && (
              <Button
                size="sm"
                onClick={sendSelectionEditRequest}
                data-testid="mini-ide-send-selection-edit"
                className="absolute right-3 top-3 shadow-md"
              >
                <SendHorizontal className="mr-1 h-3.5 w-3.5" />
                引用内容
              </Button>
            )}
          </div>
        )}
        {preview && !isEditablePreview(preview) && !previewLoading && <PreviewBlock preview={preview} downloadUrl={preview.downloadUrl} />}
        {patchStatus && <p className="text-xs text-muted-foreground">{patchStatus}</p>}
        </div>
      </div>
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

function GitChangeTreeView({
  nodes,
  group,
  selectedPath,
  expandedPaths,
  onToggle,
  onOpen,
  onQuickAction,
  onQuickPathAction,
}: {
  nodes: GitChangeTreeNode[]
  group: 'staged' | 'unstaged'
  selectedPath: string | null
  expandedPaths: Set<string>
  onToggle: (path: string) => void
  onOpen: (change: GitChangeRow, group: 'staged' | 'unstaged') => void
  onQuickAction: (action: 'stage' | 'unstage', change: GitChangeRow) => void
  onQuickPathAction: (action: 'stage' | 'unstage', path: string) => void
}) {
  if (nodes.length === 0) {
    return <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">没有{group === 'staged' ? '已暂存' : '未暂存'}变更</div>
  }
  const renderNode = (node: GitChangeTreeNode, level = 0): React.ReactNode => {
    const isDir = node.type === 'directory'
    const expanded = isDir && expandedPaths.has(`${group}:${node.path}`)
    const selected = !isDir && selectedPath === node.path
    return (
      <div key={`${group}-${node.type}-${node.path}`}>
        <div
          data-testid={isDir ? 'workspace-git-folder-node' : 'workspace-git-file-node'}
          className={`group flex w-full min-w-0 items-center gap-1 rounded-sm pr-1 text-xs hover:bg-muted ${selected ? 'bg-muted text-foreground' : ''}`}
          style={{ paddingLeft: 8 + level * 12 }}
        >
          <button
            type="button"
            data-testid={isDir ? 'workspace-git-folder-toggle' : 'workspace-git-open-diff'}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-sm py-1 pr-1 text-left hover:text-foreground"
            onClick={() => {
              if (isDir) {
                onToggle(`${group}:${node.path}`)
                return
              }
              if (node.change) onOpen(node.change, group)
            }}
          >
            {isDir ? (
              <>
                {expanded ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                <FolderTree className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </>
            ) : (
              <FileCode2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
            <span className="min-w-0 flex-1 truncate" title={node.path}>{node.name}</span>
          </button>
          {node.change && <Badge variant={node.change.untracked ? 'warning' : group === 'staged' ? 'success' : 'secondary'}>{node.change.status.trim() || 'M'}</Badge>}
          {isDir && (
            <>
              <Badge variant="secondary">{node.descendantCount ?? node.children?.length ?? 0}</Badge>
              <button
                type="button"
                data-testid={group === 'staged' ? 'workspace-git-folder-unstage-button' : 'workspace-git-folder-stage-button'}
                aria-label={group === 'staged' ? `取消暂存目录 ${node.path}` : `暂存目录 ${node.path}`}
                title={group === 'staged' ? '取消暂存目录' : '暂存目录'}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-sm font-medium text-muted-foreground opacity-70 hover:bg-background hover:text-foreground group-hover:opacity-100"
                onClick={(event) => {
                  event.stopPropagation()
                  onQuickPathAction(group === 'staged' ? 'unstage' : 'stage', node.path)
                }}
              >
                {group === 'staged' ? '-' : '+'}
              </button>
            </>
          )}
          {node.change && (
            <button
              type="button"
              data-testid={group === 'staged' ? 'workspace-git-unstage-button' : 'workspace-git-stage-button'}
              aria-label={group === 'staged' ? `取消暂存 ${node.path}` : `暂存 ${node.path}`}
              title={group === 'staged' ? '取消暂存' : '暂存'}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-sm font-medium text-muted-foreground opacity-70 hover:bg-background hover:text-foreground group-hover:opacity-100"
              onClick={(event) => {
                event.stopPropagation()
                onQuickAction(group === 'staged' ? 'unstage' : 'stage', node.change!)
              }}
            >
              {group === 'staged' ? '-' : '+'}
            </button>
          )}
        </div>
        {expanded && node.children?.map((child) => renderNode(child, level + 1))}
      </div>
    )
  }
  return <div className="space-y-0.5">{nodes.map((node) => renderNode(node))}</div>
}

function GitTab({ wideMode, onRequestWide }: { wideMode: boolean; onRequestWide: (wide?: boolean) => void }) {
  const { activeWorkspaceId, activeSessionId } = useSessionStore()
  const [gitChanges, setGitChanges] = useState<GitChangeRow[]>([])
  const [gitExpandedPaths, setGitExpandedPaths] = useState<Set<string>>(new Set())
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
  const [commitMessage, setCommitMessage] = useState('')
  const [commitStatus, setCommitStatus] = useState<string | null>(null)
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
      const changes = Array.isArray((body as { changes?: unknown }).changes) ? (body as { changes: GitChangeRow[] }).changes : []
      setGitChanges(changes)
      setGitExpandedPaths((current) => current.size > 0 ? current : new Set())
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
    onRequestWide(true)
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

  function toggleGitFolder(path: string) {
    setGitExpandedPaths((current) => {
      const next = new Set(current)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
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
      await loadGitHistory()
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

  async function commitStagedChanges() {
    if (!activeWorkspaceId) return
    const message = commitMessage.trim()
    if (!message) {
      setCommitStatus('请输入提交说明')
      return
    }
    setCommitStatus('正在提交已暂存变更...')
    try {
      const res = await fetch(`/api/workspaces/${activeWorkspaceId}/git/commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((body as { error?: string }).error || `提交失败（${res.status}）`)
      setCommitMessage('')
      setGitChanges(Array.isArray((body as { changes?: unknown }).changes) ? (body as { changes: GitChangeRow[] }).changes : [])
      setGitCommits(Array.isArray((body as { commits?: unknown }).commits) ? (body as { commits: GitCommitRow[] }).commits : [])
      setSelectedDiff('')
      setSelectedDiffPath(null)
      setCommitStatus('提交完成')
      window.dispatchEvent(new CustomEvent('workspace-files:changed', { detail: { workspaceId: activeWorkspaceId } }))
    } catch (e) {
      setCommitStatus(e instanceof Error ? e.message : '提交失败')
    }
  }

  if (!activeWorkspaceId) return <StateCard variant="empty" title="未选择工作区" description="选择工作区后，其 Git 变更将在此展示" />
  const stagedChanges = gitChanges.filter((change) => change.staged)
  const unstagedChanges = gitChanges.filter((change) => change.unstaged || change.untracked || !change.staged)
  const stagedTree = buildGitChangeTree(stagedChanges, 'staged')
  const unstagedTree = buildGitChangeTree(unstagedChanges, 'unstaged')
  const selectedChange = selectedDiffPath
    ? gitChanges.find((change) => change.path === selectedDiffPath && (selectedDiffStaged ? change.staged : !change.staged || change.unstaged || change.untracked))
    : null
  return (
    <div data-testid="artifact-git" className="space-y-4">
      <PanelSection
        icon={GitBranch}
        title="Git 变更"
        description="读取当前云端项目目录的真实 Git 状态；先选文件，再查看变更内容"
        action={(
          <div className="flex items-center gap-1">
            <Badge variant="secondary">{gitChanges.length} 项</Badge>
            <Button size="sm" variant="ghost" onClick={() => onRequestWide(!wideMode)} data-testid="workspace-git-wide-toggle" aria-label={wideMode ? '收起 Git 工作台' : '展开 Git 工作台'}>
              {wideMode ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </Button>
          </div>
        )}
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
          <div className={wideMode ? 'grid min-h-0 gap-3 lg:grid-cols-[280px_minmax(0,1fr)]' : 'space-y-3'}>
            <div data-testid="workspace-git-tree" className="max-h-[56vh] overflow-auto rounded-md border border-border bg-background p-2">
              <div className="mb-2 flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
                <span>未暂存</span>
                <button
                  type="button"
                  data-testid="workspace-git-stage-root-button"
                  aria-label="暂存根目录所有未暂存变更"
                  title="暂存全部"
                  className="flex h-6 w-6 items-center justify-center rounded-sm text-sm font-medium hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={unstagedChanges.length === 0}
                  onClick={() => void runGitAction('stage', '.')}
                >
                  +
                </button>
              </div>
              <GitChangeTreeView
                nodes={unstagedTree}
                group="unstaged"
                selectedPath={selectedDiffStaged ? null : selectedDiffPath}
                expandedPaths={gitExpandedPaths}
                onToggle={toggleGitFolder}
                onOpen={(change, group) => void openDiff(change.path, group === 'staged')}
                onQuickAction={(action, change) => void runGitAction(action, change.path)}
                onQuickPathAction={(action, path) => void runGitAction(action, path)}
              />
              <div className="mb-2 mt-4 flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
                <span>已暂存</span>
                <button
                  type="button"
                  data-testid="workspace-git-unstage-root-button"
                  aria-label="取消暂存所有已暂存变更"
                  title="取消暂存全部"
                  className="flex h-6 w-6 items-center justify-center rounded-sm text-sm font-medium hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={stagedChanges.length === 0}
                  onClick={() => void runGitAction('unstage', '.')}
                >
                  -
                </button>
              </div>
              <GitChangeTreeView
                nodes={stagedTree}
                group="staged"
                selectedPath={selectedDiffStaged ? selectedDiffPath : null}
                expandedPaths={gitExpandedPaths}
                onToggle={toggleGitFolder}
                onOpen={(change, group) => void openDiff(change.path, group === 'staged')}
                onQuickAction={(action, change) => void runGitAction(action, change.path)}
                onQuickPathAction={(action, path) => void runGitAction(action, path)}
              />
            </div>
            <div data-testid="workspace-git-diff-viewer" className="min-w-0">
              {!selectedDiffPath ? (
                <StateCard variant="empty" title="选择文件查看变更" description="左侧只显示文件名和状态，点击后才读取具体变更内容" />
              ) : (
                <div className="space-y-2 rounded-lg border border-border bg-background p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{selectedDiffPath}</div>
                      <p className="text-xs text-muted-foreground">{selectedDiffStaged ? '已暂存 diff 预览' : selectedChange?.untracked ? '未跟踪文件 diff 预览' : '工作区 diff 预览'}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => void saveDiffArtifact()} disabled={!selectedDiff}>
                      <PackagePlus className="mr-1 h-3.5 w-3.5" />
                      存为产物
                    </Button>
                  </div>
                  {selectedChange && (
                    <div data-testid="git-change-actions" className="flex flex-wrap gap-2">
                      {!selectedDiffStaged && (
                        <Button size="sm" variant="outline" onClick={() => void runGitAction('stage', selectedChange.path)}>
                          暂存
                        </Button>
                      )}
                      {selectedDiffStaged && (
                        <Button size="sm" variant="outline" onClick={() => void runGitAction('unstage', selectedChange.path)}>
                          取消暂存
                        </Button>
                      )}
                      {!selectedDiffStaged && (
                        <Button size="sm" variant="outline" onClick={() => void runGitAction('discard', selectedChange.path)}>
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          丢弃
                        </Button>
                      )}
                    </div>
                  )}
                  {diffStatus && <p className="text-xs text-muted-foreground">{diffStatus}</p>}
                  {selectedDiff ? <DiffPreview value={selectedDiff} /> : !diffStatus ? <StateCard variant="empty" title="无 diff 内容" description="该文件当前没有可展示的 diff" /> : null}
                </div>
              )}
            </div>
          </div>
        )}
      </PanelSection>
      <PanelSection
        icon={History}
        title="提交历史"
        description="读取当前云端项目目录的真实 Git log"
        action={<Badge variant="secondary">{gitCommits.length} 条</Badge>}
      >
        <div data-testid="git-commit-form" className="mb-3 space-y-2 rounded-md border border-border bg-muted/30 p-2">
          <label htmlFor="git-commit-message" className="text-xs font-medium">提交已暂存变更</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="git-commit-message"
              value={commitMessage}
              onChange={(event) => setCommitMessage(event.target.value)}
              placeholder="输入 commit message"
              className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
            />
            <Button
              size="sm"
              onClick={() => void commitStagedChanges()}
              disabled={stagedChanges.length === 0}
              data-testid="workspace-git-commit-button"
            >
              <Check className="mr-1 h-3.5 w-3.5" />
              提交
            </Button>
          </div>
          {commitStatus && <p className="text-xs text-muted-foreground">{commitStatus}</p>}
        </div>
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
  const [status, setStatus] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [publishState, setPublishState] = useState<'running' | 'stopped'>(
    artifact.metadata?.publishStatus === 'running' ? 'running' : 'stopped',
  )
  const [publishUrl, setPublishUrl] = useState<string | null>(
    typeof artifact.metadata?.publishUrl === 'string' ? artifact.metadata.publishUrl : null,
  )
  const editable = ['document', 'presentation', 'markdown', 'html', 'code'].includes(artifact.artifact_type)
  const runnable = ['html', 'folder', 'generic_file', 'code'].includes(artifact.artifact_type) && Boolean(artifact.source_path)

  useEffect(() => {
    setTitle(artifact.title)
    setContent(artifactEditableContent(artifact))
    setPublishState(artifact.metadata?.publishStatus === 'running' ? 'running' : 'stopped')
    setPublishUrl(typeof artifact.metadata?.publishUrl === 'string' ? artifact.metadata.publishUrl : null)
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

  async function publishArtifact(action: 'start' | 'stop') {
    if (!runnable && action === 'start') {
      setStatus('该产物不可发布，可下载或继续编辑。')
      return
    }
    setPublishing(true)
    setStatus(action === 'start' ? '正在启动发布...' : '正在停止发布...')
    try {
      const res = await fetch(`/api/artifacts/${artifact.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error((body as { error?: string }).error || `发布操作失败（${res.status}）`)
      if (action === 'start') {
        const nextUrl = typeof (body as { url?: unknown }).url === 'string' ? (body as { url: string }).url : null
        setPublishState('running')
        setPublishUrl(nextUrl)
        setStatus(nextUrl ? '发布已启动，可打开链接访问。' : '发布已启动。')
      } else {
        setPublishState('stopped')
        setStatus('发布已停止。')
      }
      onChanged()
    } catch (e) {
      setStatus(e instanceof Error ? e.message : '发布操作失败')
    } finally {
      setPublishing(false)
    }
  }

  function quoteArtifactToComposer() {
    const source = artifact.source_path ? `来源文件：${artifact.source_path}` : `产物 ID：${artifact.id}`
    const inlineContent = artifactEditableContent(artifact).trim()
    const summary = [
      `类型：${typeLabel}`,
      source,
      `预览状态：${previewLabel}`,
      publishUrl ? `发布链接：${publishUrl}` : null,
      inlineContent ? `内容摘要：${inlineContent.replace(/\s+/g, ' ').slice(0, 240)}` : null,
    ].filter(Boolean).join('\n')
    quoteToComposer({
      id: `artifact:${artifact.id}`,
      author: `产物：${artifact.title}`,
      preview: `${artifact.title} · ${typeLabel} · ${artifact.source_path ?? artifact.id}`,
      text: summary,
      suggestedPrompt: `请基于引用的产物「${artifact.title}」继续修改：`,
    })
    setStatus('已把产物引用到 IM 输入框')
  }

  return (
    <div data-testid="artifact-card" className="space-y-3 rounded-lg border border-border bg-background p-3">
      <div data-testid="artifact-publish-panel" className="space-y-2 rounded-md border border-border bg-muted/30 p-2">
        <div className="flex items-center gap-2 text-xs font-medium">
          <Rocket className="h-3.5 w-3.5 text-muted-foreground" />
          发布访问
        </div>
        {runnable ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant={publishState === 'running' ? 'outline' : 'default'}
                onClick={() => void publishArtifact('start')}
                disabled={publishing}
                data-testid="artifact-publish-start"
              >
                <Rocket className="mr-1 h-3.5 w-3.5" />
                {publishState === 'running' ? '重新启动' : '启动发布'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void publishArtifact('stop')}
                disabled={publishing || publishState !== 'running'}
                data-testid="artifact-publish-stop"
              >
                <Square className="mr-1 h-3.5 w-3.5" />
                停止发布
              </Button>
              <Badge variant={publishState === 'running' ? 'success' : 'secondary'}>
                {publishState === 'running' ? '运行中' : '未发布'}
              </Badge>
            </div>
            {publishState === 'running' && publishUrl ? (
              <a
                href={publishUrl}
                target="_blank"
                rel="noreferrer"
                data-testid="artifact-publish-link"
                className="inline-flex h-8 w-fit items-center justify-center rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-muted"
              >
                打开发布链接
              </a>
            ) : (
              <p className="text-xs text-muted-foreground">启动发布会生成本地临时访问链接；正式部署请进入「部署」页签完成审批和部署记录。</p>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">该产物不可发布，可下载或继续编辑；正式部署请进入「部署」页签。</p>
        )}
      </div>
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
      <div className="flex flex-wrap gap-2 rounded-md border border-border bg-muted/30 p-2">
        <Button size="sm" variant="outline" onClick={quoteArtifactToComposer} data-testid="artifact-quote-to-composer">
          <SendHorizontal className="mr-1 h-3.5 w-3.5" />
          引用产物
        </Button>
        {editable && (
          <Button size="sm" variant="outline" onClick={() => setEditing((value) => !value)}>
            <Pencil className="mr-1 h-3.5 w-3.5" />
            {editing ? '返回预览' : '基础编辑'}
          </Button>
        )}
        <a
          href={downloadUrl}
          className="inline-flex h-8 w-fit items-center justify-center rounded-md border border-border bg-background px-3 text-xs font-medium hover:bg-muted"
        >
          <Download className="mr-1 h-3.5 w-3.5" />
          下载产物
        </a>
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

export function ArtifactPanel({
  onClose,
  wideMode,
  onRequestWide,
}: {
  onClose: () => void
  wideMode: boolean
  onRequestWide: (wide?: boolean) => void
}) {
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
              className="h-11 flex-1 flex-col gap-0.5 px-1.5 leading-none"
              onClick={() => setActiveTab(tab)}
              data-testid={`artifact-tab-${tab}`}
            >
              {tab === '角色' && <ShieldCheck className="h-3.5 w-3.5" />}
              {tab === '过程' && <Route className="h-3.5 w-3.5" />}
              {tab === '编排' && <Bot className="h-3.5 w-3.5" />}
              {tab === '文件' && <FolderTree className="h-3.5 w-3.5" />}
              {tab === 'Git' && <GitBranch className="h-3.5 w-3.5" />}
              {tab === '产物' && <FileText className="h-3.5 w-3.5" />}
              {tab === '部署' && <Rocket className="h-3.5 w-3.5" />}
              <span>{tab}</span>
            </Button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {activeTab === '角色' && <RolesTab />}
        {activeTab === '过程' && <TimelineTab />}
        {activeTab === '编排' && <OrchestrationTab />}
        {activeTab === '文件' && <FileTreeTab wideMode={wideMode} onRequestWide={onRequestWide} />}
        {activeTab === 'Git' && <GitTab wideMode={wideMode} onRequestWide={onRequestWide} />}
        {activeTab === '产物' && <ArtifactsTab />}
        {activeTab === '部署' && <TimelineTab deploymentsOnly />}
      </div>
    </aside>
  )
}
