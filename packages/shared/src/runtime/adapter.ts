import type { RuntimeType } from '../domain'

export interface RuntimeAdapter {
  type: RuntimeType
  execute(command: string, cwd: string): Promise<RuntimeResult>
  isAvailable(): Promise<boolean>
}

export interface RuntimeResult {
  exitCode: number
  stdout: string
  stderr: string
  duration: number
  nativeSessionId?: string | null
}

export interface OrchestratorConfig {
  maxConcurrent: number
  defaultRuntime: RuntimeType
  approvalRequired: (riskLevel: string) => boolean
}

export const DEFAULT_ORCHESTRATOR_CONFIG: OrchestratorConfig = {
  maxConcurrent: 3,
  defaultRuntime: 'claude_code',
  approvalRequired: (risk) => risk === 'critical' || risk === 'high',
}
