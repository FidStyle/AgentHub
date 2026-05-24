import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

// POST /api/actions/[actionId]/approve — approve or reject an action
export async function POST(
  request: Request,
  { params }: { params: Promise<{ actionId: string }> }
) {
  const { actionId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '未授权' }, { status: 401 })

  const body = await request.json()
  const { approved } = body // boolean

  const { data: action } = await supabase
    .from('actions')
    .select('*')
    .eq('id', actionId)
    .eq('owner_id', user.id)
    .single()

  if (!action) return NextResponse.json({ error: '动作不存在' }, { status: 404 })
  if (action.status !== 'pending') {
    return NextResponse.json({ error: '动作状态不允许审批' }, { status: 400 })
  }

  const newStatus = approved ? 'approved' : 'rejected'
  await supabase.from('actions').update({
    status: newStatus,
    approved_at: approved ? new Date().toISOString() : null,
  }).eq('id', actionId)

  return NextResponse.json({ status: newStatus })
}
