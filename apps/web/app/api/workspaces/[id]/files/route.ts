import { createClient } from '@/lib/app-db-client'
import { requireAuth } from '@/lib/auth-guard'
import { cloudWorkspaceDir, ensureCloudWorkspaceProject, readCloudWorkspaceTree } from '@/lib/workspace/cloud-workspace-fs'
import { NextResponse } from 'next/server'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, error: authError } = await requireAuth()
  if (authError) return authError

  const db = await createClient()
  const { data: workspace } = await db
    .from('workspaces')
    .select('id, name, execution_domain, cloud_project_dir')
    .eq('id', id)
    .eq('owner_id', user.id)
    .single()
  if (!workspace) return NextResponse.json({ error: '工作区不存在' }, { status: 404 })
  if ((workspace as { execution_domain?: string }).execution_domain !== 'cloud') {
    return NextResponse.json({ error: '文件树仅支持云端工作区；本地工作区文件由 Desktop Connector 管理' }, { status: 409 })
  }

  const { data: profile } = await db
    .from('profiles')
    .select('github_username, display_name')
    .eq('id', user.id)
    .single()
  const owner = {
    id: user.id,
    email: user.email,
    name: (profile as { display_name?: string | null } | null)?.display_name ?? user.name,
    githubUsername: (profile as { github_username?: string | null } | null)?.github_username,
  }
  const row = workspace as unknown as { id: string; name: string; cloud_project_dir?: string | null }
  const root = row.cloud_project_dir ?? await ensureCloudWorkspaceProject(owner, row)
  if (!row.cloud_project_dir) {
    await db.from('workspaces').update({ cloud_project_dir: root, updated_at: new Date().toISOString() }).eq('id', row.id)
  }

  return NextResponse.json({
    root: cloudWorkspaceDir(owner, { ...row, cloud_project_dir: root }),
    tree: await readCloudWorkspaceTree(root),
  })
}
