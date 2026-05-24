import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { sendRuntimeInvoke } from '@/lib/device-gateway-client'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '未授权' }, { status: 401 })

  const body = await request.json()
  const { workspace_id, prompt, cwd } = body

  if (!workspace_id || !prompt) {
    return NextResponse.json({ error: 'workspace_id 和 prompt 为必填项' }, { status: 400 })
  }

  // 检查 workspace 执行域
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('execution_domain')
    .eq('id', workspace_id)
    .eq('owner_id', user.id)
    .single()

  if (!workspace) {
    return NextResponse.json({ error: '工作区不存在' }, { status: 404 })
  }

  if (workspace.execution_domain !== 'local_desktop') {
    return NextResponse.json({ error: '此 API 仅支持本地桌面工作区' }, { status: 400 })
  }

  const sessionId = `rs-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  const result = sendRuntimeInvoke(user.id, {
    sessionId,
    command: 'claude',
    args: ['-p', prompt],
    cwd: cwd || '.',
  })

  if (!result.sent) {
    return NextResponse.json({ error: result.error || '设备未连接' }, { status: 503 })
  }

  return NextResponse.json({ sessionId, status: 'invoked' })
}
