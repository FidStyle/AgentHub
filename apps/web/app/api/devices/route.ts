import { createClient } from '@/lib/supabase-server'
import { requireAuth } from '@/lib/auth-guard'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const { data, error } = await supabase
    .from('devices')
    .select('id, name, type, online, last_heartbeat, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const body = await request.json()
  const { bind_code, name } = body

  if (!bind_code) {
    return NextResponse.json({ error: '绑定码为必填项' }, { status: 400 })
  }

  const { data: binding, error: bindErr } = await supabase
    .from('device_bindings')
    .select('*')
    .eq('bind_code', bind_code)
    .eq('used', false)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (bindErr || !binding) {
    return NextResponse.json({ error: '绑定码无效或已过期' }, { status: 400 })
  }

  if (binding.user_id !== user.id) {
    return NextResponse.json({ error: '绑定码不属于当前用户' }, { status: 403 })
  }

  const { data: device, error: devErr } = await supabase
    .from('devices')
    .insert({ user_id: user.id, name: name || '桌面连接器' })
    .select('id, name, type, device_token, created_at')
    .single()

  if (devErr) return NextResponse.json({ error: devErr.message }, { status: 500 })

  await supabase
    .from('device_bindings')
    .update({ used: true, device_id: device.id })
    .eq('id', binding.id)

  return NextResponse.json(device, { status: 201 })
}
