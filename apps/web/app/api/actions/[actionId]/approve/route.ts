import { createClient } from '@/lib/app-db-client'
import { requireAuth } from '@/lib/auth-guard'
import { NextResponse } from 'next/server'

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
  if (action.status !== 'pending') {
    return NextResponse.json({ error: '动作状态不允许授权' }, { status: 400 })
  }

  const newStatus = approved ? 'approved' : 'rejected'
  await db.from('actions').update({
    status: newStatus,
    approved_at: approved ? new Date().toISOString() : null,
  }).eq('id', actionId)

  return NextResponse.json({ status: newStatus })
}
