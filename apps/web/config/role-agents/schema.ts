import rawDefaultRoleAgents from './defaults.json'

const RUNTIME_TYPES = new Set(['claude_code', 'codex'])
const BUILT_IN_TOOL_IDS = new Set([
  'file_read',
  'file_write',
  'shell',
  'git_cli',
  'web_search',
  'web_fetch',
  'browser_preview',
  'diff_apply',
  'artifact_store',
  'publish_service',
  'ppt_master',
])

export type DefaultRoleAgent = {
  name: string
  role_type: string
  system_prompt: string
  capability_tags: string[]
  enabled_tool_ids: string[]
  runtime_type: 'claude_code' | 'codex'
  is_orchestrator: boolean
}

function assertStringArray(value: unknown, field: string, roleName: string) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`默认角色 ${roleName} 的 ${field} 必须是字符串数组`)
  }
  return value
}

function parseDefaultRoleAgent(value: unknown): DefaultRoleAgent {
  if (!value || typeof value !== 'object') {
    throw new Error('默认角色配置必须是对象')
  }
  const record = value as Record<string, unknown>
  const name = typeof record.name === 'string' ? record.name.trim() : ''
  if (!name) throw new Error('默认角色缺少 name')
  const roleType = typeof record.role_type === 'string' ? record.role_type.trim() : ''
  const systemPrompt = typeof record.system_prompt === 'string' ? record.system_prompt.trim() : ''
  const runtimeType = typeof record.runtime_type === 'string' ? record.runtime_type : ''
  if (!roleType) throw new Error(`默认角色 ${name} 缺少 role_type`)
  if (!systemPrompt) throw new Error(`默认角色 ${name} 缺少 system_prompt`)
  if (!RUNTIME_TYPES.has(runtimeType)) throw new Error(`默认角色 ${name} 的 runtime_type 无效：${runtimeType}`)
  if (typeof record.is_orchestrator !== 'boolean') throw new Error(`默认角色 ${name} 的 is_orchestrator 必须是布尔值`)

  const capabilityTags = assertStringArray(record.capability_tags, 'capability_tags', name)
  const enabledToolIds = assertStringArray(record.enabled_tool_ids, 'enabled_tool_ids', name)
  const unknownToolId = enabledToolIds.find((toolId) => !BUILT_IN_TOOL_IDS.has(toolId))
  if (unknownToolId) throw new Error(`默认角色 ${name} 启用了未知工具：${unknownToolId}`)

  return {
    name,
    role_type: roleType,
    system_prompt: systemPrompt,
    capability_tags: [...capabilityTags],
    enabled_tool_ids: [...enabledToolIds],
    runtime_type: runtimeType as DefaultRoleAgent['runtime_type'],
    is_orchestrator: record.is_orchestrator,
  }
}

function parseDefaultRoleAgents(value: unknown) {
  if (!Array.isArray(value)) throw new Error('默认角色配置必须是数组')
  const roles = value.map(parseDefaultRoleAgent)
  const duplicatedName = roles.find((role, index) => roles.findIndex((item) => item.name === role.name) !== index)?.name
  if (duplicatedName) throw new Error(`默认角色名称重复：${duplicatedName}`)
  return roles
}

export const DEFAULT_ROLE_AGENTS = parseDefaultRoleAgents(rawDefaultRoleAgents)
