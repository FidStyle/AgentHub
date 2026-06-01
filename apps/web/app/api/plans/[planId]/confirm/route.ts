import { createClient } from '@/lib/app-db-client'
import { requireAuth } from '@/lib/auth-guard'
import { NextResponse } from 'next/server'
import { getReadyNodes } from '@/lib/orchestrator/dag-scheduler'
import type { PlanNode } from '@agenthub/shared'
import { DEFAULT_POLICIES } from '@agenthub/shared'
import { classifyRisk, requiresApproval } from '@/lib/orchestrator/permission-engine'
import { dispatchApprovedAction, type ActionDispatchResult } from '@/lib/orchestrator/action-dispatcher'
import type { ActionRecordForDispatch } from '@/lib/orchestrator/action-dispatcher'

// POST /api/plans/[planId]/confirm — user confirms plan, start execution
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ planId: string }> }
) {
  const { planId } = await params
  const db = await createClient()
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  // Verify ownership
  const { data: plan } = await db
    .from('plans')
    .select('*')
    .eq('id', planId)
    .eq('owner_id', user.id)
    .single()

  if (!plan) return NextResponse.json({ error: '计划不存在' }, { status: 404 })
  if (plan.status !== 'pending_confirm') {
    return NextResponse.json({ error: '计划状态不允许确认' }, { status: 400 })
  }

  // Update plan status to running
  await db.from('plans').update({ status: 'running', updated_at: new Date().toISOString() }).eq('id', planId)

  // Get nodes and mark ready ones
  const { data: nodes } = await db.from('plan_nodes').select('*').eq('plan_id', planId)
  const readyNodes = getReadyNodes(nodes as unknown as PlanNode[])
  let createdActions = 0
  const dispatches: ActionDispatchResult[] = []

  for (const node of readyNodes) {
    await db.from('plan_nodes').update({ status: 'ready' }).eq('id', node.id)
    const actionType = (node as unknown as { action_type?: string | null }).action_type
    const payload = ((node as unknown as { action_payload?: Record<string, unknown> | null }).action_payload ?? {}) as Record<string, unknown>
    const command = typeof payload.command === 'string' ? payload.command : ''
    if (!actionType || !command) continue
    const riskLevel = classifyRisk(actionType, command)
    const needsApproval = requiresApproval(actionType, riskLevel, DEFAULT_POLICIES)
    const { data: action, error: actionError } = await db
      .from('actions')
      .insert({
        session_id: plan.session_id,
        plan_node_id: node.id,
        owner_id: user.id,
        action_type: actionType,
        command,
        cwd: typeof payload.cwd === 'string' ? payload.cwd : null,
        risk_level: riskLevel,
        status: needsApproval ? 'pending' : 'approved',
        requires_approval: needsApproval,
      })
      .select()
      .single()
    if (actionError) return NextResponse.json({ error: actionError.message }, { status: 500 })
    createdActions += 1
    if (needsApproval) {
      await db.from('notifications').insert({
        user_id: user.id,
        type: 'approval_required',
        title: `动作需要授权: ${command.slice(0, 50)}`,
        body: `计划「${plan.title}」中的步骤「${node.label}」需要授权，风险等级: ${riskLevel}`,
        ref_type: 'action',
        ref_id: action.id,
      })
    } else {
      dispatches.push(await dispatchApprovedAction(db, action as unknown as ActionRecordForDispatch))
    }
  }

  return NextResponse.json({ status: 'running', ready_nodes: readyNodes.length, created_actions: createdActions, dispatches })
}
