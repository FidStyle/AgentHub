import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '未授权' }, { status: 401 })

  const { data, error } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', id)
    .eq('owner_id', user.id)
    .single()

  if (error) return NextResponse.json({ error: '工作区不存在' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '未授权' }, { status: 401 })

  const body = await request.json()
  const { name, description } = body

  if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
    return NextResponse.json({ error: '名称不能为空' }, { status: 400 })
  }
  if (name && name.length > 200) {
    return NextResponse.json({ error: '名称不能超过 200 字符' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('workspaces')
    .update({ name, description, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('owner_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
