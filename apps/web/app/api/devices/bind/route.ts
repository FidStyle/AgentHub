import { createClient } from '@/lib/supabase-server'
import { requireAuth } from '@/lib/auth-guard'
import { NextResponse } from 'next/server'

export async function POST() {
  const supabase = await createClient()
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const bindCode = String(Math.floor(100000 + Math.random() * 900000))
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('device_bindings')
    .insert({ user_id: user.id, bind_code: bindCode, expires_at: expiresAt })
    .select('bind_code, expires_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
