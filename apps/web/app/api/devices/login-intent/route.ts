import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = await createClient()
  const code = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

  const { error } = await supabase
    .from('device_login_intents')
    .insert({ code, user_id: null, expires_at: expiresAt })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const baseUrl = process.env.NEXTAUTH_URL || process.env.APP_BASE_URL || 'http://localhost:3000'
  const signInUrl = `${baseUrl}/api/auth/signin?callbackUrl=${encodeURIComponent(`/auth/device-bind?code=${code}`)}`

  return NextResponse.json({ code, expires_at: expiresAt, sign_in_url: signInUrl })
}
