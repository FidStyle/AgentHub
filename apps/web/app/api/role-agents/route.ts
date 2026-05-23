import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

// GET: list all role agents for a workspace
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '未授权' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const workspaceId = searchParams.get('workspace_id')
  if (!workspaceId) return NextResponse.json({ error: '缺少 workspace_id' }, { status: 400 })

  const { data: ws } = await supabase
    .from('workspaces')
    .select('id')
    .eq('id', workspaceId)
    .eq('owner_id', user.id)
    .single()
  if (!ws) return NextResponse.json({ error: '无权限' }, { status: 403 })

  const { data, error } = await supabase
    .from('role_agents')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST: create a new role agent
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '未授权' }, { status: 401 })

  const body = await request.json()
  const { workspace_id, name, role_type, system_prompt, capabilities, is_orchestrator } = body

  if (!workspace_id) return NextResponse.json({ error: '缺少 workspace_id' }, { status: 400 })
  if (!name) return NextResponse.json({ error: '缺少 name' }, { status: 400 })

  // 验证 workspace 归属
  const { data: ws } = await supabase
    .from('workspaces')
    .select('id')
    .eq('id', workspace_id)
    .eq('owner_id', user.id)
    .single()

  if (!ws) return NextResponse.json({ error: '工作区不存在或无权限' }, { status: 403 })

  const { data, error } = await supabase
    .from('role_agents')
    .insert({
      workspace_id,
      name,
      role_type: role_type || 'general',
      system_prompt: system_prompt || '',
      capabilities: capabilities || [],
      is_orchestrator: is_orchestrator || false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
