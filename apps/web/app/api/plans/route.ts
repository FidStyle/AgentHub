import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

// GET /api/plans?session_id=xxx — list plans for session
// POST /api/plans — create a new plan
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '未授权' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('session_id')
  if (!sessionId) return NextResponse.json({ error: 'session_id 必填' }, { status: 400 })

  const { data, error } = await supabase
    .from('plans')
    .select('*, plan_nodes(*)')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '未授权' }, { status: 401 })

  const body = await request.json()
  const { session_id, title, nodes } = body

  if (!session_id || !title || !nodes?.length) {
    return NextResponse.json({ error: 'session_id, title, nodes 必填' }, { status: 400 })
  }

  // Build DAG edges from depends_on
  const edges = nodes.flatMap((n: { id: string; depends_on?: string[] }) =>
    (n.depends_on || []).map((dep: string) => ({ from: dep, to: n.id }))
  )
  const dag = { nodes: nodes.map((n: { id: string; label: string; depends_on?: string[] }) => ({ id: n.id, label: n.label, depends_on: n.depends_on || [] })), edges }

  const { data: plan, error: planErr } = await supabase
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
    depends_on: n.depends_on || [],
    status: 'pending',
  }))

  const { error: nodesErr } = await supabase.from('plan_nodes').insert(nodeRows)
  if (nodesErr) return NextResponse.json({ error: nodesErr.message }, { status: 500 })

  // Create notification for approval
  await supabase.from('notifications').insert({
    user_id: user.id,
    type: 'approval_required',
    title: `计划待确认: ${title}`,
    body: `${nodes.length} 个步骤等待确认执行`,
    ref_type: 'plan',
    ref_id: plan.id,
  })

  return NextResponse.json(plan, { status: 201 })
}
