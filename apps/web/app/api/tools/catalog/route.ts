import { requireAuth } from '@/lib/auth-guard'
import { ROLE_AGENT_TOOL_CATALOG } from '@/lib/role-agents/tools'
import { NextResponse } from 'next/server'

export async function GET() {
  const { error: authError } = await requireAuth()
  if (authError) return authError
  return NextResponse.json({ tools: ROLE_AGENT_TOOL_CATALOG })
}
