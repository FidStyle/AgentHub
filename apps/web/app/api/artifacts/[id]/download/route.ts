import { createClient } from '@/lib/app-db-client'
import { requireAuth } from '@/lib/auth-guard'
import { NextResponse } from 'next/server'

function downloadName(title: string, type: string) {
  const ext = type === 'folder' ? 'json' : type === 'html' ? 'html' : type === 'markdown' ? 'md' : type === 'diff' ? 'patch' : 'txt'
  return `${title || 'artifact'}.${ext}`.replace(/["\r\n/\\]/g, '_')
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const db = await createClient()
  const { data: artifact } = await db.from('artifacts').select('*').eq('id', id).single()
  if (!artifact) return NextResponse.json({ error: '产物不存在' }, { status: 404 })
  const row = artifact as unknown as { workspace_id: string; title: string; artifact_type: string; content?: string | null; metadata?: Record<string, unknown> | null }
  const { data: workspace } = await db
    .from('workspaces')
    .select('id')
    .eq('id', row.workspace_id)
    .eq('owner_id', user.id)
    .single()
  if (!workspace) return NextResponse.json({ error: '产物不存在' }, { status: 404 })

  const body = row.artifact_type === 'folder'
    ? JSON.stringify(row.metadata?.manifest ?? {}, null, 2)
    : row.content ?? JSON.stringify(row.metadata ?? {}, null, 2)
  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="${downloadName(row.title, row.artifact_type)}"`,
    },
  })
}
