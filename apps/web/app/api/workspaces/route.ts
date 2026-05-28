import { createClient } from '@/lib/supabase-server'
import { requireAuth } from '@/lib/auth-guard'
import { NextResponse } from 'next/server'

const localWorkspaces = [
  {
    id: 'local-demo-workspace',
    name: '本地示例工作区',
    description: '当前未配置数据库，先使用本地示例数据验证登录和工作台流程。',
    execution_domain: 'local_desktop',
    created_at: new Date(0).toISOString(),
  },
]

function hasWorkspaceDatabase() {
  return Boolean(process.env.DATABASE_URL || (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY))
}

export async function GET() {
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  if (!hasWorkspaceDatabase()) {
    return NextResponse.json(localWorkspaces)
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('workspaces')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
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

  if (!hasWorkspaceDatabase()) {
    return NextResponse.json({
      id: `local-${Date.now()}`,
      name,
      description: description || '',
      execution_domain,
      created_at: new Date().toISOString(),
    }, { status: 201 })
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('workspaces')
    .insert({ owner_id: user.id, name, execution_domain, description: description || '' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
