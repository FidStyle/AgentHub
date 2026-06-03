import { createClient } from '@/lib/app-db-client'
import { ARTIFACT_TYPES, defaultDocumentContent, defaultPresentationDeck, parsePresentationDeck, serializePresentationDeck } from '@/lib/artifacts/rich-artifacts'
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
  const patch: Record<string, unknown> = { title, updated_at: new Date().toISOString() }
  const current = artifact as unknown as {
    title: string
    artifact_type: string
    content?: string | null
    metadata?: Record<string, unknown> | null
  }

  const nextType = typeof body.artifact_type === 'string' && ARTIFACT_TYPES.has(body.artifact_type as never)
    ? body.artifact_type
    : current.artifact_type
  patch.artifact_type = nextType

  if ('content' in body) {
    if (typeof body.content !== 'string') return NextResponse.json({ error: '产物内容必须是文本' }, { status: 400 })
    patch.content = nextType === 'presentation'
      ? serializePresentationDeck(parsePresentationDeck(body.content, title))
      : body.content
  } else if (nextType === 'document' && !current.content) {
    patch.content = defaultDocumentContent(title)
  } else if (nextType === 'presentation' && !current.content) {
    patch.content = serializePresentationDeck(defaultPresentationDeck(title))
  }

  const metadata = current.metadata && typeof current.metadata === 'object' ? { ...current.metadata } : {}
  if (body.edit_request && typeof body.edit_request === 'object') {
    const requestBody = body.edit_request as Record<string, unknown>
    const instruction = typeof requestBody.instruction === 'string' ? requestBody.instruction.trim() : ''
    if (!instruction) return NextResponse.json({ error: '修改要求不能为空' }, { status: 400 })
    const history = Array.isArray(metadata.editRequests) ? metadata.editRequests : []
    metadata.editRequests = [
      ...history,
      {
        instruction,
        selection: typeof requestBody.selection === 'string' ? requestBody.selection : null,
        createdAt: new Date().toISOString(),
      },
    ]
  }
  if (body.metadata && typeof body.metadata === 'object') {
    Object.assign(metadata, body.metadata as Record<string, unknown>)
  }
  patch.metadata = metadata

  const { data, error } = await db
    .from('artifacts')
    .update(patch)
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
