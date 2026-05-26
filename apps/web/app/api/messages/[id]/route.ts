import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { requireAuth } from '@/lib/auth-guard'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { user, error: authError } = await requireAuth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get message + session + workspace ownership
  const { data: msg } = await supabase
    .from('messages').select('session_id').eq('id', id).single()
  if (!msg) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: session } = await supabase
    .from('sessions').select('workspace_id').eq('id', msg.session_id).single()
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: workspace } = await supabase
    .from('workspaces').select('id').eq('id', session.workspace_id).eq('owner_id', user.id).single()
  if (!workspace) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  if (Object.keys(body).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  // Only allow is_pinned for now
  const updates: Record<string, unknown> = {}
  if (body.is_pinned !== undefined) updates.is_pinned = body.is_pinned

  const { data, error } = await supabase
    .from('messages').update(updates).eq('id', id).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
