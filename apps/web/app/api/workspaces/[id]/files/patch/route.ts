import { createClient } from '@/lib/app-db-client'
import { requireAuth } from '@/lib/auth-guard'
import { applyWorkspaceSelectionPatch, createWorkspaceSelectionPatchDraft, readCloudWorkspacePreview, readWorkspaceGitStatus } from '@/lib/workspace/cloud-workspace-fs'
import { loadCloudWorkspaceRoot, loadOwnedWorkspace } from '@/lib/workspace/workspace-api'
import { NextResponse } from 'next/server'

function intValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : null
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const body = await request.json().catch(() => ({}))
  const filePath = typeof body.path === 'string' ? body.path : ''
  const selectionStart = intValue(body.selectionStart)
  const selectionEnd = intValue(body.selectionEnd)
  const replacement = typeof body.replacement === 'string' ? body.replacement : ''
  const expectedText = typeof body.expectedText === 'string' ? body.expectedText : ''
  const apply = body.apply === true
  if (!filePath) return NextResponse.json({ error: 'path 必填' }, { status: 400 })
  if (selectionStart === null || selectionEnd === null) return NextResponse.json({ error: '选区范围必填' }, { status: 400 })

  const db = await createClient()
  const owned = await loadOwnedWorkspace(db, id, user)
  if (!owned.ok) return NextResponse.json({ error: owned.error }, { status: owned.status })
  const cloud = await loadCloudWorkspaceRoot(db, owned.workspace, user)
  if (!cloud.ok) return NextResponse.json({ error: cloud.error }, { status: cloud.status })

  try {
    if (!apply) {
      const draft = await createWorkspaceSelectionPatchDraft(cloud.root, filePath, selectionStart, selectionEnd, replacement)
      return NextResponse.json({ draft })
    }
    const draft = await applyWorkspaceSelectionPatch(cloud.root, filePath, selectionStart, selectionEnd, expectedText, replacement)
    const preview = await readCloudWorkspacePreview(cloud.root, draft.path)
    return NextResponse.json({
      ok: true,
      draft,
      preview: {
        ...preview,
        downloadUrl: `/api/workspaces/${id}/files/download?path=${encodeURIComponent(preview.path)}`,
      },
      changes: await readWorkspaceGitStatus(cloud.root),
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '生成编辑草案失败' }, { status: 400 })
  }
}
