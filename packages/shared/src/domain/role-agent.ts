export type RoleType = 'orchestrator' | 'engineer' | 'reviewer' | 'tester' | 'custom'
export type RoleAgentToolId =
  | 'file_read'
  | 'file_write'
  | 'shell'
  | 'git_cli'
  | 'web_search'
  | 'web_fetch'
  | 'browser_preview'
  | 'diff_apply'
  | 'artifact_store'
  | 'publish_service'
  | 'ppt_master'

export const ROLE_AGENT_TOOLS: readonly RoleAgentToolId[] = [
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
] as const

export function isRoleAgentToolId(value: unknown): value is RoleAgentToolId {
  return typeof value === 'string' && (ROLE_AGENT_TOOLS as readonly string[]).includes(value)
}

export function normalizeRoleAgentTools(value: unknown): RoleAgentToolId[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter(isRoleAgentToolId))]
}

export function normalizeCapabilityTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().replace(/^#+/, '').trim())
    .filter(Boolean))]
}

export interface RoleAgent {
  id: string
  workspaceId: string
  name: string
  roleType: RoleType
  systemPrompt: string
  capabilityTags: string[]
  enabledToolIds: RoleAgentToolId[]
  runtimeType: 'claude_code' | 'codex'
  allowOrchestration: boolean
}
