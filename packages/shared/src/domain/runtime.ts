import type { ExecutionDomain } from './workspace'

export type RuntimeType = 'hosted' | 'claude_code' | 'codex'
export type RuntimeSessionStatus = 'idle' | 'running' | 'completed' | 'failed'

export interface RuntimeBinding {
  id: string
  workspaceId: string
  roleAgentId: string
  runtimeType: RuntimeType
  executionDomain: ExecutionDomain
  config?: Record<string, unknown>
}

export interface RuntimeSession {
  id: string
  runtimeBindingId: string
  nativeSessionId: string | null
  cwd: string
  status: RuntimeSessionStatus
  capabilities: string[]
}
