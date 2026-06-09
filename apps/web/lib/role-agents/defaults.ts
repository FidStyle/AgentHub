import { createClient } from '@/lib/app-db-client'
import { DEFAULT_ROLE_AGENTS } from '@/config/role-agents/schema'

export { DEFAULT_ROLE_AGENTS }

type DbClient = Awaited<ReturnType<typeof createClient>>

type ExistingRole = {
  name: string
}

export async function ensureDefaultRoleAgents(
  db: DbClient,
  workspaceId: string,
  existing?: ExistingRole[],
) {
  const rows = existing ?? await loadExistingRoleNames(db, workspaceId)
  const existingNames = new Set(rows.map((row) => row.name))
  const missing = DEFAULT_ROLE_AGENTS
    .filter((role) => !existingNames.has(role.name))
    .map((role) => ({ workspace_id: workspaceId, ...role }))

  if (missing.length === 0) return { data: [], error: null }
  return db.from('role_agents').insert(missing).select()
}

async function loadExistingRoleNames(db: DbClient, workspaceId: string) {
  const { data, error } = await db
    .from('role_agents')
    .select('name')
    .eq('workspace_id', workspaceId)

  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as ExistingRole[]
}
