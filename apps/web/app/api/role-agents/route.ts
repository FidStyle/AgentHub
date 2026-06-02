import { createClient } from '@/lib/app-db-client'
import { requireAuth } from '@/lib/auth-guard'
import { NextResponse } from 'next/server'
import { ensureDefaultRoleAgents } from '@/lib/role-agents/defaults'

function isRuntimeType(value: unknown): value is 'claude_code' | 'codex' {
  return value === 'claude_code' || value === 'codex'
}

function hasLegacyRuntimeTag(value: unknown): boolean {
  return Array.isArray(value) && value.some((item) => typeof item === 'string' && item.startsWith('runtime:'))
}

// GET: list all role agents for a workspace
export async function GET(request: Request) {
  const db = await createClient()
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const { searchParams } = new URL(request.url)
  const workspaceId = searchParams.get('workspace_id')
  if (!workspaceId) return NextResponse.json({ error: '缺少 workspace_id' }, { status: 400 })

  const { data: ws } = await db
    .from('workspaces')
    .select('id')
    .eq('id', workspaceId)
    .eq('owner_id', user.id)
    .single()
  if (!ws) return NextResponse.json({ error: '无权限' }, { status: 403 })

  const { data, error } = await db
    .from('role_agents')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = (data ?? []) as unknown as Array<{ name: string }>
  const seedResult = await ensureDefaultRoleAgents(db, workspaceId, rows)
  if (seedResult?.error) return NextResponse.json({ error: seedResult.error.message }, { status: 500 })
  if (seedResult?.data && Array.isArray(seedResult.data)) {
    return NextResponse.json([...(data ?? []), ...seedResult.data])
  }

  return NextResponse.json(data)
}

// POST: create a new role agent
export async function POST(request: Request) {
  const db = await createClient()
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const body = await request.json()
  const { workspace_id, name, role_type, system_prompt, capabilities, runtime_type, is_orchestrator } = body

  if (!workspace_id) return NextResponse.json({ error: '缺少 workspace_id' }, { status: 400 })
  if (!name) return NextResponse.json({ error: '缺少 name' }, { status: 400 })
  if (runtime_type !== undefined && !isRuntimeType(runtime_type)) {
    return NextResponse.json({ error: 'runtime_type 必须是 claude_code 或 codex' }, { status: 400 })
  }
  if (hasLegacyRuntimeTag(capabilities)) {
    return NextResponse.json({ error: 'capabilities 不能包含 runtime:* 旧标签，请使用 runtime_type' }, { status: 400 })
  }

  // 验证 workspace 归属
  const { data: ws } = await db
    .from('workspaces')
    .select('id')
    .eq('id', workspace_id)
    .eq('owner_id', user.id)
    .single()

  if (!ws) return NextResponse.json({ error: '工作区不存在或无权限' }, { status: 403 })

  const { data, error } = await db
    .from('role_agents')
    .insert({
      workspace_id,
      name,
      role_type: role_type || 'engineer',
      system_prompt: system_prompt || '',
      capabilities: capabilities || [],
      runtime_type: runtime_type || 'claude_code',
      is_orchestrator: is_orchestrator || false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
