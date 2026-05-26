import { auth } from '@/auth'
import { NextResponse } from 'next/server'

type AuthSuccess = { user: { id: string; name?: string | null; email?: string | null; image?: string | null }; error: null }
type AuthFailure = { user: null; error: NextResponse }

export async function requireAuth(): Promise<AuthSuccess | AuthFailure> {
  const session = await auth()
  if (!session?.user?.id) {
    return { user: null, error: NextResponse.json({ error: '未授权' }, { status: 401 }) }
  }
  return { user: session.user as AuthSuccess['user'], error: null }
}
