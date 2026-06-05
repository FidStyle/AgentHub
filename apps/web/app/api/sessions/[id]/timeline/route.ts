import { NextResponse } from 'next/server'
import { createClient } from '@/lib/app-db-client'
import { requireAuth } from '@/lib/auth-guard'

type TimelineKind = 'message' | 'plan' | 'plan_node' | 'attempt' | 'mailbox' | 'runtime' | 'action' | 'artifact' | 'deployment'

type TimelineItem = {
  id: string
  kind: TimelineKind
  status: string
  title: string
  summary: string
  createdAt: string
  roleAgentId?: string | null
  roleName?: string | null
  refs?: Record<string, unknown>
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function text(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value : fallback
}

function time(value: unknown) {
  return typeof value === 'string' ? value : new Date(0).toISOString()
}

function clip(value: unknown, fallback = '') {
  const raw = text(value, fallback).replace(/\s+/g, ' ').trim()
  return raw.length > 180 ? `${raw.slice(0, 180)}...` : raw
}

function item(input: TimelineItem): TimelineItem {
  return input
}

function byCreatedAt(a: TimelineItem, b: TimelineItem) {
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
}

function ids(rows: unknown[], key: string) {
  return rows
    .map((row) => asRecord(row)[key])
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
}

function deploymentRefs(action: Record<string, unknown>, artifactByActionId: Map<string, Record<string, unknown>>) {
  const result = asRecord(action.result)
  const deployment = asRecord(result.deployment)
  const artifact = artifactByActionId.get(String(action.id))
  return {
    actionId: action.id,
    previewPath: result.previewPath ?? deployment.previewPath ?? asRecord(artifact?.metadata).previewPath ?? null,
    manifestPath: result.manifestPath ?? deployment.manifestPath ?? asRecord(artifact?.metadata).manifestPath ?? null,
    artifactId: artifact?.id ?? result.artifactId ?? null,
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: sessionId } = await params
  const db = await createClient()
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const { data: session } = await db
    .from('sessions')
    .select('id, workspace_id')
    .eq('id', sessionId)
    .single()
  if (!session) return NextResponse.json({ error: '会话不存在' }, { status: 404 })
  const sessionRow = asRecord(session)
  const workspaceId = text(sessionRow.workspace_id)
  if (!workspaceId) return NextResponse.json({ error: '会话缺少工作区绑定' }, { status: 500 })

  const { data: workspace } = await db
    .from('workspaces')
    .select('id')
    .eq('id', workspaceId)
    .eq('owner_id', user.id)
    .single()
  if (!workspace) return NextResponse.json({ error: '无权限' }, { status: 403 })

  const [messagesRes, plansRes, actionsRes, artifactsRes] = await Promise.all([
    db.from('messages').select('*').eq('session_id', sessionId).order('created_at', { ascending: true }),
    db.from('plans').select('*').eq('session_id', sessionId).order('created_at', { ascending: true }),
    db.from('actions').select('*').eq('session_id', sessionId).order('created_at', { ascending: true }),
    db.from('artifacts').select('*').eq('session_id', sessionId).order('created_at', { ascending: true }),
  ])
  for (const res of [messagesRes, plansRes, actionsRes, artifactsRes]) {
    if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 })
  }

  const messages = Array.isArray(messagesRes.data) ? messagesRes.data as unknown[] : []
  const plans = Array.isArray(plansRes.data) ? plansRes.data as unknown[] : []
  const actions = Array.isArray(actionsRes.data) ? actionsRes.data as unknown[] : []
  const artifacts = Array.isArray(artifactsRes.data) ? artifactsRes.data as unknown[] : []
  const planIds = ids(plans, 'id')
  const { data: nodes, error: nodesError } = planIds.length > 0
    ? await db.from('plan_nodes').select('*').in('plan_id', planIds).order('created_at', { ascending: true })
    : { data: [], error: null }
  if (nodesError) return NextResponse.json({ error: nodesError.message }, { status: 500 })

  const nodeRows = Array.isArray(nodes) ? nodes as unknown[] : []
  const nodeIds = ids(nodeRows, 'id')
  const [attemptsRes, mailboxRes] = nodeIds.length > 0
    ? await Promise.all([
      db.from('plan_node_attempts').select('*').in('plan_node_id', nodeIds).order('created_at', { ascending: true }),
      db.from('agent_mailbox_items').select('*').in('plan_node_id', nodeIds).order('created_at', { ascending: true }),
    ])
    : [{ data: [], error: null }, { data: [], error: null }]
  if (attemptsRes.error) return NextResponse.json({ error: attemptsRes.error.message }, { status: 500 })
  if (mailboxRes.error) return NextResponse.json({ error: mailboxRes.error.message }, { status: 500 })

  const attempts = Array.isArray(attemptsRes.data) ? attemptsRes.data as unknown[] : []
  const mailboxItems = Array.isArray(mailboxRes.data) ? mailboxRes.data as unknown[] : []
  const runtimeSessionIds = ids(attempts, 'runtime_session_id')
  const [{ data: runtimeSessionsBySession, error: runtimeBySessionError }, { data: runtimeSessionsByAttempt, error: runtimeByAttemptError }] = await Promise.all([
    db.from('runtime_sessions').select('*').eq('session_id', sessionId).order('created_at', { ascending: true }),
    runtimeSessionIds.length > 0
      ? db.from('runtime_sessions').select('*').in('id', runtimeSessionIds).order('created_at', { ascending: true })
      : { data: [], error: null },
  ])
  if (runtimeBySessionError) return NextResponse.json({ error: runtimeBySessionError.message }, { status: 500 })
  if (runtimeByAttemptError) return NextResponse.json({ error: runtimeByAttemptError.message }, { status: 500 })
  const runtimeSessionById = new Map<string, Record<string, unknown>>()
  for (const value of [
    ...(Array.isArray(runtimeSessionsBySession) ? runtimeSessionsBySession as unknown[] : []),
    ...(Array.isArray(runtimeSessionsByAttempt) ? runtimeSessionsByAttempt as unknown[] : []),
  ]) {
    const row = asRecord(value)
    const id = text(row.id)
    if (id) runtimeSessionById.set(id, row)
  }

  const artifactByActionId = new Map<string, Record<string, unknown>>()
  for (const artifactValue of artifacts) {
    const artifact = asRecord(artifactValue)
    const metadata = asRecord(artifact.metadata)
    const actionId = text(metadata.actionId)
    if (actionId) artifactByActionId.set(actionId, artifact)
  }

  const timeline: TimelineItem[] = []
  for (const value of messages) {
    const row = asRecord(value)
    const kind = text(row.message_type, 'text') === 'role_acknowledgement' ? '角色确认' : text(row.message_type, '消息')
    timeline.push(item({
      id: `message-${row.id}`,
      kind: 'message',
      status: text(row.streaming_status, 'complete'),
      title: kind,
      summary: clip(row.content, '空消息'),
      createdAt: time(row.created_at),
      roleAgentId: text(row.role_agent_id) || null,
      refs: { messageId: row.id, messageType: row.message_type },
    }))
  }
  for (const value of plans) {
    const row = asRecord(value)
    timeline.push(item({
      id: `plan-${row.id}`,
      kind: 'plan',
      status: text(row.status, 'unknown'),
      title: `编排计划：${text(row.title, '未命名计划')}`,
      summary: `计划状态 ${text(row.status, 'unknown')}`,
      createdAt: time(row.created_at),
      refs: { planId: row.id },
    }))
  }
  for (const value of nodeRows) {
    const row = asRecord(value)
    timeline.push(item({
      id: `node-${row.id}`,
      kind: 'plan_node',
      status: text(row.status, 'unknown'),
      title: `计划节点：${text(row.label, '未命名节点')}`,
      summary: text(row.agent_id) ? `分派角色 ${row.agent_id}` : `动作 ${text(row.action_type, '未指定')}`,
      createdAt: time(row.created_at),
      roleAgentId: text(row.agent_id) || null,
      refs: { planId: row.plan_id, planNodeId: row.id },
    }))
  }
  for (const value of attempts) {
    const row = asRecord(value)
    timeline.push(item({
      id: `attempt-${row.id}`,
      kind: 'attempt',
      status: text(row.status, 'unknown'),
      title: `执行尝试 #${row.attempt_number ?? 1}`,
      summary: text(row.runtime_session_id) ? `Runtime session ${row.runtime_session_id}` : text(row.error, '等待 runtime 绑定'),
      createdAt: time(row.created_at),
      refs: { planNodeId: row.plan_node_id, attemptId: row.id, runtimeSessionId: row.runtime_session_id },
    }))
  }
  for (const value of mailboxItems) {
    const row = asRecord(value)
    const context = asRecord(row.context_package)
    timeline.push(item({
      id: `mailbox-${row.id}`,
      kind: 'mailbox',
      status: text(row.status, 'unknown'),
      title: `角色交接：${text(context.toRoleName, text(row.to_role_agent_id, '目标角色'))}`,
      summary: clip(context.summary, '等待角色处理'),
      createdAt: time(row.created_at),
      roleAgentId: text(row.to_role_agent_id) || null,
      roleName: text(context.toRoleName) || null,
      refs: { planNodeId: row.plan_node_id, mailboxItemId: row.id, attemptId: row.attempt_id },
    }))
  }
  for (const row of runtimeSessionById.values()) {
    timeline.push(item({
      id: `runtime-${row.id}`,
      kind: 'runtime',
      status: text(row.status, 'unknown'),
      title: `Runtime：${text(row.runtime_type, 'unknown')}`,
      summary: text(row.native_session_id) ? `native ${row.native_session_id}` : text(row.error, '运行会话已记录'),
      createdAt: time(row.created_at),
      roleAgentId: text(row.role_agent_id) || null,
      refs: { runtimeSessionId: row.id, nativeSessionId: row.native_session_id },
    }))
  }
  for (const value of actions) {
    const row = asRecord(value)
    const isDeploy = row.action_type === 'deploy'
    const refs = isDeploy ? deploymentRefs(row, artifactByActionId) : { actionId: row.id }
    timeline.push(item({
      id: `${isDeploy ? 'deployment' : 'action'}-${row.id}`,
      kind: isDeploy ? 'deployment' : 'action',
      status: text(row.status, 'unknown'),
      title: isDeploy ? '部署动作' : `权限动作：${text(row.action_type, 'unknown')}`,
      summary: clip(row.command, '无命令摘要'),
      createdAt: time(row.created_at),
      refs,
    }))
  }
  for (const value of artifacts) {
    const row = asRecord(value)
    const metadata = asRecord(row.metadata)
    timeline.push(item({
      id: `artifact-${row.id}`,
      kind: metadata.kind === 'deployment' ? 'deployment' : 'artifact',
      status: 'created',
      title: metadata.kind === 'deployment' ? `部署产物：${text(row.title, '部署结果')}` : `产物：${text(row.title, '未命名产物')}`,
      summary: text(row.source_path) || text(row.content_ref, '可从产物 API 读回'),
      createdAt: time(row.created_at),
      refs: { artifactId: row.id, sourcePath: row.source_path, contentRef: row.content_ref, metadata },
    }))
  }

  return NextResponse.json({
    sessionId,
    workspaceId,
    items: timeline.sort(byCreatedAt),
  })
}
