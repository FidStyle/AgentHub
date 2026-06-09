import type { AppDbClient } from '@/lib/postgres-query-client'
import type { RoleAgentToolId } from '@agenthub/shared'
import { normalizeCapabilityTags, normalizeRoleAgentTools } from '@agenthub/shared'

export type ToolRiskLevel = 'low' | 'medium' | 'high'
export type ToolCategory = 'file' | 'runtime' | 'git' | 'web' | 'artifact' | 'publish' | 'presentation'

export type RoleAgentToolDefinition = {
  id: RoleAgentToolId
  label: string
  description: string
  riskLevel: ToolRiskLevel
  category: ToolCategory
}

export const ROLE_AGENT_TOOL_CATALOG: readonly RoleAgentToolDefinition[] = [
  { id: 'file_read', label: '读取文件', description: '读取工作区内文本、代码和目录内容。', riskLevel: 'low', category: 'file' },
  { id: 'file_write', label: '写入文件', description: '在工作区内创建、修改或删除文件。', riskLevel: 'medium', category: 'file' },
  { id: 'shell', label: '执行命令', description: '在工作区内执行 shell/native CLI 命令。', riskLevel: 'high', category: 'runtime' },
  { id: 'git_cli', label: 'Git CLI', description: '读取 Git 状态、暂存、取消暂存、提交或回退。', riskLevel: 'high', category: 'git' },
  { id: 'web_search', label: 'Web Search', description: '搜索公网信息并返回摘要来源。', riskLevel: 'medium', category: 'web' },
  { id: 'web_fetch', label: 'Web Fetch', description: '读取指定 URL 内容作为上下文。', riskLevel: 'medium', category: 'web' },
  { id: 'browser_preview', label: '浏览器预览', description: '启动或操作浏览器预览产物行为。', riskLevel: 'medium', category: 'web' },
  { id: 'diff_apply', label: '应用 Diff', description: '把经过审批的 unified diff 应用到工作区。', riskLevel: 'high', category: 'git' },
  { id: 'artifact_store', label: '产物存储', description: '创建、更新、读取和下载 durable artifact。', riskLevel: 'medium', category: 'artifact' },
  { id: 'publish_service', label: '发布服务', description: '启动或停止当前产物的临时访问服务。', riskLevel: 'high', category: 'publish' },
  { id: 'ppt_master', label: 'ppt-master', description: '生成可下载的演示稿 PPTX，并提供预览转换入口。', riskLevel: 'medium', category: 'presentation' },
] as const

const TOOL_LABELS = ROLE_AGENT_TOOL_CATALOG.reduce((acc, tool) => {
  acc[tool.id] = tool.label
  return acc
}, {} as Record<RoleAgentToolId, string>)

const RUNTIME_IDS = new Set(['claude_code', 'codex', 'opencode'])

export function validateEnabledToolIds(value: unknown) {
  if (!Array.isArray(value)) return { ok: true as const, ids: [] as RoleAgentToolId[] }
  const runtimeIds = value.filter((item) => typeof item === 'string' && RUNTIME_IDS.has(item)).map(String)
  if (runtimeIds.length > 0) return { ok: false as const, error: `Runtime 不是工具：${runtimeIds.join('、')}` }
  const normalized = normalizeRoleAgentTools(value)
  const invalid = value.filter((item) => typeof item !== 'string' || !normalized.includes(item as RoleAgentToolId)).map(String)
  if (invalid.length > 0) return { ok: false as const, error: `未知工具：${invalid.join('、')}` }
  return { ok: true as const, ids: normalized }
}

export function normalizeRoleAgentCapabilityTags(value: unknown): string[] {
  return normalizeCapabilityTags(value)
}

export function toolsForPrompt(prompt: string): RoleAgentToolId[] {
  const ids = new Set<RoleAgentToolId>(['file_read', 'artifact_store'])
  if (/(写|改|实现|生成|create|write|edit|code|文件)/i.test(prompt)) ids.add('file_write')
  if (/(命令|运行|测试|安装|shell|terminal|npm|pnpm|build|test)/i.test(prompt)) ids.add('shell')
  if (/(git|提交|diff|分支|commit|合并)/i.test(prompt)) ids.add('git_cli')
  if (/(diff|patch|补丁|应用修改)/i.test(prompt)) ids.add('diff_apply')
  if (/(发布|部署|上线|preview|publish|deploy|启动)/i.test(prompt)) ids.add('publish_service')
  if (/(浏览器|预览|playwright|e2e|网页测试|browser)/i.test(prompt)) ids.add('browser_preview')
  if (/(搜索|检索|search)/i.test(prompt)) ids.add('web_search')
  if (/(网页|抓取|url|http|web|fetch)/i.test(prompt)) ids.add('web_fetch')
  if (/(ppt|演示|幻灯片|presentation|deck)/i.test(prompt) || prompt.toLowerCase().includes('powerpoint')) ids.add('ppt_master')
  if (/(文档|markdown|md|说明书|需求文档|报告|docx?)/i.test(prompt)) ids.add('file_write')
  return [...ids]
}

export function capabilityTagsForPrompt(prompt: string): string[] {
  const tags = new Set<string>(['自建Agent'])
  if (/(前端|ui|页面|react|web)/i.test(prompt)) tags.add('前端')
  if (/(后端|api|数据库|server|runtime)/i.test(prompt)) tags.add('后端')
  if (/(测试|验收|qa|test|e2e)/i.test(prompt)) tags.add('验收')
  if (/(审查|review|代码审查)/i.test(prompt)) tags.add('审查')
  if (/(ppt|演示|幻灯片|presentation)/i.test(prompt)) tags.add('演示稿')
  if (/(文档|markdown|md|说明书|需求文档|报告|docx?)/i.test(prompt)) tags.add('文档')
  if (/(git|提交|diff|分支|commit)/i.test(prompt)) tags.add('Git')
  return [...tags]
}

export function assertRoleAgentTool(
  role: { id?: string | null; name?: string | null; enabled_tool_ids?: unknown; capability_tags?: unknown } | null | undefined,
  required: RoleAgentToolId,
) {
  const ids = normalizeRoleAgentTools(role?.enabled_tool_ids)
  if (ids.includes(required)) return { ok: true as const }
  const name = role?.name ? `@${role.name}` : '当前 Agent'
  return { ok: false as const, error: `${name} 未启用「${TOOL_LABELS[required]}」工具，已拒绝该真实执行动作。` }
}

export async function loadRoleAgentForTool(db: AppDbClient, roleAgentId: string | null | undefined) {
  if (!roleAgentId) return null
  const { data } = await db
    .from('role_agents')
    .select('id, name, enabled_tool_ids, capability_tags')
    .eq('id', roleAgentId)
    .single()
  return data as { id?: string; name?: string; enabled_tool_ids?: unknown; capability_tags?: unknown } | null
}
