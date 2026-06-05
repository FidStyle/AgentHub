import { createClient } from '@/lib/app-db-client'
import { requireAuth } from '@/lib/auth-guard'
import { NextResponse } from 'next/server'
import { dispatchApprovedAction } from '@/lib/orchestrator/action-dispatcher'
import type { ActionRecordForDispatch } from '@/lib/orchestrator/action-dispatcher'

type ActionApprovalRow = ActionRecordForDispatch & {
  status: string
  result?: Record<string, unknown> | null
}

type MessagePermissionPart = {
  id?: unknown
  type?: unknown
  status?: unknown
  actionId?: unknown
}

function permissionStatusForDecision(
  approved: boolean,
  dispatch?: Awaited<ReturnType<typeof dispatchApprovedAction>>,
) {
  if (!approved) return 'rejected'
  if (dispatch?.status === 'completed') return 'completed'
  if (dispatch?.status === 'queued') return 'running'
  if (dispatch?.status === 'unavailable') return 'failed'
  return 'approved'
}

async function updateInlinePermissionParts(
  db: Awaited<ReturnType<typeof createClient>>,
  input: {
    sessionId: string
    actionId: string
    status: string
  },
) {
  const { data: messages } = await db
    .from('messages')
    .select('id, metadata')
    .eq('session_id', input.sessionId)

  for (const message of (Array.isArray(messages) ? messages : []) as Array<{ id?: string; metadata?: unknown }>) {
    const metadata = message.metadata && typeof message.metadata === 'object' && !Array.isArray(message.metadata)
      ? message.metadata as Record<string, unknown>
      : null
    const parts = Array.isArray(metadata?.runtimeParts) ? metadata.runtimeParts : null
    if (!message.id || !metadata || !parts) continue

    let changed = false
    const nextParts = parts.map((part) => {
      if (!part || typeof part !== 'object' || Array.isArray(part)) return part
      const record = part as MessagePermissionPart
      if (record.type !== 'permission' || record.actionId !== input.actionId) return part
      changed = true
      return { ...(part as Record<string, unknown>), status: input.status }
    })
    if (!changed) continue

    await db
      .from('messages')
      .update({ metadata: { ...metadata, runtimeParts: nextParts } })
      .eq('id', message.id)
  }
}

// POST /api/actions/[actionId]/approve — authorize or cancel an action.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ actionId: string }> }
) {
  const { actionId } = await params
  const db = await createClient()
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const body = await request.json()
  const { approved } = body // boolean

  const { data: action } = await db
    .from('actions')
    .select('*')
    .eq('id', actionId)
    .eq('owner_id', user.id)
    .single()

  if (!action) return NextResponse.json({ error: '动作不存在' }, { status: 404 })
  const actionRow = action as unknown as ActionApprovalRow
  if (actionRow.status !== 'pending') {
    return NextResponse.json({ error: '动作状态不允许授权' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const newStatus = approved ? 'approved' : 'rejected'
  await db.from('actions').update({
    status: newStatus,
    approved_at: approved ? now : null,
    result: {
      ...(actionRow.result ?? {}),
      approvalDecision: approved ? 'approved' : 'rejected',
      decidedAt: now,
    },
  }).eq('id', actionId)

  const dispatch = approved ? await dispatchApprovedAction(db, actionRow) : undefined
  await updateInlinePermissionParts(db, {
    sessionId: actionRow.session_id,
    actionId,
    status: permissionStatusForDecision(Boolean(approved), dispatch),
  })

  if (!approved) {
    await db.from('messages').insert({
      session_id: actionRow.session_id,
      content: '已拒绝本次执行，相关动作没有运行。任务已停在当前权限边界，等待你的下一次输入。',
      sender_type: 'agent',
      role_agent_id: actionRow.role_agent_id ?? null,
      message_type: 'system_event',
      metadata: {
        actionDecision: {
          actionId,
          status: 'rejected',
          planNodeId: actionRow.plan_node_id ?? null,
        },
        runtimeParts: [{
          id: actionId,
          type: 'permission',
          status: 'rejected',
          actionId,
          title: '已拒绝本次执行',
          description: '该动作没有运行，任务已停在当前权限边界。',
        }],
      },
    })
    const planNodeId = actionRow.plan_node_id
    if (planNodeId) {
      await db.from('plan_nodes').update({
        status: 'waiting',
        completed_at: null,
        result: {
          approvalDecision: 'rejected',
          actionId,
          reason: '用户拒绝权限动作，等待下一次输入。',
          at: now,
        },
      }).eq('id', planNodeId)
    }
  }

  return NextResponse.json({ status: newStatus, dispatch })
}
