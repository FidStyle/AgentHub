'use client'

import { Badge, Button } from '@agenthub/ui'
import { AlertTriangle, CheckCircle2, Clock3, Terminal, XCircle } from 'lucide-react'
import type { OrchestratorAction } from '@agenthub/shared'

const RISK_LABELS: Record<string, string> = { low: '低', medium: '中', high: '高' }
const RISK_VARIANT: Record<string, 'success' | 'warning' | 'destructive'> = {
  low: 'success',
  medium: 'warning',
  high: 'destructive',
}
const STATUS_LABELS: Record<string, string> = {
  pending: '需要授权',
  approved: '已允许',
  running: '执行中',
  succeeded: '已执行',
  failed: '失败',
  rejected: '已拒绝',
}
const STATUS_ICON: Record<string, typeof Clock3> = {
  pending: AlertTriangle,
  approved: CheckCircle2,
  running: Clock3,
  succeeded: CheckCircle2,
  failed: XCircle,
  rejected: XCircle,
}

interface ActionCardProps {
  action: OrchestratorAction
  onApprove?: (actionId: string, approved: boolean) => void
}

export function ActionCard({ action, onApprove }: ActionCardProps) {
  const StatusIcon = STATUS_ICON[action.status] ?? Clock3
  const isPending = action.status === 'pending'
  const result = action.result && typeof action.result === 'object' && !Array.isArray(action.result)
    ? action.result as Record<string, unknown>
    : {}
  const commandText = typeof result.commandPreview === 'string' && result.commandPreview.trim()
    ? result.commandPreview
    : action.command

  return (
    <div data-testid="authorization-card" className="rounded-lg border border-border bg-card shadow-sm">
      <div className="border-b border-border px-3 py-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">执行动作</span>
              <Badge variant={RISK_VARIANT[action.risk_level] ?? 'secondary'}>
                风险 {RISK_LABELS[action.risk_level] ?? action.risk_level}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {action.action_type} · {action.cwd || '当前工作区'}
            </p>
          </div>
          <Badge variant={isPending ? 'warning' : action.status === 'failed' ? 'destructive' : 'secondary'}>
            <StatusIcon className="mr-1 h-3 w-3" />
            {STATUS_LABELS[action.status] ?? action.status}
          </Badge>
        </div>
      </div>

      <div className="space-y-3 p-3">
        <code className="block max-h-24 overflow-auto rounded-md bg-muted px-2 py-1.5 text-xs leading-relaxed">
          {commandText}
        </code>

        {isPending && (
          <div className="rounded-md border border-warning/30 bg-warning/10 p-2 text-xs text-muted-foreground">
            该动作超出当前权限策略，需要在当前会话中授权后才会继续执行。Desktop 只记录策略命中和执行结果。
          </div>
        )}

        {isPending && onApprove && (
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" onClick={() => onApprove(action.id, true)}>
              允许本次操作
            </Button>
            <Button size="sm" variant="outline" onClick={() => onApprove(action.id, false)}>
              拒绝
            </Button>
          </div>
        )}

        {action.result && (
          <p className="text-xs text-muted-foreground">
            {typeof result.output === 'string' && result.output.trim() ? result.output.split('\n')[0] : '执行记录已保存'}
          </p>
        )}
      </div>
    </div>
  )
}
