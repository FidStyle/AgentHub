import { createClient } from '@/lib/supabase-server'
import { requireAuth } from '@/lib/auth-guard'
import { NextResponse } from 'next/server'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const { id } = await params

  const { error } = await supabase
    .from('devices')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
