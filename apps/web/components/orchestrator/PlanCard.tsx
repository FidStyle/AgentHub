'use client'

import { Badge, Button } from '@agenthub/ui'
import { CheckCircle2, Circle, GitBranch, PlayCircle, Route, XCircle } from 'lucide-react'
import type { Plan, PlanNode } from '@agenthub/shared'

const STATUS_LABELS: Record<string, string> = {
  pending: '等待中',
  ready: '就绪',
  running: '执行中',
  completed: '已完成',
  failed: '失败',
  skipped: '已跳过',
}

const STATUS_VARIANT: Record<string, 'secondary' | 'default' | 'warning' | 'success' | 'destructive'> = {
  pending: 'secondary',
  ready: 'default',
  running: 'warning',
  completed: 'success',
  failed: 'destructive',
  skipped: 'secondary',
}

const STATUS_DOT: Record<string, string> = {
  pending: 'bg-muted-foreground',
  ready: 'bg-primary',
  running: 'bg-warning',
  completed: 'bg-success',
  failed: 'bg-destructive',
  skipped: 'bg-muted-foreground',
}

interface PlanCardProps {
  plan: Plan & { plan_nodes?: PlanNode[] }
  onConfirm?: (planId: string) => void
}

export function PlanCard({ plan, onConfirm }: PlanCardProps) {
  const nodes = plan.plan_nodes || []
  const completedCount = nodes.filter(n => n.status === 'completed').length
  const progress = nodes.length ? Math.round((completedCount / nodes.length) * 100) : 0
  const failedCount = nodes.filter(n => n.status === 'failed').length
  const runningCount = nodes.filter(n => n.status === 'running').length

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm">
      <div className="border-b border-border px-3 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Route className="h-4 w-4 text-muted-foreground" />
              <h3 className="truncate text-sm font-semibold">{plan.title}</h3>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {nodes.length} 个步骤 · {runningCount} 执行中 · {failedCount} 失败
            </p>
          </div>
          <Badge variant={plan.status === 'pending_confirm' ? 'warning' : plan.status === 'running' ? 'default' : 'secondary'}>
            {plan.status === 'pending_confirm' ? '待确认' : plan.status === 'running' ? '执行中' : plan.status}
          </Badge>
        </div>
      </div>

      <div className="space-y-3 p-3">
        <div>
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>计划进度</span>
            <span>{completedCount}/{nodes.length} · {progress}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted">
            <div
              className="h-1.5 rounded-full bg-success transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <ul className="space-y-1">
          {nodes.length === 0 && (
            <li className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
              计划还没有生成可执行步骤
            </li>
          )}
          {nodes.map((node, index) => {
            const NodeIcon = node.status === 'completed' ? CheckCircle2 : node.status === 'failed' ? XCircle : node.status === 'running' ? PlayCircle : Circle
            return (
              <li key={node.id} className="rounded-md border border-border bg-background px-2.5 py-2">
                <div className="flex items-start gap-2">
                  <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[node.status] || 'bg-muted'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <NodeIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="truncate text-sm">{index + 1}. {node.label}</span>
                    </div>
                    {node.agent_id && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        分派角色：{node.agent_id}
                      </p>
                    )}
                  </div>
                  <Badge variant={STATUS_VARIANT[node.status] ?? 'secondary'}>
                    {STATUS_LABELS[node.status] ?? node.status}
                  </Badge>
                </div>
              </li>
            )
          })}
        </ul>

        {plan.status === 'pending_confirm' && onConfirm && (
          <Button className="w-full" onClick={() => onConfirm(plan.id)}>
            <GitBranch className="mr-2 h-4 w-4" />
            确认执行计划
          </Button>
        )}
      </div>
    </div>
  )
}
