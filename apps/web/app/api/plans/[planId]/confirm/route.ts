import { createClient } from '@/lib/supabase-server'
import { requireAuth } from '@/lib/auth-guard'
import { NextResponse } from 'next/server'
import { getReadyNodes } from '@/lib/orchestrator/dag-scheduler'
import type { PlanNode } from '@agenthub/shared'

// POST /api/plans/[planId]/confirm — user confirms plan, start execution
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ planId: string }> }
) {
  const { planId } = await params
  const supabase = await createClient()
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  // Verify ownership
  const { data: plan } = await supabase
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
  await supabase.from('plans').update({ status: 'running', updated_at: new Date().toISOString() }).eq('id', planId)

  // Get nodes and mark ready ones
  const { data: nodes } = await supabase.from('plan_nodes').select('*').eq('plan_id', planId)
  const readyNodes = getReadyNodes(nodes as PlanNode[])

  for (const node of readyNodes) {
    await supabase.from('plan_nodes').update({ status: 'ready' }).eq('id', node.id)
  }

  return NextResponse.json({ status: 'running', ready_nodes: readyNodes.length })
}
