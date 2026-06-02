import { NextResponse } from 'next/server'
import { createClient } from '@/lib/app-db-client'
import { requireAuth } from '@/lib/auth-guard'

function ids(rows: unknown[], key: string) {
  return rows
    .map((row) => (row as Record<string, unknown>)[key])
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { planId } = await params
  const db = await createClient()
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const { data: plan, error: planError } = await db
    .from('plans')
    .select('*')
    .eq('id', planId)
    .eq('owner_id', user.id)
    .single()

  if (planError || !plan) return NextResponse.json({ error: '计划不存在或无权限' }, { status: 404 })

  const { data: nodes, error: nodesError } = await db
    .from('plan_nodes')
    .select('*')
    .eq('plan_id', planId)
    .order('created_at', { ascending: true })
  if (nodesError) return NextResponse.json({ error: nodesError.message }, { status: 500 })

  const nodeRows = Array.isArray(nodes) ? nodes : []
  const nodeIds = ids(nodeRows, 'id')
  const { data: attempts, error: attemptsError } = nodeIds.length > 0
    ? await db
      .from('plan_node_attempts')
      .select('*')
      .in('plan_node_id', nodeIds)
      .order('attempt_number', { ascending: true })
    : { data: [], error: null }
  if (attemptsError) return NextResponse.json({ error: attemptsError.message }, { status: 500 })

  const { data: mailboxItems, error: mailboxError } = await db
    .from('agent_mailbox_items')
    .select('*')
    .eq('plan_id', planId)
    .order('created_at', { ascending: true })
  if (mailboxError) return NextResponse.json({ error: mailboxError.message }, { status: 500 })

  const attemptRows = Array.isArray(attempts) ? attempts : []
  const runtimeSessionIds = ids(attemptRows, 'runtime_session_id')
  const { data: runtimeSessions, error: runtimeSessionsError } = runtimeSessionIds.length > 0
    ? await db
      .from('runtime_sessions')
      .select('*')
      .in('id', runtimeSessionIds)
    : { data: [], error: null }
  if (runtimeSessionsError) return NextResponse.json({ error: runtimeSessionsError.message }, { status: 500 })

  const { data: runtimeLogs, error: runtimeLogsError } = runtimeSessionIds.length > 0
    ? await db
      .from('runtime_logs')
      .select('*')
      .in('runtime_session_id', runtimeSessionIds)
      .order('seq', { ascending: true })
    : { data: [], error: null }
  if (runtimeLogsError) return NextResponse.json({ error: runtimeLogsError.message }, { status: 500 })

  const { data: artifacts, error: artifactsError } = await db
    .from('artifacts')
    .select('*')
    .eq('session_id', (plan as unknown as { session_id: string }).session_id)
    .order('created_at', { ascending: true })
  if (artifactsError) return NextResponse.json({ error: artifactsError.message }, { status: 500 })

  return NextResponse.json({
    plan,
    nodes: nodeRows,
    attempts: attemptRows,
    mailbox_items: Array.isArray(mailboxItems) ? mailboxItems : [],
    runtime_sessions: Array.isArray(runtimeSessions) ? runtimeSessions : [],
    runtime_logs: Array.isArray(runtimeLogs) ? runtimeLogs : [],
    artifacts: Array.isArray(artifacts) ? artifacts : [],
  })
}
