import { createClient } from '@/lib/app-db-client'
import { requireAuth } from '@/lib/auth-guard'
import { readWorkspaceGitCommitDiff } from '@/lib/workspace/cloud-workspace-fs'
import { loadCloudWorkspaceRoot, loadOwnedWorkspace } from '@/lib/workspace/workspace-api'
import { NextResponse } from 'next/server'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const hash = new URL(request.url).searchParams.get('hash') ?? ''
  if (!hash.trim()) return NextResponse.json({ error: 'hash 必填' }, { status: 400 })

  const db = await createClient()
  const owned = await loadOwnedWorkspace(db, id, user)
  if (!owned.ok) return NextResponse.json({ error: owned.error }, { status: owned.status })
  const cloud = await loadCloudWorkspaceRoot(db, owned.workspace, user)
  if (!cloud.ok) return NextResponse.json({ error: cloud.error }, { status: cloud.status })

  try {
    return NextResponse.json({ commit: await readWorkspaceGitCommitDiff(cloud.root, hash) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '读取 commit diff 失败' }, { status: 400 })
  }
}
