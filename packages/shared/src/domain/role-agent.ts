export type RoleType = 'orchestrator' | 'engineer' | 'reviewer' | 'tester' | 'custom'
export type RoleAgentToolsetId =
  | 'file_read'
  | 'file_write'
  | 'shell'
  | 'git'
  | 'artifact'
  | 'publish'
  | 'web_fetch'
  | 'ppt_generation'

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

export interface RoleAgent {
  id: string
  workspaceId: string
  name: string
  roleType: RoleType
  systemPrompt: string
  capabilities: string[]
  toolsetIds?: RoleAgentToolsetId[]
  runtimeType: 'claude_code' | 'codex'
  allowOrchestration: boolean
}
