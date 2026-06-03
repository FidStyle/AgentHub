import { createClient } from '@/lib/app-db-client'
import { ARTIFACT_TYPES, artifactTypeForPath, defaultDocumentContent, defaultPresentationDeck, serializePresentationDeck } from '@/lib/artifacts/rich-artifacts'
import { requireAuth } from '@/lib/auth-guard'
import { buildWorkspaceFolderManifest, previewKindForPath, readCloudWorkspacePreview } from '@/lib/workspace/cloud-workspace-fs'
import { loadCloudWorkspaceRoot, loadOwnedWorkspace } from '@/lib/workspace/workspace-api'
import { NextResponse } from 'next/server'

function normalizeArtifactType(value: unknown, sourcePath?: string, isFolder = false) {
  if (typeof value === 'string' && ARTIFACT_TYPES.has(value as never)) return value
  if (isFolder) return 'folder'
  if (!sourcePath) return 'generic_file'
  const richType = artifactTypeForPath(sourcePath)
  if (richType) return richType
  const kind = previewKindForPath(sourcePath)
  if (kind === 'html' || kind === 'markdown' || kind === 'code' || kind === 'image' || kind === 'folder') return kind
  return 'generic_file'
}

async function assertSessionInWorkspace(db: Awaited<ReturnType<typeof createClient>>, sessionId: string | null, workspaceId: string) {
  if (!sessionId) return true
  const { data: session } = await db
    .from('sessions')
    .select('id, workspace_id')
    .eq('id', sessionId)
    .single()
  return Boolean(session && (session as { workspace_id?: string }).workspace_id === workspaceId)
}

export async function GET(request: Request) {
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const params = new URL(request.url).searchParams
  const workspaceId = params.get('workspace_id')
  const sessionId = params.get('session_id')
  if (!workspaceId) return NextResponse.json({ error: '缺少 workspace_id' }, { status: 400 })

  const db = await createClient()
  const owned = await loadOwnedWorkspace(db, workspaceId, user)
  if (!owned.ok) return NextResponse.json({ error: owned.error }, { status: owned.status })
  if (!(await assertSessionInWorkspace(db, sessionId, workspaceId))) {
    return NextResponse.json({ error: '会话不存在或不属于当前工作区' }, { status: 403 })
  }

  let query = db
    .from('artifacts')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
  if (sessionId) query = query.eq('session_id', sessionId)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(Array.isArray(data) ? data : [])
}

export async function POST(request: Request) {
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const body = await request.json()
  const workspaceId = typeof body.workspace_id === 'string' ? body.workspace_id : ''
  const sessionId = typeof body.session_id === 'string' && body.session_id ? body.session_id : null
  const sourcePath = typeof body.source_path === 'string' && body.source_path ? body.source_path : null
  if (!workspaceId) return NextResponse.json({ error: '缺少 workspace_id' }, { status: 400 })

  const db = await createClient()
  const owned = await loadOwnedWorkspace(db, workspaceId, user)
  if (!owned.ok) return NextResponse.json({ error: owned.error }, { status: owned.status })
  if (!(await assertSessionInWorkspace(db, sessionId, workspaceId))) {
    return NextResponse.json({ error: '会话不存在或不属于当前工作区' }, { status: 403 })
  }

  let title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : '未命名产物'
  let content = typeof body.content === 'string' ? body.content : null
  let metadata = body.metadata && typeof body.metadata === 'object' ? body.metadata as Record<string, unknown> : {}
  let contentRef = typeof body.content_ref === 'string' ? body.content_ref : null
  let isFolder = false

  if (sourcePath) {
    const cloud = await loadCloudWorkspaceRoot(db, owned.workspace, user)
    if (!cloud.ok) return NextResponse.json({ error: cloud.error }, { status: cloud.status })
    try {
      const preview = await readCloudWorkspacePreview(cloud.root, sourcePath)
      isFolder = preview.type === 'directory'
      title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : preview.name
      content = preview.content
      contentRef = `workspace-file:${workspaceId}:${preview.path}`
      metadata = {
        ...metadata,
        source: 'workspace_file',
        previewKind: preview.previewKind,
        mime: preview.mime,
        size: preview.size,
        truncated: preview.truncated,
        downloadUrl: `/api/workspaces/${workspaceId}/files/download?path=${encodeURIComponent(preview.path)}`,
        ...(isFolder ? { manifest: await buildWorkspaceFolderManifest(cloud.root, preview.path) } : {}),
      }
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : '读取产物来源失败' }, { status: 400 })
    }
  }

  const artifactType = normalizeArtifactType(body.artifact_type, sourcePath ?? undefined, isFolder)
  if (artifactType === 'document' && content === null) {
    content = defaultDocumentContent(title)
  }
  if (artifactType === 'presentation' && content === null) {
    content = serializePresentationDeck(defaultPresentationDeck(title))
  }
  const { data, error } = await db
    .from('artifacts')
    .insert({
      workspace_id: workspaceId,
      session_id: sessionId,
      source_message_id: typeof body.source_message_id === 'string' ? body.source_message_id : null,
      source_run_id: typeof body.source_run_id === 'string' ? body.source_run_id : null,
      source_path: sourcePath,
      artifact_type: artifactType,
      title,
      content,
      content_ref: contentRef,
      metadata,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
