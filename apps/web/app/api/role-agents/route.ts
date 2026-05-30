import { createClient } from '@/lib/app-db-client'
import { requireAuth } from '@/lib/auth-guard'
import { NextResponse } from 'next/server'

// Default 架构师 role seeded into any workspace that has no role agents yet, so chat always
// has at least one mentionable orchestrator role without requiring a schema migration.
const DEFAULT_ARCHITECT = {
  name: '架构师',
  role_type: 'orchestrator',
  system_prompt:
    '你是一名资深软件架构师。你负责理解需求、拆解系统、评估技术权衡，并给出清晰、可落地的架构方案与实现指引。回答使用简体中文。',
  capabilities: ['architecture', 'planning', 'review'],
  is_orchestrator: true,
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

  if (!data || data.length === 0) {
    const { data: seeded, error: seedError } = await db
      .from('role_agents')
      .insert({ workspace_id: workspaceId, ...DEFAULT_ARCHITECT })
      .select()
      .single()
    if (seedError) return NextResponse.json({ error: seedError.message }, { status: 500 })
    return NextResponse.json([seeded])
  }

  return NextResponse.json(data)
}

// POST: create a new role agent
export async function POST(request: Request) {
  const db = await createClient()
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const body = await request.json()
  const { workspace_id, name, role_type, system_prompt, capabilities, is_orchestrator } = body

  if (!workspace_id) return NextResponse.json({ error: '缺少 workspace_id' }, { status: 400 })
  if (!name) return NextResponse.json({ error: '缺少 name' }, { status: 400 })

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
      is_orchestrator: is_orchestrator || false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
