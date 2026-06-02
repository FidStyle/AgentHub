import type { ExecutionDomain } from './workspace'

export type RuntimeType = 'hosted' | 'claude_code' | 'codex' | 'opencode'
export type RuntimeSessionStatus = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled'
export type CliRuntimeType = 'claude_code' | 'codex'

export type RuntimeEndpointKind = 'public_cloud' | 'user_local'
export type RuntimeEndpointStatus = 'available' | 'offline' | 'unconfigured'
export type RuntimeRunStatus = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled'
export type DeviceRuntimeChannelStatus = 'connected' | 'disconnected'

export interface RuntimeEndpoint {
  id: string
  userId?: string
  kind: RuntimeEndpointKind
  runtimeType: RuntimeType
  deviceId?: string
  status: RuntimeEndpointStatus
}

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
  sessionId: string
  roleAgentId: string | null
  runtimeType: CliRuntimeType
  nativeSessionId: string | null
  cwd: string | null
  status: RuntimeSessionStatus
  capabilitySnapshot: RuntimeCapabilitiesSnapshot | null
}

export interface RuntimeCapabilitiesSnapshot {
  runtimeType: CliRuntimeType
  available: boolean
  authenticated: boolean
  launchable: boolean
  supportsResume: boolean
  supportsContinue: boolean
  version?: string
  cliPath?: string
  diagnostic?: string
}
