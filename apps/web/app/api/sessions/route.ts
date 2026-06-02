import { createClient } from '@/lib/app-db-client'
import { requireAuth } from '@/lib/auth-guard'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const db = await createClient()
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const { searchParams } = new URL(request.url)
  const workspaceId = searchParams.get('workspace_id')
  const status = searchParams.get('status') ?? 'active'
  if (!workspaceId) return NextResponse.json({ error: '缺少 workspace_id' }, { status: 400 })
  if (!['active', 'archived', 'all'].includes(status)) {
    return NextResponse.json({ error: '无效的会话状态' }, { status: 400 })
  }

  const { data: ws } = await db
    .from('workspaces')
    .select('id')
    .eq('id', workspaceId)
    .eq('owner_id', user.id)
    .single()
  if (!ws) return NextResponse.json({ error: '无权限' }, { status: 403 })

  const { data, error } = await db
    .from('sessions')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const sessions = (Array.isArray(data) ? data : [])
    .filter((session: Record<string, unknown>) => status === 'all' || session.status === status)
  const enriched = await Promise.all(sessions.map(async (session: Record<string, unknown>) => {
    const { data: messages } = await db
      .from('messages')
      .select('content, sender_type, created_at')
      .eq('session_id', String(session.id))
      .order('created_at', { ascending: false })
    const lastMessage = Array.isArray(messages) ? messages[0] as { content?: string; sender_type?: string; created_at?: string } | undefined : undefined
    return {
      ...session,
      last_message: lastMessage?.content ?? '',
      last_message_sender_type: lastMessage?.sender_type ?? null,
      last_message_at: lastMessage?.created_at ?? null,
    }
  }))

  return NextResponse.json(enriched)
}

export async function POST(request: Request) {
  const db = await createClient()
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const body = await request.json()
  const { workspace_id, name } = body

  if (!workspace_id) return NextResponse.json({ error: '缺少 workspace_id' }, { status: 400 })

  // 验证 workspace 归属
  const { data: ws } = await db
    .from('workspaces')
    .select('id')
    .eq('id', workspace_id)
    .eq('owner_id', user.id)
    .single()

  if (!ws) return NextResponse.json({ error: '工作区不存在或无权限' }, { status: 403 })

  const { data, error } = await db
    .from('sessions')
    .insert({ workspace_id, name: name || '新会话' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
