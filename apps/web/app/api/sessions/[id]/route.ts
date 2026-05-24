import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '未授权' }, { status: 401 })

  const { data, error } = await supabase
    .from('sessions')
    .select('*, workspaces!inner(owner_id)')
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: '会话不存在' }, { status: 404 })
  const row = data as { workspaces?: { owner_id: string } }
  if (row.workspaces?.owner_id !== user.id) {
    return NextResponse.json({ error: '无权限' }, { status: 403 })
  }

  return NextResponse.json(data)
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '未授权' }, { status: 401 })

  const body = await request.json()
  const { name, status } = body

  if (status && !['active', 'archived'].includes(status)) {
    return NextResponse.json({ error: '无效的会话状态' }, { status: 400 })
  }

  const { data: session } = await supabase
    .from('sessions')
    .select('workspace_id')
    .eq('id', id)
    .single()
  if (!session) return NextResponse.json({ error: '会话不存在' }, { status: 404 })

  const { data: ws } = await supabase
    .from('workspaces')
    .select('id')
    .eq('id', session.workspace_id)
    .eq('owner_id', user.id)
    .single()
  if (!ws) return NextResponse.json({ error: '无权限' }, { status: 403 })

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (name) update.name = name
  if (status) update.status = status

  const { data, error } = await supabase
    .from('sessions')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
