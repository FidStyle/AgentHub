'use client'

import React from 'react'
import { useEffect, useState } from 'react'
import { Badge, Button } from '@agenthub/ui'
import { AlertTriangle } from 'lucide-react'
import type { RuntimeMessagePart } from '@agenthub/shared'
import { MessageMarkdown } from './MessageMarkdown'

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
  const canDecide = part.status === 'pending' && Boolean(part.actionId) && decision === 'idle'
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
    } catch {
      setDecision('error')
    }
  }
  const statusText = {
    idle: '待确认',
    approving: '授权中',
    rejecting: '拒绝中',
    approved: '已允许本次执行',
    rejected: '已拒绝，未执行该操作。',
    error: '处理失败',
  }[decision]
  const detailRows = [
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
        <span className="text-muted-foreground">{statusText}</span>
        {part.actionId ? (
          <div className="flex gap-2">
            <Button size="sm" disabled={!canDecide} onClick={() => void decide(true)}>
              允许单次执行
            </Button>
            <Button size="sm" variant="outline" disabled={!canDecide} onClick={() => void decide(false)}>
              拒绝
            </Button>
          </div>
        ) : (
          <span className="text-muted-foreground">缺少动作编号，无法在此处授权</span>
        )}
      </div>
      {decision === 'error' && <p className="mt-2 text-destructive">授权请求处理失败，请刷新后重试。</p>}
    </div>
  )
}

function RuntimePartCard({ part }: { part: RuntimeMessagePart }) {
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
  if (part.type === 'diff') {
    return (
      <div data-testid="message-diff-card" className="rounded-md border border-border bg-background/70 p-2 text-xs">
        <div className="font-medium">{part.path ? `Diff：${part.path}` : 'Diff'}</div>
        <pre className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-2">{part.diff}</pre>
      </div>
    )
  }
  return (
    <div data-testid="message-artifact-card" className="rounded-md border border-border bg-background/70 p-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{part.title}</span>
        <Badge variant="secondary">{part.artifactType}</Badge>
      </div>
      {part.sourcePath && <p className="mt-1 text-muted-foreground">来源：{part.sourcePath}</p>}
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
