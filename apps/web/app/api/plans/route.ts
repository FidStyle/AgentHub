import { createClient } from '@/lib/app-db-client'
import { requireAuth } from '@/lib/auth-guard'
import { NextResponse } from 'next/server'
import { assertSessionOwner } from '@/lib/chat/attachments-artifacts'

function toPostgresUuidArray(values: string[] | undefined) {
  const safeValues = values ?? []
  return `{${safeValues.map((value) => `"${value.replace(/"/g, '\\"')}"`).join(',')}}`
}

// GET /api/plans?session_id=xxx — list plans for session
// POST /api/plans — create a new plan
export async function GET(request: Request) {
  const db = await createClient()
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('session_id')
  if (!sessionId) return NextResponse.json({ error: 'session_id 必填' }, { status: 400 })

  const owner = await assertSessionOwner(db, sessionId, user.id)
  if (!owner.ok) return NextResponse.json({ error: owner.error }, { status: owner.status })

  const { data: plans, error } = await db
    .from('plans')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const planRows = Array.isArray(plans) ? plans : []
  if (planRows.length === 0) return NextResponse.json([])

  const planIds = planRows.map((plan: { id: string }) => plan.id)
  const { data: nodes, error: nodesError } = await db
    .from('plan_nodes')
    .select('*')
    .in('plan_id', planIds)

  if (nodesError) return NextResponse.json({ error: nodesError.message }, { status: 500 })

  const nodesByPlan = new Map<string, unknown[]>()
  for (const node of (Array.isArray(nodes) ? nodes : []) as Array<{ plan_id: string }>) {
    const list = nodesByPlan.get(node.plan_id) ?? []
    list.push(node)
    nodesByPlan.set(node.plan_id, list)
  }

  return NextResponse.json(
    planRows.map((plan: { id: string }) => ({
      ...plan,
      plan_nodes: nodesByPlan.get(plan.id) ?? [],
    })),
  )
}

export async function POST(request: Request) {
  const db = await createClient()
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const body = await request.json()
  const { session_id, title, nodes } = body

  if (!session_id || !title || !nodes?.length) {
    return NextResponse.json({ error: 'session_id, title, nodes 必填' }, { status: 400 })
  }

  const owner = await assertSessionOwner(db, session_id, user.id)
  if (!owner.ok) return NextResponse.json({ error: owner.error }, { status: owner.status })

  // Build DAG edges from depends_on
  const edges = nodes.flatMap((n: { id: string; depends_on?: string[] }) =>
    (n.depends_on || []).map((dep: string) => ({ from: dep, to: n.id }))
  )
  const dag = { nodes: nodes.map((n: { id: string; label: string; depends_on?: string[] }) => ({ id: n.id, label: n.label, depends_on: n.depends_on || [] })), edges }

  const { data: plan, error: planErr } = await db
    .from('plans')
    .insert({ session_id, owner_id: user.id, title, dag, status: 'pending_confirm' })
    .select()
    .single()

  if (planErr) return NextResponse.json({ error: planErr.message }, { status: 500 })

  // Insert plan nodes
  const nodeRows = nodes.map((n: { id: string; label: string; agent_id?: string; action_type?: string; action_payload?: Record<string, unknown>; depends_on?: string[] }) => ({
    id: n.id,
    plan_id: plan.id,
    label: n.label,
    agent_id: n.agent_id || null,
    action_type: n.action_type || null,
    action_payload: n.action_payload || {},
    depends_on: toPostgresUuidArray(n.depends_on),
    status: 'pending',
  }))

  const { error: nodesErr } = await db.from('plan_nodes').insert(nodeRows)
  if (nodesErr) return NextResponse.json({ error: nodesErr.message }, { status: 500 })

  // Create notification for approval
  await db.from('notifications').insert({
    user_id: user.id,
    type: 'approval_required',
    title: `计划待确认: ${title}`,
    body: `${nodes.length} 个步骤等待确认执行`,
    ref_type: 'plan',
    ref_id: plan.id,
  })

  return NextResponse.json(plan, { status: 201 })
}
