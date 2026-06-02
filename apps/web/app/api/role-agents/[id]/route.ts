import { createClient } from '@/lib/app-db-client'
import { requireAuth } from '@/lib/auth-guard'
import { NextResponse } from 'next/server'

function isRuntimeType(value: unknown): value is 'claude_code' | 'codex' {
  return value === 'claude_code' || value === 'codex'
}

// Helper: auth + workspace ownership check
async function authAndOwn(userId: string, agentId: string) {
  const db = await createClient()

  const { data: agent, error: agentError } = await db
    .from('role_agents')
    .select('workspace_id')
    .eq('id', agentId)
    .single()

  if (agentError || !agent) return { error: 'Agent 不存在', status: 404, db, userId }

  const { data: ws } = await db
    .from('workspaces')
    .select('id')
    .eq('id', agent.workspace_id)
    .eq('owner_id', userId)
    .single()

  if (!ws) return { error: '无权限', status: 403, db, userId }
  return { db, userId, agentId, workspaceId: agent.workspace_id }
}

// GET: single agent
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const ctx = await authAndOwn(user.id, id)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  const { data, error } = await ctx.db
    .from('role_agents')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// PATCH: update agent
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const ctx = await authAndOwn(user.id, id)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  const body = await request.json()
  const { name, role_type, system_prompt, capabilities, runtime_type, is_orchestrator } = body
  if (runtime_type !== undefined && !isRuntimeType(runtime_type)) {
    return NextResponse.json({ error: 'runtime_type 必须是 claude_code 或 codex' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (name !== undefined) updates.name = name
  if (role_type !== undefined) updates.role_type = role_type
  if (system_prompt !== undefined) updates.system_prompt = system_prompt
  if (capabilities !== undefined) updates.capabilities = capabilities
  if (runtime_type !== undefined) updates.runtime_type = runtime_type
  if (is_orchestrator !== undefined) updates.is_orchestrator = is_orchestrator

  const { data, error } = await ctx.db
    .from('role_agents')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE: delete agent
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const ctx = await authAndOwn(user.id, id)
  if ('error' in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status })

  const { error } = await ctx.db.from('role_agents').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
