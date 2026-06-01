import { createClient } from '@/lib/app-db-client'
import { requireAuth } from '@/lib/auth-guard'
import { NextResponse } from 'next/server'

async function loadArtifact(db: Awaited<ReturnType<typeof createClient>>, artifactId: string, userId: string) {
  const { data: artifact } = await db
    .from('artifacts')
    .select('*')
    .eq('id', artifactId)
    .single()
  if (!artifact) return null
  const workspaceId = (artifact as { workspace_id?: string }).workspace_id
  const { data: workspace } = await db
    .from('workspaces')
    .select('id')
    .eq('id', workspaceId)
    .eq('owner_id', userId)
    .single()
  return workspace ? artifact : null
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, error: authError } = await requireAuth()
  if (authError) return authError
  const db = await createClient()
  const artifact = await loadArtifact(db, id, user.id)
  if (!artifact) return NextResponse.json({ error: '产物不存在' }, { status: 404 })
  return NextResponse.json(artifact)
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, error: authError } = await requireAuth()
  if (authError) return authError
  const db = await createClient()
  const artifact = await loadArtifact(db, id, user.id)
  if (!artifact) return NextResponse.json({ error: '产物不存在' }, { status: 404 })
  const body = await request.json()
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  if (!title) return NextResponse.json({ error: '产物名称不能为空' }, { status: 400 })
  const { data, error } = await db
    .from('artifacts')
    .update({ title, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, error: authError } = await requireAuth()
  if (authError) return authError
  const db = await createClient()
  const artifact = await loadArtifact(db, id, user.id)
  if (!artifact) return NextResponse.json({ error: '产物不存在' }, { status: 404 })
  const { error } = await db.from('artifacts').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
