import { createClient } from '@/lib/app-db-client'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  if (!code) return NextResponse.json({ error: '缺少 code' }, { status: 400 })

  const db = await createClient()
  const { data: intent, error } = await db
    .from('device_login_intents')
    .select('user_id, expires_at')
    .eq('code', code)
    .single()

  if (error || !intent) return NextResponse.json({ error: '未找到' }, { status: 404 })
  if (new Date(intent.expires_at) < new Date()) return NextResponse.json({ error: '已过期' }, { status: 404 })

  if (intent.user_id) {
    const { data: user } = await db
      .from('user')
      .select('id, name, email, image')
      .eq('id', intent.user_id)
      .single()
    return NextResponse.json({ bound: true, user })
  }

  return NextResponse.json({ bound: false })
}
