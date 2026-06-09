'use client'

import React from 'react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Badge, Button } from '@agenthub/ui'
import { AlertTriangle, Download, ExternalLink, FileImage, FileText, GitBranch, Maximize2, Paperclip, Presentation, Rocket } from 'lucide-react'
import type { RuntimeMessagePart } from '@agenthub/shared'
import { MessageMarkdown } from './MessageMarkdown'
import { useSessionStore } from '@/store/session-store'

const STREAM_TICK_MS = 28
const STREAM_MIN_STEP = 1
const STREAM_MAX_STEP = 4

function nextStreamStep(pending: number) {
  if (pending <= 0) return 0
  if (pending > 80) return STREAM_MAX_STEP
  if (pending > 28) return 3
  if (pending > 10) return 2
  return STREAM_MIN_STEP
}

function useSmoothStreamingText(content: string, streaming: boolean) {
  const [visible, setVisible] = useState(content)

  useEffect(() => {
    if (!streaming) {
      setVisible(content)
      return
    }
    setVisible((current) => {
      if (content.startsWith(current)) return current
      return content
    })
  }, [content, streaming])

  useEffect(() => {
    if (!streaming) return
    const timer = window.setInterval(() => {
      setVisible((current) => {
        if (!content.startsWith(current)) return content
        const pending = content.length - current.length
        if (pending <= 0) return current
        return content.slice(0, current.length + nextStreamStep(pending))
      })
    }, STREAM_TICK_MS)
    return () => window.clearInterval(timer)
  }, [content, streaming])

  return visible
}

function ThinkingIndicator() {
  return (
    <div data-testid="message-thinking" className="flex items-center gap-2 py-1 text-[13px] leading-[20px] text-muted-foreground">
      <span>思考中</span>
      <span className="flex items-center gap-1" aria-hidden="true">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-160ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-80ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
      </span>
    </div>
  )
}

function PartPreview({ value }: { value: unknown }) {
  if (value === undefined || value === null || value === '') return null
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  return <pre className="mt-2 max-h-32 overflow-auto rounded-md bg-background/70 p-2 text-xs">{text}</pre>
}

