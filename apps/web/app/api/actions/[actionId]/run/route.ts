import { createClient } from '@/lib/app-db-client'
import { requireAuth } from '@/lib/auth-guard'
import { dispatchApprovedAction } from '@/lib/orchestrator/action-dispatcher'
import type { ActionRecordForDispatch } from '@/lib/orchestrator/action-dispatcher'
import { NextResponse } from 'next/server'

// POST /api/actions/[actionId]/run — retry or resume an approved action dispatch.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ actionId: string }> },
) {
  const { actionId } = await params
  const db = await createClient()
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const { data: action } = await db
    .from('actions')
    .select('*')
    .eq('id', actionId)
    .eq('owner_id', user.id)
    .single()

  if (!action) return NextResponse.json({ error: '动作不存在' }, { status: 404 })
  if (!['approved', 'failed'].includes(String(action.status))) {
    return NextResponse.json({ error: '动作状态不允许执行' }, { status: 400 })
  }

  const dispatch = await dispatchApprovedAction(db, action as unknown as ActionRecordForDispatch)
  return NextResponse.json({ status: action.status, dispatch })
}
