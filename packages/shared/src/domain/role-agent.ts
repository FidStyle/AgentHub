export type RoleType = 'orchestrator' | 'engineer' | 'reviewer' | 'tester' | 'custom'

export interface RoleAgent {
  id: string
  workspaceId: string
  name: string
  roleType: RoleType
  systemPrompt: string
  capabilities: string[]
  allowOrchestration: boolean
}
