import type { AppDbClient } from '@/lib/postgres-query-client'
import type { RoleAgentToolsetId } from '@agenthub/shared'

export const ROLE_AGENT_TOOLSETS: readonly RoleAgentToolsetId[] = [
  'file_read',
  'file_write',
  'shell',
  'git',
  'artifact',
  'publish',
  'web_fetch',
  'ppt_generation',
] as const

export function isRoleAgentToolsetId(value: unknown): value is RoleAgentToolsetId {
  return typeof value === 'string' && (ROLE_AGENT_TOOLSETS as readonly string[]).includes(value)
}

export function normalizeRoleAgentToolsets(value: unknown): RoleAgentToolsetId[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter(isRoleAgentToolsetId))]
}

export const TOOLSET_LABELS: Record<RoleAgentToolsetId, string> = {
  file_read: '读取文件',
  file_write: '写入文件',
  shell: '执行命令',
  git: 'Git 操作',
  artifact: '产物读写',
  publish: '发布预览',
  web_fetch: '访问网页',
  ppt_generation: '生成演示稿',
}

export function validateToolsetIds(value: unknown) {
  if (!Array.isArray(value)) return { ok: true as const, ids: [] as RoleAgentToolsetId[] }
  const invalid = value.filter((item) => !isRoleAgentToolsetId(item)).map(String)
  if (invalid.length > 0) {
    return {
      ok: false as const,
      error: `未知工具集：${invalid.join('、')}`,
    }
  }
  return { ok: true as const, ids: normalizeRoleAgentToolsets(value) }
}

export function toolsetsForPrompt(prompt: string): RoleAgentToolsetId[] {
  const text = prompt.toLowerCase()
  const ids = new Set<RoleAgentToolsetId>(['file_read', 'artifact'])
  if (/(写|改|实现|生成|create|write|edit|code|文件)/i.test(prompt)) ids.add('file_write')
  if (/(命令|运行|测试|安装|shell|terminal|npm|pnpm|build|test)/i.test(prompt)) ids.add('shell')
  if (/(git|提交|diff|分支|commit|合并)/i.test(prompt)) ids.add('git')
  if (/(发布|部署|上线|preview|publish|deploy)/i.test(prompt)) ids.add('publish')
  if (/(网页|搜索|抓取|url|http|web|fetch)/i.test(prompt)) ids.add('web_fetch')
  if (/(ppt|演示|幻灯片|presentation|deck)/i.test(prompt) || text.includes('powerpoint')) ids.add('ppt_generation')
  return [...ids]
}

export function assertRoleAgentToolset(
  role: { id?: string | null; name?: string | null; toolset_ids?: unknown; capabilities?: unknown } | null | undefined,
  required: RoleAgentToolsetId,
) {
  const ids = normalizeRoleAgentToolsets(role?.toolset_ids)
  if (ids.includes(required)) return { ok: true as const }
  const name = role?.name ? `@${role.name}` : '当前 Agent'
  return {
    ok: false as const,
    error: `${name} 未开通「${TOOLSET_LABELS[required]}」工具集，已拒绝该真实执行动作。`,
  }
}

export async function loadRoleAgentForToolset(db: AppDbClient, roleAgentId: string | null | undefined) {
  if (!roleAgentId) return null
  const { data } = await db
    .from('role_agents')
    .select('id, name, toolset_ids, capabilities')
    .eq('id', roleAgentId)
    .single()
  return data as { id?: string; name?: string; toolset_ids?: unknown; capabilities?: unknown } | null
}
