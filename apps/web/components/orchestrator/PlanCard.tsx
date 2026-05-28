'use client'

import type { Plan, PlanNode } from '@agenthub/shared'

const STATUS_LABELS: Record<string, string> = {
  pending: '等待中',
  ready: '就绪',
  running: '执行中',
  completed: '已完成',
  failed: '失败',
  skipped: '已跳过',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  ready: 'bg-accent text-accent-foreground',
  running: 'bg-warning/10 text-warning-foreground',
  completed: 'bg-success/10 text-success',
  failed: 'bg-destructive/10 text-destructive',
  skipped: 'bg-muted text-muted-foreground',
}

interface PlanCardProps {
  plan: Plan & { plan_nodes?: PlanNode[] }
  onConfirm?: (planId: string) => void
}

export function PlanCard({ plan, onConfirm }: PlanCardProps) {
  const nodes = plan.plan_nodes || []
  const completedCount = nodes.filter(n => n.status === 'completed').length

  return (
    <div className="border border-border rounded-lg p-4 bg-card shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium text-lg">{plan.title}</h3>
        <span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[plan.status] || 'bg-muted'}`}>
          {plan.status === 'pending_confirm' ? '待确认' : plan.status === 'running' ? '执行中' : plan.status}
        </span>
      </div>

      {/* Progress */}
      <div className="mb-3">
        <div className="flex justify-between text-sm text-muted-foreground mb-1">
          <span>进度</span>
          <span>{completedCount}/{nodes.length}</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className="bg-success h-2 rounded-full transition-all"
            style={{ width: `${nodes.length ? (completedCount / nodes.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Node list */}
      <ul className="space-y-1 mb-3">
        {nodes.map(node => (
          <li key={node.id} className="flex items-center gap-2 text-sm">
            <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[node.status]?.split(' ')[0] || 'bg-muted'}`} />
            <span className="flex-1">{node.label}</span>
            <span className="text-xs text-muted-foreground">{STATUS_LABELS[node.status]}</span>
          </li>
        ))}
      </ul>

      {/* Confirm button */}
      {plan.status === 'pending_confirm' && onConfirm && (
        <button
          onClick={() => onConfirm(plan.id)}
          className="w-full py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition"
        >
          确认执行计划
        </button>
      )}
    </div>
  )
}
