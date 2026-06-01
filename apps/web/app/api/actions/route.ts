import { createClient } from '@/lib/app-db-client'
import { requireAuth } from '@/lib/auth-guard'
import { NextResponse } from 'next/server'
import { classifyRisk, requiresApproval } from '@/lib/orchestrator/permission-engine'
import { DEFAULT_POLICIES } from '@agenthub/shared'
import { assertSessionOwner } from '@/lib/chat/attachments-artifacts'

// GET /api/actions?session_id=xxx
// POST /api/actions — create an action (auto-classify risk)
export async function GET(request: Request) {
  const db = await createClient()
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('session_id')
  if (!sessionId) return NextResponse.json({ error: 'session_id 必填' }, { status: 400 })

  const owner = await assertSessionOwner(db, sessionId, user.id)
  if (!owner.ok) return NextResponse.json({ error: owner.error }, { status: owner.status })

  const { data } = await db
    .from('actions')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })

  return NextResponse.json(data || [])
}

export async function POST(request: Request) {
  const db = await createClient()
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const body = await request.json()
  const { session_id, plan_node_id, action_type, command, cwd } = body

  if (!session_id || !action_type || !command) {
    return NextResponse.json({ error: 'session_id, action_type, command 必填' }, { status: 400 })
  }

  const owner = await assertSessionOwner(db, session_id, user.id)
  if (!owner.ok) return NextResponse.json({ error: owner.error }, { status: owner.status })

  const riskLevel = classifyRisk(action_type, command)
  const needsApproval = requiresApproval(action_type, riskLevel, DEFAULT_POLICIES)

  const { data: action, error } = await db
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

  // If the action exceeds the current policy, create an authorization notification.
  if (needsApproval) {
    await db.from('notifications').insert({
      user_id: user.id,
      type: 'approval_required',
      title: `动作需要授权: ${command.slice(0, 50)}`,
      body: `风险等级: ${riskLevel}`,
      ref_type: 'action',
      ref_id: action.id,
    })
  }

  return NextResponse.json(action, { status: 201 })
}
