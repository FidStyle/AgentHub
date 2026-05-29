import { createClient } from '@/lib/app-db-client'
import { desktopCorsPreflight, withDesktopCors } from '@/lib/desktop-cors'
import { NextRequest, NextResponse } from 'next/server'

export async function OPTIONS(request: NextRequest) {
  return desktopCorsPreflight(request)
}

export async function POST(request: NextRequest) {
  try {
    const db = await createClient()
    const code = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

    const { error } = await db
      .from('device_login_intents')
      .insert({ code, user_id: null, expires_at: expiresAt })

    if (error) return withDesktopCors(request, NextResponse.json({ error: error.message }, { status: 500 }))

    const baseUrl = process.env.NEXTAUTH_URL || process.env.APP_BASE_URL || 'http://localhost:3000'
    const signInUrl = `${baseUrl}/api/auth/signin?callbackUrl=${encodeURIComponent(`/auth/device-bind?code=${code}`)}`

    return withDesktopCors(request, NextResponse.json({ code, expires_at: expiresAt, sign_in_url: signInUrl }))
  } catch (error) {
    const message = error instanceof Error ? error.message : '创建登录请求失败'
    return withDesktopCors(request, NextResponse.json({ error: message }, { status: 500 }))
  }
}
