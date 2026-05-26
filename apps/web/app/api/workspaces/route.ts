import { createClient } from '@/lib/supabase-server'
import { requireAuth } from '@/lib/auth-guard'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const { data, error } = await supabase
    .from('workspaces')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const body = await request.json()
  const { name, execution_domain, description } = body

  if (!name || !execution_domain) {
    return NextResponse.json({ error: '名称和执行域为必填项' }, { status: 400 })
  }

  if (!['cloud', 'local_desktop'].includes(execution_domain)) {
    return NextResponse.json({ error: '执行域必须为 cloud 或 local_desktop' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('workspaces')
    .insert({ owner_id: user.id, name, execution_domain, description: description || '' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
