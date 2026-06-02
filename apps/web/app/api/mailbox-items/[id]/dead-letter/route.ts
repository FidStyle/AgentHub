import { NextResponse } from 'next/server'
import { createClient } from '@/lib/app-db-client'
import { requireAuth } from '@/lib/auth-guard'
import { deadLetterMailboxItem } from '@/lib/orchestrator/mailbox-control'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const db = await createClient()
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const body = await request.json().catch(() => ({}))
  const result = await deadLetterMailboxItem({
    db,
    mailboxItemId: id,
    userId: user.id,
    body: body && typeof body === 'object' ? body as Record<string, unknown> : {},
  })

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json(result.data)
}