function PermissionPartCard({ part }: { part: Extract<RuntimeMessagePart, { type: 'permission' }> }) {
  const [decision, setDecision] = useState<'idle' | 'approving' | 'rejecting' | 'approved' | 'rejected' | 'error'>('idle')
  const refreshTimersRef = useRef<number[]>([])
  const activeSessionId = useSessionStore((state) => state.activeSessionId)
  const fetchMessages = useSessionStore((state) => state.fetchMessages)
  const autoApproved = part.autoApproved === true
  const canDecide = !autoApproved && part.status === 'pending' && Boolean(part.actionId) && decision === 'idle'
  useEffect(() => () => {
    refreshTimersRef.current.forEach((timer) => window.clearTimeout(timer))
    refreshTimersRef.current = []
  }, [])

  const refreshSessionAfterDecision = () => {
    if (!activeSessionId) return
    refreshTimersRef.current.forEach((timer) => window.clearTimeout(timer))
    refreshTimersRef.current = []
    void fetchMessages(activeSessionId)
    for (const delay of [2000, 5000, 10000, 20000, 45000, 90000, 180000, 300000]) {
      const timer = window.setTimeout(() => {
        void fetchMessages(activeSessionId)
      }, delay)
      refreshTimersRef.current.push(timer)
    }
  }

  const decide = async (approved: boolean) => {
    if (!part.actionId) return
    setDecision(approved ? 'approving' : 'rejecting')
    try {
      const res = await fetch(`/api/actions/${part.actionId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error || '授权请求处理失败')
      }
      setDecision(approved ? 'approved' : 'rejected')
      refreshSessionAfterDecision()
    } catch {
      setDecision('error')
    }
  }
  const statusText = autoApproved ? {
    approved: '已自动通过',
    running: '已自动通过',
    completed: '已自动通过并执行',
    failed: '自动执行失败',
    rejected: '已拒绝',
    pending: '自动通过中',
  }[part.status] ?? '已自动通过' : part.status !== 'pending' ? {
    approved: '已允许',
    rejected: '已拒绝',
    running: '已允许',
    completed: '已执行',
    failed: '执行失败',
  }[part.status] ?? '已处理' : {
    idle: '待确认',
    approving: '审批中',
    rejecting: '拒绝中',
    approved: '已允许',
    rejected: '已拒绝',
    error: '处理失败',
  }[decision]
  const detailRows = [
    part.permissionMode ? ['权限模式', part.permissionMode] : null,
    part.actionKind ? ['动作', part.actionKind] : null,
    part.commandPreview ? ['命令', part.commandPreview] : null,
    part.cwd ? ['目录', part.cwd] : null,
    part.workspaceRoot ? ['Workspace', part.workspaceRoot] : null,
    part.targetPaths && part.targetPaths.length > 0 ? ['路径', part.targetPaths.join('\n')] : null,
  ].filter((row): row is [string, string] => Boolean(row))

  return (
    <div data-testid="message-permission-card" className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-medium">
          <AlertTriangle className="h-3.5 w-3.5" />
          {part.title ?? '需要授权'}
        </span>
        <Badge variant="warning">{part.riskLevel ?? '待确认'}</Badge>
      </div>
      <p className="mt-1 text-muted-foreground">{part.description}</p>
      {detailRows.length > 0 && (
        <dl className="mt-2 grid gap-1 rounded-md bg-background/70 p-2 text-[11px] leading-4">
          {detailRows.map(([label, value]) => (
            <div key={label} className="grid grid-cols-[72px_minmax(0,1fr)] gap-2">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="whitespace-pre-wrap break-words font-mono">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-muted-foreground">审批状态：{statusText}</span>
        {part.actionId && canDecide ? (
          <div className="flex gap-2">
            <Button size="sm" disabled={!canDecide} onClick={() => void decide(true)}>
              允许本次操作
            </Button>
            <Button size="sm" variant="outline" disabled={!canDecide} onClick={() => void decide(false)}>
              拒绝
            </Button>
          </div>
        ) : part.actionId || autoApproved ? (
          <Badge variant={statusText === '已拒绝' || statusText.includes('失败') ? 'destructive' : 'success'}>{statusText}</Badge>
        ) : (
          <span className="text-muted-foreground">缺少动作编号，无法在此处授权</span>
        )}
      </div>
      {decision === 'error' && <p className="mt-2 text-destructive">授权请求处理失败，请刷新后重试。</p>}
    </div>
  )
}

function RuntimePartCard({ part }: { part: RuntimeMessagePart }) {
  const [expanded, setExpanded] = useState(false)
  const activeSessionId = useSessionStore((state) => state.activeSessionId)
  const activeWorkspaceId = useSessionStore((state) => state.activeWorkspaceId)
  const [applyState, setApplyState] = useState<'idle' | 'creating' | 'created' | 'error'>('idle')
  const expandedNode = expanded ? (
    <div data-testid="message-fullscreen-preview" className="fixed inset-0 z-50 bg-background/95 p-4">
      <div className="flex h-full flex-col rounded-md border border-border bg-background shadow-lg">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0 text-sm font-medium">{part.type === 'artifact' ? part.title : part.type === 'web_preview' ? part.title : part.type}</div>
          <Button size="sm" variant="outline" onClick={() => setExpanded(false)}>关闭</Button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {part.type === 'web_preview' && part.iframeUrl ? (
            <iframe title={part.title} src={part.iframeUrl} className="h-full min-h-[480px] w-full rounded-md border border-border bg-white" />
          ) : part.type === 'diff' ? (
            <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">{part.diff}</pre>
          ) : (
            <PartPreview value={part} />
          )}
        </div>
      </div>
    </div>
  ) : null

  if (part.type === 'tool') {
    return (
      <div data-testid="message-tool-card" className="rounded-md border border-border bg-background/70 p-2 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium">工具：{part.toolName}</span>
          <Badge variant={part.status === 'completed' ? 'success' : part.status === 'failed' ? 'destructive' : 'warning'}>
            {part.status === 'completed' ? '完成' : part.status === 'failed' ? '失败' : '运行中'}
          </Badge>
        </div>
        <PartPreview value={part.input} />
        <PartPreview value={part.delta} />
        <PartPreview value={part.result} />
      </div>
    )
  }
  if (part.type === 'permission') {
    return <PermissionPartCard part={part} />
  }
  if (part.type === 'question') {
    return (
      <div data-testid="message-question-card" className="rounded-md border border-border bg-background/70 p-2 text-xs">
        <div className="font-medium">{part.title ?? '需要确认'}</div>
        <p className="mt-1 text-muted-foreground">{part.content}</p>
      </div>
    )
  }
  if (part.type === 'change_summary') {
    return (
      <div data-testid="message-change-summary-card" className="rounded-md border border-border bg-background/70 p-2 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5 font-medium">
            <GitBranch className="h-3.5 w-3.5" />
            <span className="truncate">{part.title ?? 'Git 变更摘要'}</span>
          </span>
          <Badge variant={part.files.length > 0 ? 'warning' : 'secondary'}>{part.files.length} 个文件</Badge>
        </div>
        {part.summary && <p className="mt-1 text-muted-foreground">{part.summary}</p>}
        {part.files.length > 0 && (
          <div className="mt-2 grid gap-1">
            {part.files.map((file) => (
              <div key={file.path} className="grid grid-cols-[72px_minmax(0,1fr)] gap-2 rounded-sm bg-muted/50 px-2 py-1">
                <span className="text-muted-foreground">{file.untracked ? '新增' : file.staged ? '已暂存' : file.unstaged ? '未暂存' : file.status ?? '变更'}</span>
                <span className="truncate font-mono">{file.path}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }
  if (part.type === 'diff') {
    const applyDiff = async () => {
      if (!activeWorkspaceId || !activeSessionId) return
      setApplyState('creating')
      try {
        const res = await fetch(`/api/workspaces/${activeWorkspaceId}/diff/apply`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: activeSessionId, diff: part.diff }),
        })
        if (!res.ok) throw new Error('创建 Diff 应用审批失败')
        setApplyState('created')
      } catch {
        setApplyState('error')
      }
    }
    return (
      <div data-testid="message-diff-card" className="rounded-md border border-border bg-background/70 p-2 text-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="font-medium">{part.path ? `Diff：${part.path}` : 'Diff'}</div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" onClick={() => setExpanded(true)}><Maximize2 className="mr-1 h-3.5 w-3.5" />展开</Button>
            {(part.applicable ?? part.applyable ?? /^--- .+\n\+\+\+ .+\n@@ /m.test(part.diff)) && (
              <Button size="sm" disabled={applyState === 'creating' || applyState === 'created'} onClick={() => void applyDiff()}>
                {applyState === 'created' ? '已创建审批' : '应用 Diff'}
              </Button>
            )}
          </div>
        </div>
        <pre className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-2">{part.diff}</pre>
        {applyState === 'error' && <p className="mt-1 text-destructive">创建审批失败，请刷新后重试。</p>}
        {expandedNode && createPortal(expandedNode, document.body)}
      </div>
    )
  }
  if (part.type === 'attachment') {
    return (
      <div data-testid="message-attachment-card" className="rounded-md border border-border bg-background/70 p-2 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5 font-medium"><Paperclip className="h-3.5 w-3.5" /><span className="truncate">{part.name}</span></span>
          {part.downloadUrl && <a href={part.downloadUrl} className="inline-flex items-center gap-1 text-primary"><Download className="h-3.5 w-3.5" />下载</a>}
        </div>
        <p className="mt-1 text-muted-foreground">{part.mime ?? '文件'}{part.size ? ` · ${part.size} bytes` : ''}</p>
      </div>
    )
  }
  if (part.type === 'image_preview') {
    return (
      <div data-testid="message-image-preview-card" className="rounded-md border border-border bg-background/70 p-2 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5 font-medium"><FileImage className="h-3.5 w-3.5" /><span className="truncate">{part.title}</span></span>
          {part.downloadUrl && <a href={part.downloadUrl} className="inline-flex items-center gap-1 text-primary"><Download className="h-3.5 w-3.5" />下载</a>}
        </div>
        {part.url ? (
          <img src={part.url} alt={part.alt ?? part.title} className="mt-2 max-h-64 w-full rounded-md border border-border object-contain" />
        ) : (
          <p className="mt-1 text-muted-foreground">图片预览暂不可用。</p>
        )}
        {part.sourcePath && <p className="mt-1 truncate text-muted-foreground">来源：{part.sourcePath}</p>}
      </div>
    )
  }
  if (part.type === 'document_preview' || part.type === 'presentation_preview') {
    const Icon = part.type === 'presentation_preview' ? Presentation : FileText
    return (
      <div data-testid={part.type === 'presentation_preview' ? 'message-presentation-preview-card' : 'message-document-preview-card'} className="rounded-md border border-border bg-background/70 p-2 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5 font-medium"><Icon className="h-3.5 w-3.5" /><span className="truncate">{part.title}</span></span>
          <div className="flex items-center gap-1">
            {part.previewUrl && <a href={part.previewUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary"><ExternalLink className="h-3.5 w-3.5" />预览</a>}
            {part.downloadUrl && <a href={part.downloadUrl} className="inline-flex items-center gap-1 text-primary"><Download className="h-3.5 w-3.5" />下载</a>}
          </div>
        </div>
        {part.summary && <p className="mt-1 text-muted-foreground">{part.summary}</p>}
        {part.sourcePath && <p className="mt-1 truncate text-muted-foreground">来源：{part.sourcePath}</p>}
      </div>
    )
  }
  if (part.type === 'web_preview') {
    return (
      <div data-testid="message-web-preview-card" className="rounded-md border border-border bg-background/70 p-2 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium">{part.title}</span>
          <div className="flex gap-1">
            {part.url && <a href={part.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary"><ExternalLink className="h-3.5 w-3.5" />打开</a>}
            {part.iframeUrl && <Button size="sm" variant="outline" onClick={() => setExpanded(true)}><Maximize2 className="mr-1 h-3.5 w-3.5" />预览</Button>}
          </div>
        </div>
        {part.description && <p className="mt-1 text-muted-foreground">{part.description}</p>}
        {expandedNode && createPortal(expandedNode, document.body)}
      </div>
    )
  }
  if (part.type === 'publish_status') {
    return (
      <div data-testid="message-publish-status-card" className="rounded-md border border-border bg-background/70 p-2 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 font-medium"><Rocket className="h-3.5 w-3.5" />{part.title}</span>
          <Badge variant={part.status === 'running' ? 'success' : part.status === 'failed' ? 'destructive' : 'secondary'}>{part.status === 'running' ? '运行中' : part.status === 'failed' ? '失败' : part.status === 'stopped' ? '已停止' : '待处理'}</Badge>
        </div>
        {part.message && <p className="mt-1 text-muted-foreground">{part.message}</p>}
        {part.url && <a href={part.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-primary"><ExternalLink className="h-3.5 w-3.5" />发布访问</a>}
      </div>
    )
  }
  return (
    <div data-testid="message-artifact-card" className="rounded-md border border-border bg-background/70 p-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 font-medium"><FileText className="h-3.5 w-3.5" /><span className="truncate">{part.title}</span></span>
        <div className="flex items-center gap-1">
          <Badge variant="secondary">{part.artifactType}</Badge>
          {part.downloadUrl && <a href={part.downloadUrl} className="inline-flex items-center gap-1 text-primary"><Download className="h-3.5 w-3.5" />下载</a>}
          <Button size="sm" variant="outline" onClick={() => setExpanded(true)}><Maximize2 className="mr-1 h-3.5 w-3.5" />展开</Button>
        </div>
      </div>
      {part.sourcePath && <p className="mt-1 text-muted-foreground">来源：{part.sourcePath}</p>}
      {expandedNode && createPortal(expandedNode, document.body)}
    </div>
  )
}

export function MessageContent({ content, parts, streaming }: { content: string; parts?: RuntimeMessagePart[]; streaming?: boolean }) {
  const visibleContent = useSmoothStreamingText(content, streaming === true)
  const hasVisibleContent = visibleContent.trim().length > 0
  return (
    <div data-testid="message-content" className="space-y-2">
      {hasVisibleContent ? (
        <MessageMarkdown content={visibleContent} streaming={streaming === true && visibleContent.length < content.length} />
      ) : streaming ? (
        <ThinkingIndicator />
      ) : null}
      {streaming && hasVisibleContent && visibleContent.length >= content.length && (
        <div className="mt-1">
          <ThinkingIndicator />
        </div>
      )}
      {parts?.map((part) => <RuntimePartCard key={part.id} part={part} />)}
    </div>
  )
}
