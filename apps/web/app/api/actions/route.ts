import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { classifyRisk, requiresApproval } from '@/lib/orchestrator/permission-engine'
import { DEFAULT_POLICIES } from '@agenthub/shared'

// GET /api/actions?session_id=xxx
// POST /api/actions — create an action (auto-classify risk)
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '未授权' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('session_id')
  if (!sessionId) return NextResponse.json({ error: 'session_id 必填' }, { status: 400 })

  const { data } = await supabase
    .from('actions')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })

  return NextResponse.json(data || [])
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '未授权' }, { status: 401 })

  const body = await request.json()
  const { session_id, plan_node_id, action_type, command, cwd } = body

  if (!session_id || !action_type || !command) {
    return NextResponse.json({ error: 'session_id, action_type, command 必填' }, { status: 400 })
  }

  const riskLevel = classifyRisk(action_type, command)
  const needsApproval = requiresApproval(action_type, riskLevel, DEFAULT_POLICIES)

  const { data: action, error } = await supabase
    .from('actions')
    .insert({
      session_id,
      plan_node_id: plan_node_id || null,
      owner_id: user.id,
      action_type,
      command,
      cwd: cwd || null,
      risk_level: riskLevel,
      status: needsApproval ? 'pending' : 'approved',
      requires_approval: needsApproval,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If requires approval, create notification
  if (needsApproval) {
    await supabase.from('notifications').insert({
      user_id: user.id,
      type: 'approval_required',
      title: `动作待审批: ${command.slice(0, 50)}`,
      body: `风险等级: ${riskLevel}`,
      ref_type: 'action',
      ref_id: action.id,
    })
  }

  return NextResponse.json(action, { status: 201 })
}
