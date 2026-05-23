import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('session_id')
  if (!sessionId) return NextResponse.json({ error: 'Missing session_id' }, { status: 400 })

  // Workspace ownership check
  const { data: session } = await supabase
    .from('sessions').select('workspace_id').eq('id', sessionId).single()
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: workspace } = await supabase
    .from('workspaces').select('id').eq('id', session.workspace_id).eq('owner_id', user.id).single()
  if (!workspace) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const {
    session_id,
    content,
    sender_type = 'user',
    sender_id = null,
    role_agent_id = null,
    message_type = 'text',
    streaming_status = 'complete',
    metadata = null,
    is_pinned = false,
  } = body

  if (!session_id || !content) {
    return NextResponse.json({ error: 'Missing session_id or content' }, { status: 400 })
  }

  // Workspace ownership check
  const { data: session } = await supabase
    .from('sessions').select('workspace_id').eq('id', session_id).single()
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: workspace } = await supabase
    .from('workspaces').select('id').eq('id', session.workspace_id).eq('owner_id', user.id).single()
  if (!workspace) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('messages')
    .insert({
      session_id,
      content,
      sender_type,
      sender_id,
      role_agent_id,
      message_type,
      streaming_status,
      metadata,
      is_pinned,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
