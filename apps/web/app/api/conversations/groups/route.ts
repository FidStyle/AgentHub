import { createClient } from '@/lib/app-db-client'
import { requireAuth } from '@/lib/auth-guard'
import { NextResponse } from 'next/server'

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : []
}

export async function POST(request: Request) {
  const db = await createClient()
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const body = await request.json()
  const workspaceId = typeof body.workspace_id === 'string' ? body.workspace_id : ''
  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : ''
  const participantIds = [...new Set(stringArray(body.participant_role_agent_ids))]
  if (!workspaceId) return NextResponse.json({ error: '缺少 workspace_id' }, { status: 400 })
  if (!name) return NextResponse.json({ error: '缺少群聊名称' }, { status: 400 })
  if (participantIds.length === 0) return NextResponse.json({ error: '至少选择一个联系人' }, { status: 400 })

  const { data: ws } = await db
    .from('workspaces')
    .select('id')
    .eq('id', workspaceId)
    .eq('owner_id', user.id)
    .single()
  if (!ws) return NextResponse.json({ error: '无权限' }, { status: 403 })

  const { data: roles } = await db
    .from('role_agents')
    .select('id')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true })
  const validIds = new Set((Array.isArray(roles) ? roles as Array<{ id: string }> : []).map((role) => role.id))
  if (participantIds.some((id) => !validIds.has(id))) {
    return NextResponse.json({ error: '群聊联系人不存在或无权限' }, { status: 403 })
  }

  const now = new Date().toISOString()
  const { data: session, error } = await db
    .from('sessions')
    .insert({
      workspace_id: workspaceId,
      name,
      chat_kind: 'group',
      participant_role_agent_ids: participantIds,
      metadata: { participant_role_agent_ids: participantIds },
      last_activity_at: now,
      updated_at: now,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = participantIds.map((roleAgentId) => ({ session_id: session.id, role_agent_id: roleAgentId }))
  await db.from('session_participants').insert(rows)

  return NextResponse.json({ ...session, participants: participantIds }, { status: 201 })
}
