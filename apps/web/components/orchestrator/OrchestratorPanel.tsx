'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Plan, PlanNode, OrchestratorAction } from '@agenthub/shared'
import type { PlanNodeControl } from '@agenthub/shared'
import { StateCard } from '@agenthub/ui'
import { useSessionStore } from '@/store/session-store'
import { PlanCard } from './PlanCard'
import { ActionCard } from './ActionCard'

type PlanWithNodes = Plan & { plan_nodes?: PlanNode[] }

async function responseError(label: string, res: Response) {
  const body = await res.json().catch(() => ({}))
  const message = (body as { error?: string }).error || res.statusText || '未知错误'
  return `${label} 加载失败（${res.status}）：${message}`
}

export function OrchestratorPanel() {
  const { activeSessionId } = useSessionStore()
  const [plans, setPlans] = useState<PlanWithNodes[]>([])
  const [actions, setActions] = useState<OrchestratorAction[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (sessionId: string) => {
    setLoading(true)
    setError(null)
    try {
      const [pRes, aRes] = await Promise.all([
        fetch(`/api/plans?session_id=${sessionId}`),
        fetch(`/api/actions?session_id=${sessionId}`),
      ])
      if (!pRes.ok) throw new Error(await responseError('/api/plans', pRes))
      if (!aRes.ok) throw new Error(await responseError('/api/actions', aRes))
      setPlans(await pRes.json())
      setActions(await aRes.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载编排数据失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeSessionId) {
      load(activeSessionId)
      const onChanged = () => load(activeSessionId)
      window.addEventListener('actions:changed', onChanged)
      return () => window.removeEventListener('actions:changed', onChanged)
    } else {
      setPlans([])
      setActions([])
      setError(null)
    }
  }, [activeSessionId, load])

  const onConfirm = useCallback(
    async (planId: string) => {
      try {
        const res = await fetch(`/api/plans/${planId}/confirm`, { method: 'POST' })
        if (!res.ok) throw new Error('确认计划失败')
        if (activeSessionId) await load(activeSessionId)
      } catch (e) {
        setError(e instanceof Error ? e.message : '确认计划失败')
      }
    },
    [activeSessionId, load],
  )

  const onApprove = useCallback(
    async (actionId: string, approved: boolean) => {
      try {
        const res = await fetch(`/api/actions/${actionId}/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ approved }),
        })
        if (!res.ok) throw new Error('授权动作失败')
        if (activeSessionId) await load(activeSessionId)
      } catch (e) {
        setError(e instanceof Error ? e.message : '授权动作失败')
      }
    },
    [activeSessionId, load],
  )

  const onNodeControl = useCallback(
    async (nodeId: string, control: PlanNodeControl) => {
      try {
        const res = await fetch(`/api/plan-nodes/${nodeId}/${control}`, { method: 'POST' })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error((body as { error?: string }).error || '计划节点操作失败')
        }
        if (activeSessionId) await load(activeSessionId)
      } catch (e) {
        setError(e instanceof Error ? e.message : '计划节点操作失败')
      }
    },
    [activeSessionId, load],
  )

  if (!activeSessionId) {
    return <StateCard variant="empty" title="未选择会话" description="选择一个会话后，其计划与动作将在此展示" />
  }

  return (
    <div data-testid="orchestrator-panel" className="space-y-4">
      {error && <p data-testid="orchestrator-error" className="text-sm text-destructive">{error}</p>}
      {loading && <p className="text-sm text-muted-foreground">加载中...</p>}

      {!loading && plans.length === 0 && actions.length === 0 && (
        <div data-testid="orchestrator-empty">
          <StateCard
            variant="empty"
            title="暂无计划或动作"
            description="当前会话还没有编排计划或需要授权的动作"
          />
        </div>
      )}

      {plans.map((plan) => (
        <PlanCard key={plan.id} plan={plan} onConfirm={onConfirm} onNodeControl={onNodeControl} />
      ))}

      {actions.map((action) => (
        <ActionCard key={action.id} action={action} onApprove={onApprove} />
      ))}
    </div>
  )
}
