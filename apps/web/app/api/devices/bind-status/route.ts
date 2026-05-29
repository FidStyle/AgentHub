import { createClient } from '@/lib/app-db-client'
import { desktopCorsPreflight, withDesktopCors } from '@/lib/desktop-cors'
import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'

export async function OPTIONS(request: NextRequest) {
  return desktopCorsPreflight(request)
}

function createDeviceToken(code: string) {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || process.env.DATABASE_URL || 'agenthub-local-device-token'
  return createHash('sha256').update(`desktop-login-intent:${secret}:${code}`).digest('hex')
}

async function getOrCreateDesktopDevice(db: Awaited<ReturnType<typeof createClient>>, userId: string, code: string) {
  const deviceToken = createDeviceToken(code)
  const existing = await db
    .from('devices')
    .select('id, name, type, online, device_token, created_at')
    .eq('device_token', deviceToken)
    .single()

  if (existing.data) return existing

  return db
    .from('devices')
    .insert({
      user_id: userId,
      name: '当前桌面设备',
      type: 'desktop',
      device_token: deviceToken,
    })
    .select('id, name, type, online, device_token, created_at')
    .single()
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  if (!code) return withDesktopCors(request, NextResponse.json({ error: '缺少 code' }, { status: 400 }))

  try {
    const db = await createClient()
    const { data: intent, error } = await db
      .from('device_login_intents')
      .select('user_id, expires_at')
      .eq('code', code)
      .single()

    if (error || !intent) return withDesktopCors(request, NextResponse.json({ error: '未找到' }, { status: 404 }))
    if (new Date(intent.expires_at) < new Date()) return withDesktopCors(request, NextResponse.json({ error: '已过期' }, { status: 404 }))

    if (intent.user_id) {
      const { data: user } = await db
        .from('user')
        .select('id, name, email, image')
        .eq('id', intent.user_id)
        .single()

      const { data: device, error: deviceError } = await getOrCreateDesktopDevice(db, intent.user_id, code)
      if (deviceError || !device) {
        return withDesktopCors(request, NextResponse.json({ error: deviceError?.message || '创建设备失败' }, { status: 500 }))
      }

      return withDesktopCors(request, NextResponse.json({ bound: true, user, device }))
    }

    return withDesktopCors(request, NextResponse.json({ bound: false }))
  } catch (error) {
    const message = error instanceof Error ? error.message : '查询绑定状态失败'
    return withDesktopCors(request, NextResponse.json({ error: message }, { status: 500 }))
  }
}
