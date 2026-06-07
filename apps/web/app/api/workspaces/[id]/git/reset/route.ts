import { createClient } from '@/lib/app-db-client'
import { requireAuth } from '@/lib/auth-guard'
import { readWorkspaceGitHistory, readWorkspaceGitStatus, resetWorkspaceGitHard } from '@/lib/workspace/cloud-workspace-fs'
import { loadCloudWorkspaceRoot, loadOwnedWorkspace } from '@/lib/workspace/workspace-api'
import { NextResponse } from 'next/server'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const body = await request.json().catch(() => ({}))
  const hash = typeof body.hash === 'string' ? body.hash : ''
  if (!hash.trim()) return NextResponse.json({ error: 'hash 必填' }, { status: 400 })
  if (body.confirm !== true) return NextResponse.json({ error: 'reset hard 需要确认不可恢复风险' }, { status: 400 })

  const db = await createClient()
  const owned = await loadOwnedWorkspace(db, id, user)
  if (!owned.ok) return NextResponse.json({ error: owned.error }, { status: owned.status })
  const cloud = await loadCloudWorkspaceRoot(db, owned.workspace, user)
  if (!cloud.ok) return NextResponse.json({ error: cloud.error }, { status: cloud.status })

  try {
    const output = await resetWorkspaceGitHard(cloud.root, hash)
    return NextResponse.json({
      ok: true,
      output,
      changes: await readWorkspaceGitStatus(cloud.root),
      commits: await readWorkspaceGitHistory(cloud.root, 8),
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Git reset --hard 失败' }, { status: 400 })
  }
}
