import { createClient } from '@/lib/supabase-server'
import { requireAuth } from '@/lib/auth-guard'
import { NextResponse } from 'next/server'

// GET /api/notifications — list user notifications
// PATCH /api/notifications — mark as read
export async function GET(request: Request) {
  const supabase = await createClient()
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const { searchParams } = new URL(request.url)
  const unreadOnly = searchParams.get('unread') === 'true'

  let query = supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50)
  if (unreadOnly) query = query.eq('read', false)

  const { data } = await query
  return NextResponse.json(data || [])
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const body = await request.json()
  const { ids } = body // string[]

  if (!ids?.length) return NextResponse.json({ error: 'ids 必填' }, { status: 400 })

  await supabase.from('notifications').update({ read: true }).in('id', ids).eq('user_id', user.id)
  return NextResponse.json({ marked: ids.length })
}
