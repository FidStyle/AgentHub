import { createClient } from '@/lib/app-db-client'
import { requireAuth } from '@/lib/auth-guard'
import { createRoleAgentDraft } from '@/lib/role-agents/draft'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const db = await createClient()
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const body = await request.json()
  const workspaceId = typeof body.workspace_id === 'string' ? body.workspace_id : ''
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
  if (!workspaceId) return NextResponse.json({ error: '缺少 workspace_id' }, { status: 400 })
  if (!prompt) return NextResponse.json({ error: '缺少 prompt' }, { status: 400 })

  const { data: ws } = await db
    .from('workspaces')
    .select('id')
    .eq('id', workspaceId)
    .eq('owner_id', user.id)
    .single()
  if (!ws) return NextResponse.json({ error: '无权限' }, { status: 403 })

  return NextResponse.json(createRoleAgentDraft(workspaceId, prompt))
}
