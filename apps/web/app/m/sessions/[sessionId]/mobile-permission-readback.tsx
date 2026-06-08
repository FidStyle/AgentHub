'use client'

import React from 'react'
import { Badge, Button } from '@agenthub/ui'
import { AlertTriangle, CheckCircle2, ShieldCheck, XCircle } from 'lucide-react'

export interface MobilePermissionAction {
  id: string
  session_id: string
  action_type: string
  command: string
  cwd?: string | null
  risk_level?: string | null
  status: string
  requires_approval?: boolean | null
  result?: Record<string, unknown> | null
  approved_at?: string | null
  executed_at?: string | null
  created_at?: string | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function stringArrayValue(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : []
}

const actionStatusLabel: Record<string, string> = {
  pending: '需要授权',
  approved: '已允许本次执行',
  running: '执行中',
  completed: '已完成',
  succeeded: '已完成',
  failed: '执行失败',
  rejected: '已拒绝，未执行该操作。',
  cancelled: '已取消',
}

const actionStatusVariant: Record<string, 'secondary' | 'default' | 'warning' | 'success' | 'destructive'> = {
  pending: 'warning',
  approved: 'success',
  running: 'warning',
  completed: 'success',
  succeeded: 'success',
  failed: 'destructive',
  rejected: 'destructive',
  cancelled: 'secondary',
}

export function mobileActionStatusText(action: MobilePermissionAction): string {
  if (action.result?.autoApproved === true) {
    if (action.status === 'failed') return '自动执行失败'
    if (action.status === 'completed' || action.status === 'succeeded') return '已自动通过并执行'
    return '已自动通过'
  }
  return actionStatusLabel[action.status] ?? action.status
}

export function mobileActionDetailRows(action: MobilePermissionAction): Array<[string, string]> {
  const result = asRecord(action.result)
  const targetPaths = stringArrayValue(result?.targetPaths)
  return [
    ['动作', stringValue(result?.actionKind) ?? action.action_type],
    ['命令', action.command],
    ['权限模式', stringValue(result?.permissionMode)],
    ['目录', stringValue(result?.cwd) ?? stringValue(action.cwd)],
    ['Workspace', stringValue(result?.workspaceRoot)],
    ['路径', targetPaths.length > 0 ? targetPaths.join('\n') : null],
    ['工具', stringValue(result?.toolName)],
    ['预览', stringValue(result?.previewPath)],
    ['Manifest', stringValue(result?.manifestPath)],
    ['产物', stringValue(result?.artifactId)],
  ].filter((row): row is [string, string] => Boolean(row[1]))
}

export function MobileActionCard({
  action,
  onApprove,
}: {
  action: MobilePermissionAction
  onApprove?: (actionId: string, approved: boolean) => void | Promise<void>
}) {
  const isPending = action.status === 'pending'
  const statusText = mobileActionStatusText(action)
  const details = mobileActionDetailRows(action)
  const StatusIcon = isPending ? AlertTriangle : action.status === 'failed' || action.status === 'rejected' ? XCircle : CheckCircle2

  return (
    <div data-testid="mobile-durable-permission-card" className="rounded-md border border-warning/40 bg-warning/10 p-2 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 font-medium">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>授权记录</span>
            {action.requires_approval ? <Badge variant="warning">需授权</Badge> : <Badge variant="secondary">策略允许</Badge>}
          </div>
          <p className="mt-1 break-words text-muted-foreground">{action.command}</p>
        </div>
        <Badge variant={actionStatusVariant[action.status] ?? 'secondary'}>
          <StatusIcon className="mr-1 h-3 w-3" />
          {statusText}
        </Badge>
      </div>
      {details.length > 0 && (
        <dl className="mt-2 grid gap-1 rounded-md bg-background/70 p-2 text-[11px] leading-4">
          {details.map(([label, value]) => (
            <div key={label} className="grid grid-cols-[64px_minmax(0,1fr)] gap-2">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="whitespace-pre-wrap break-words font-mono">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-muted-foreground">{statusText}</span>
        {isPending && onApprove && (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void onApprove(action.id, true)}>
              允许
            </Button>
            <Button size="sm" variant="outline" onClick={() => void onApprove(action.id, false)}>
              拒绝
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
