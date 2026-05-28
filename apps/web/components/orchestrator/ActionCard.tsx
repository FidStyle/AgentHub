'use client'

import type { OrchestratorAction } from '@agenthub/shared'

const RISK_LABELS: Record<string, string> = { low: '低', medium: '中', high: '高' }
const RISK_COLORS: Record<string, string> = {
  low: 'text-success',
  medium: 'text-warning',
  high: 'text-destructive',
}

interface ActionCardProps {
  action: OrchestratorAction
  onApprove?: (actionId: string, approved: boolean) => void
}

export function ActionCard({ action, onApprove }: ActionCardProps) {
  return (
    <div className="border border-border rounded-lg p-3 bg-card shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <code className="text-sm bg-muted px-2 py-0.5 rounded max-w-[70%] truncate">
          {action.command}
        </code>
        <span className={`text-xs font-medium ${RISK_COLORS[action.risk_level]}`}>
          风险: {RISK_LABELS[action.risk_level]}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          类型: {action.action_type} | 状态: {action.status === 'pending' ? '待审批' : action.status}
        </span>

        {action.status === 'pending' && onApprove && (
          <div className="flex gap-2">
            <button
              onClick={() => onApprove(action.id, true)}
              className="px-3 py-1 text-xs bg-success text-success-foreground rounded hover:bg-success/90"
            >
              批准
            </button>
            <button
              onClick={() => onApprove(action.id, false)}
              className="px-3 py-1 text-xs bg-destructive text-destructive-foreground rounded hover:bg-destructive/90"
            >
              拒绝
            </button>
          </div>
        )}
      </div>

      {action.result && (
        <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto max-h-32">
          {JSON.stringify(action.result, null, 2)}
        </pre>
      )}
    </div>
  )
}
