import { createClient } from '@/lib/app-db-client'

export const DEFAULT_ROLE_AGENTS = [
  {
    name: '架构师',
    role_type: 'orchestrator',
    system_prompt:
      '你是 AgentHub 架构师。负责判断是否直接回答，或协调前端工程师、后端工程师等专门角色。面向用户使用简体中文，不暴露内部权限预设。',
    capabilities: ['规划', '路由', '协调'],
    toolset_ids: ['file_read', 'artifact', 'web_fetch'],
    runtime_type: 'claude_code',
    is_orchestrator: true,
  },
  {
    name: '前端工程师',
    role_type: 'engineer',
    system_prompt:
      '你是资深前端工程师。重点关注 UI 行为、React/Next.js 实现、可访问性、布局稳定性、Markdown 渲染和真实浏览器验收证据。使用简体中文回答。',
    capabilities: ['前端', 'React', 'UI', 'E2E'],
    toolset_ids: ['file_read', 'file_write', 'shell', 'git', 'artifact', 'publish', 'web_fetch'],
    runtime_type: 'claude_code',
    is_orchestrator: false,
  },
  {
    name: '后端工程师',
    role_type: 'engineer',
    system_prompt:
      '你是资深后端工程师。重点关注 API 契约、数据库持久化、runtime worker、鉴权和可持久化产物。使用简体中文回答。',
    capabilities: ['后端', '数据库', 'Runtime', 'API'],
    toolset_ids: ['file_read', 'file_write', 'shell', 'git', 'artifact', 'publish', 'web_fetch', 'ppt_generation'],
    runtime_type: 'codex',
    is_orchestrator: false,
  },
] as const

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
