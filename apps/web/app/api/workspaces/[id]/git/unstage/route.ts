import { createClient } from '@/lib/app-db-client'
import { requireAuth } from '@/lib/auth-guard'
import { readWorkspaceGitStatus, unstageWorkspaceGitPath } from '@/lib/workspace/cloud-workspace-fs'
import { loadCloudWorkspaceRoot, loadOwnedWorkspace } from '@/lib/workspace/workspace-api'
import { NextResponse } from 'next/server'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const body = await request.json().catch(() => ({}))
  const filePath = typeof body.path === 'string' ? body.path : ''
  if (!filePath) return NextResponse.json({ error: 'path 必填' }, { status: 400 })

  const db = await createClient()
  const owned = await loadOwnedWorkspace(db, id, user)
  if (!owned.ok) return NextResponse.json({ error: owned.error }, { status: owned.status })
  const cloud = await loadCloudWorkspaceRoot(db, owned.workspace, user)
  if (!cloud.ok) return NextResponse.json({ error: cloud.error }, { status: cloud.status })

  try {
    await unstageWorkspaceGitPath(cloud.root, filePath)
    return NextResponse.json({ ok: true, changes: await readWorkspaceGitStatus(cloud.root) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '取消暂存失败' }, { status: 400 })
  }
}
