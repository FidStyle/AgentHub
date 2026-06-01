import { createClient } from '@/lib/app-db-client'
import { requireAuth } from '@/lib/auth-guard'
import { readCloudWorkspacePreview } from '@/lib/workspace/cloud-workspace-fs'
import { loadCloudWorkspaceRoot, loadOwnedWorkspace } from '@/lib/workspace/workspace-api'
import { NextResponse } from 'next/server'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const filePath = new URL(request.url).searchParams.get('path')
  if (!filePath) return NextResponse.json({ error: '缺少 path' }, { status: 400 })

  const db = await createClient()
  const owned = await loadOwnedWorkspace(db, id, user)
  if (!owned.ok) return NextResponse.json({ error: owned.error }, { status: owned.status })
  const cloud = await loadCloudWorkspaceRoot(db, owned.workspace, user)
  if (!cloud.ok) return NextResponse.json({ error: cloud.error }, { status: cloud.status })

  try {
    const preview = await readCloudWorkspacePreview(cloud.root, filePath)
    return NextResponse.json({
      ...preview,
      downloadUrl: `/api/workspaces/${id}/files/download?path=${encodeURIComponent(preview.path)}`,
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '读取文件失败' }, { status: 400 })
  }
}
