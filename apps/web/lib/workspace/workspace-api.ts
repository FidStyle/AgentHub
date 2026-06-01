import { createClient } from '@/lib/app-db-client'
import type { AppDbClient } from '@/lib/postgres-query-client'
import {
  cloudWorkspaceDir,
  ensureCloudWorkspaceProject,
  type CloudWorkspaceOwner,
  type CloudWorkspaceRow,
} from './cloud-workspace-fs'

export type OwnedWorkspace = {
  id: string
  name: string
  execution_domain: 'cloud' | 'local_desktop'
  cloud_project_dir?: string | null
}

export async function loadOwnedWorkspace(
  db: AppDbClient,
  workspaceId: string,
  user: { id: string; email?: string | null; name?: string | null },
) {
  const { data: workspace } = await db
    .from('workspaces')
    .select('id, name, execution_domain, cloud_project_dir')
    .eq('id', workspaceId)
    .eq('owner_id', user.id)
    .single()

  if (!workspace) return { ok: false as const, status: 404, error: '工作区不存在' }
  return { ok: true as const, workspace: workspace as unknown as OwnedWorkspace }
}

export async function loadCloudWorkspaceRoot(
  db: Awaited<ReturnType<typeof createClient>>,
  workspace: OwnedWorkspace,
  user: { id: string; email?: string | null; name?: string | null },
) {
  if (workspace.execution_domain !== 'cloud') {
    return { ok: false as const, status: 409, error: '文件预览仅支持云端工作区；本地工作区文件必须通过 Desktop Connector 读取' }
  }

  const { data: profile } = await db
    .from('profiles')
    .select('github_username, display_name')
    .eq('id', user.id)
    .single()

  const owner: CloudWorkspaceOwner = {
    id: user.id,
    email: user.email,
    name: (profile as { display_name?: string | null } | null)?.display_name ?? user.name,
    githubUsername: (profile as { github_username?: string | null } | null)?.github_username,
  }
  const row = workspace as CloudWorkspaceRow
  const root = row.cloud_project_dir ?? await ensureCloudWorkspaceProject(owner, row)
  if (!row.cloud_project_dir) {
    await db.from('workspaces').update({ cloud_project_dir: root, updated_at: new Date().toISOString() }).eq('id', row.id)
  }

  return {
    ok: true as const,
    owner,
    root,
    rootDisplay: cloudWorkspaceDir(owner, { ...row, cloud_project_dir: root }),
  }
}
