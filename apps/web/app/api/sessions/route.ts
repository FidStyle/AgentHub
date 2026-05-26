import { createClient } from '@/lib/supabase-server'
import { requireAuth } from '@/lib/auth-guard'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

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
    .from('sessions')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const body = await request.json()
  const { workspace_id, name } = body

  if (!workspace_id) return NextResponse.json({ error: '缺少 workspace_id' }, { status: 400 })

  // 验证 workspace 归属
  const { data: ws } = await supabase
    .from('workspaces')
    .select('id')
    .eq('id', workspace_id)
    .eq('owner_id', user.id)
    .single()

  if (!ws) return NextResponse.json({ error: '工作区不存在或无权限' }, { status: 403 })

  const { data, error } = await supabase
    .from('sessions')
    .insert({ workspace_id, name: name || '新会话' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
