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
  pending: 'bg-gray-200 text-gray-700',
  ready: 'bg-blue-100 text-blue-700',
  running: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  skipped: 'bg-gray-100 text-gray-500',
}

interface PlanCardProps {
  plan: Plan & { plan_nodes?: PlanNode[] }
  onConfirm?: (planId: string) => void
}

export function PlanCard({ plan, onConfirm }: PlanCardProps) {
  const nodes = plan.plan_nodes || []
  const completedCount = nodes.filter(n => n.status === 'completed').length

  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium text-lg">{plan.title}</h3>
        <span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[plan.status] || 'bg-gray-100'}`}>
          {plan.status === 'pending_confirm' ? '待确认' : plan.status === 'running' ? '执行中' : plan.status}
        </span>
      </div>

      {/* Progress */}
      <div className="mb-3">
        <div className="flex justify-between text-sm text-gray-500 mb-1">
          <span>进度</span>
          <span>{completedCount}/{nodes.length}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-green-500 h-2 rounded-full transition-all"
            style={{ width: `${nodes.length ? (completedCount / nodes.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Node list */}
      <ul className="space-y-1 mb-3">
        {nodes.map(node => (
          <li key={node.id} className="flex items-center gap-2 text-sm">
            <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[node.status]?.split(' ')[0] || 'bg-gray-300'}`} />
            <span className="flex-1">{node.label}</span>
            <span className="text-xs text-gray-400">{STATUS_LABELS[node.status]}</span>
          </li>
        ))}
      </ul>

      {/* Confirm button */}
      {plan.status === 'pending_confirm' && onConfirm && (
        <button
          onClick={() => onConfirm(plan.id)}
          className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
        >
          确认执行计划
        </button>
      )}
    </div>
  )
}
