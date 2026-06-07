import { createClient } from '@/lib/app-db-client'
import { requireAuth } from '@/lib/auth-guard'
import { buildConversationRows, loadSessionLastMessage } from '@/lib/conversations'
import { ensureDefaultRoleAgents } from '@/lib/role-agents/defaults'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const db = await createClient()
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const { searchParams } = new URL(request.url)
  const workspaceId = searchParams.get('workspace_id')
  const status = searchParams.get('status') ?? 'active'
  if (!workspaceId) return NextResponse.json({ error: '缺少 workspace_id' }, { status: 400 })
  if (!['active', 'archived', 'all'].includes(status)) return NextResponse.json({ error: '无效的会话状态' }, { status: 400 })

  const { data: ws } = await db
    .from('workspaces')
    .select('id')
    .eq('id', workspaceId)
    .eq('owner_id', user.id)
    .single()
  if (!ws) return NextResponse.json({ error: '无权限' }, { status: 403 })

  const { data: roleData, error: roleError } = await db
    .from('role_agents')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true })
  if (roleError) return NextResponse.json({ error: roleError.message }, { status: 500 })
  const rolesBeforeSeed = Array.isArray(roleData) ? roleData as unknown as Array<{ id: string; name: string }> : []
  const seedResult = await ensureDefaultRoleAgents(db, workspaceId, rolesBeforeSeed)
  if (seedResult?.error) return NextResponse.json({ error: seedResult.error.message }, { status: 500 })
  const roles = seedResult?.data && Array.isArray(seedResult.data) && seedResult.data.length > 0
    ? [...rolesBeforeSeed, ...seedResult.data as unknown as Array<{ id: string; name: string }>]
    : rolesBeforeSeed

  const { data: sessionsData, error: sessionError } = await db
    .from('sessions')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false })
  if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 })
  const sessions = Array.isArray(sessionsData) ? sessionsData as Array<{ id: string }> : []
  const lastMessages = new Map<string, Awaited<ReturnType<typeof loadSessionLastMessage>>>()
  await Promise.all(sessions.map(async (session) => {
    lastMessages.set(session.id, await loadSessionLastMessage(db, session.id))
  }))

  return NextResponse.json(buildConversationRows({
    roles: roles as never,
    sessions: sessions as never,
    lastMessages,
    status: status as 'active' | 'archived' | 'all',
  }))
}
