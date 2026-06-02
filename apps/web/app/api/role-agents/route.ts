import { createClient } from '@/lib/app-db-client'
import { requireAuth } from '@/lib/auth-guard'
import { NextResponse } from 'next/server'

const DEFAULT_ROLE_AGENTS = [
  {
    name: '架构师',
    role_type: 'orchestrator',
    system_prompt:
      '你是 AgentHub 架构师。负责判断是否直接回答，或协调前端工程师、后端工程师等专门角色。面向用户使用简体中文，不暴露内部权限预设。',
    capabilities: ['规划', '路由', '协调', 'runtime:claude_code'],
    is_orchestrator: true,
  },
  {
    name: '前端工程师',
    role_type: 'engineer',
    system_prompt:
      '你是资深前端工程师。重点关注 UI 行为、React/Next.js 实现、可访问性、布局稳定性、Markdown 渲染和真实浏览器验收证据。使用简体中文回答。',
    capabilities: ['前端', 'React', 'UI', 'E2E', 'runtime:claude_code'],
    is_orchestrator: false,
  },
  {
    name: '后端工程师',
    role_type: 'engineer',
    system_prompt:
      '你是资深后端工程师。重点关注 API 契约、数据库持久化、runtime worker、鉴权和可持久化产物。使用简体中文回答。',
    capabilities: ['后端', '数据库', 'Runtime', 'API', 'runtime:codex'],
    is_orchestrator: false,
  },
]

async function ensureDefaultRoleAgents(db: Awaited<ReturnType<typeof createClient>>, workspaceId: string, existing: Array<{ name: string }>) {
  const existingNames = new Set(existing.map((row) => row.name))
  const missing = DEFAULT_ROLE_AGENTS
    .filter((role) => !existingNames.has(role.name))
    .map((role) => ({ workspace_id: workspaceId, ...role }))
  if (missing.length === 0) return null
  return db.from('role_agents').insert(missing).select()
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
