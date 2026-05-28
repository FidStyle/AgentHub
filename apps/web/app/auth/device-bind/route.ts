import { auth } from '@/auth'
import { createClient } from '@/lib/app-db-client'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  if (!code) return NextResponse.json({ error: '缺少 code' }, { status: 400 })

  const session = await auth()
  if (!session?.user?.id) {
    const callbackUrl = `/auth/device-bind?code=${code}`
    return NextResponse.redirect(
      new URL(`/api/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`, request.url)
    )
  }

  const db = await createClient()
  const { error } = await db
    .from('device_login_intents')
    .update({ user_id: session.user.id, bound_at: new Date().toISOString() })
    .eq('code', code)
    .gt('expires_at', new Date().toISOString())
    .is('user_id', null)

  if (error) return NextResponse.json({ error: '绑定失败' }, { status: 500 })

  return NextResponse.redirect(new URL(`agenthub://auth/bind?code=${code}`, request.url))
}
