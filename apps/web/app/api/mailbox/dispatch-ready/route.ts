import { NextResponse } from 'next/server'
import { createClient } from '@/lib/app-db-client'
import { requireAuth } from '@/lib/auth-guard'
import { dispatchReadyMailboxItems } from '@/lib/orchestrator/mailbox-control'

export async function POST(request: Request) {
  const db = await createClient()
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const body = await request.json().catch(() => ({}))
  const sessionId = body && typeof body === 'object'
    ? (body as Record<string, unknown>).session_id
    : null
  if (typeof sessionId !== 'string' || sessionId.trim().length === 0) {
    return NextResponse.json({ error: 'session_id 必填' }, { status: 400 })
  }

  const result = await dispatchReadyMailboxItems({
    db,
    sessionId,
    userId: user.id,
  })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json(result.data)
}
