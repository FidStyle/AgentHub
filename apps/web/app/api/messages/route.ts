import { NextResponse } from 'next/server'
import { createClient } from '@/lib/app-db-client'
import { requireAuth } from '@/lib/auth-guard'

export async function GET(request: Request) {
  const db = await createClient()
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('session_id')
  if (!sessionId) return NextResponse.json({ error: 'Missing session_id' }, { status: 400 })

  // Workspace ownership check
  const { data: session } = await db
    .from('sessions').select('workspace_id').eq('id', sessionId).single()
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: workspace } = await db
    .from('workspaces').select('id').eq('id', session.workspace_id).eq('owner_id', user.id).single()
  if (!workspace) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await db
    .from('messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const visibleMessages = Array.isArray(data)
    ? data.filter((message) => (message as Record<string, unknown>).message_type !== 'role_acknowledgement')
    : data
  return NextResponse.json(visibleMessages)
}

export async function POST(request: Request) {
  const db = await createClient()
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

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
  const { data: session } = await db
    .from('sessions').select('workspace_id').eq('id', session_id).single()
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: workspace } = await db
    .from('workspaces').select('id').eq('id', session.workspace_id).eq('owner_id', user.id).single()
  if (!workspace) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await db
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
