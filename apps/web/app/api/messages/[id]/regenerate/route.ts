import { NextResponse } from 'next/server'
import { createClient } from '@/lib/app-db-client'
import { requireAuth } from '@/lib/auth-guard'

type MessageRow = {
  id: string
  session_id: string
  sender_type: string
  sender_id: string | null
  role_agent_id: string | null
  content: string
  metadata: Record<string, unknown> | null
  created_at: string
}

type SessionRow = {
  id: string
  workspace_id: string
  metadata?: Record<string, unknown> | null
}

function metadataString(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function userRoleIds(metadata: Record<string, unknown> | null | undefined, fallbackRoleId: string | null) {
  const roleAgents = Array.isArray(metadata?.roleAgents) ? metadata?.roleAgents : []
  const ids = roleAgents
    .map((role) => role && typeof role === 'object' ? (role as { id?: unknown }).id : null)
    .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
  if (ids.length > 0) return ids
  const mentions = Array.isArray(metadata?.mentions) ? metadata?.mentions : []
  const mentionIds = mentions.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
  if (mentionIds.length > 0) return mentionIds
  return fallbackRoleId ? [fallbackRoleId] : []
}

async function fetchPreviousUserMessage(
  db: Awaited<ReturnType<typeof createClient>>,
  input: { sessionId: string; beforeCreatedAt: string },
) {
  const { data } = await db
    .from('messages')
    .select('*')
    .eq('session_id', input.sessionId)
    .eq('sender_type', 'user')
    .order('created_at', { ascending: false })

  const messages = Array.isArray(data) ? data as unknown as MessageRow[] : []
  return messages
    .filter((message) => String(message.created_at) <= input.beforeCreatedAt)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0] ?? null
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const db = await createClient()
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const { data: message } = await db
    .from('messages')
    .select('*')
    .eq('id', id)
    .single()
  if (!message) return NextResponse.json({ error: '消息不存在' }, { status: 404 })
  const target = message as unknown as MessageRow
  if (target.sender_type === 'user') {
    return NextResponse.json({ error: '用户消息不能重新生成，请直接重新发送。' }, { status: 400 })
  }

  const { data: session } = await db
    .from('sessions')
    .select('*')
    .eq('id', target.session_id)
    .single()
  if (!session) return NextResponse.json({ error: '会话不存在' }, { status: 404 })
  const sessionRow = session as unknown as SessionRow

  const { data: workspace } = await db
    .from('workspaces')
    .select('id')
    .eq('id', sessionRow.workspace_id)
    .eq('owner_id', user.id)
    .single()
  if (!workspace) return NextResponse.json({ error: '无权访问该消息' }, { status: 403 })

  const previousUserMessage = await fetchPreviousUserMessage(db, {
    sessionId: target.session_id,
    beforeCreatedAt: target.created_at,
  })
  if (!previousUserMessage?.content?.trim()) {
    return NextResponse.json({ error: '没有找到可重试的上一条用户消息' }, { status: 409 })
  }

  const roleAgentIds = userRoleIds(previousUserMessage.metadata, target.role_agent_id)
  const permissionMode = metadataString(previousUserMessage.metadata, 'permissionMode')
    ?? metadataString(target.metadata, 'permissionMode')

  return NextResponse.json({
    sessionId: target.session_id,
    content: previousUserMessage.content,
    roleAgentIds,
    roleAgentId: roleAgentIds[0] ?? target.role_agent_id ?? undefined,
    permissionMode: permissionMode ?? undefined,
    sourceMessageId: previousUserMessage.id,
    regenerateFromMessageId: target.id,
  })
}
