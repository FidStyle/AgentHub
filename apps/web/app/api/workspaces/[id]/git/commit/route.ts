import { createClient } from '@/lib/app-db-client'
import { requireAuth } from '@/lib/auth-guard'
import { commitWorkspaceGit, readWorkspaceGitHistory, readWorkspaceGitStatus } from '@/lib/workspace/cloud-workspace-fs'
import { loadCloudWorkspaceRoot, loadOwnedWorkspace } from '@/lib/workspace/workspace-api'
import { NextResponse } from 'next/server'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const body = await request.json().catch(() => ({}))
  const message = typeof body.message === 'string' ? body.message : ''
  if (!message.trim()) return NextResponse.json({ error: 'message 必填' }, { status: 400 })

  const db = await createClient()
  const owned = await loadOwnedWorkspace(db, id, user)
  if (!owned.ok) return NextResponse.json({ error: owned.error }, { status: owned.status })
  const cloud = await loadCloudWorkspaceRoot(db, owned.workspace, user)
  if (!cloud.ok) return NextResponse.json({ error: cloud.error }, { status: cloud.status })

  try {
    await commitWorkspaceGit(cloud.root, message)
    return NextResponse.json({
      ok: true,
      changes: await readWorkspaceGitStatus(cloud.root),
      commits: await readWorkspaceGitHistory(cloud.root, 8),
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Git commit 失败' }, { status: 400 })
  }
}
