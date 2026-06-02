import type { ExecutionDomain } from '../domain/workspace'
import type { RuntimeEndpointKind } from '../domain/runtime'

export interface RuntimeGatewayInvokeInput {
  workspaceId: string
  sessionId: string
  roleAgentId?: string
  executionDomain: ExecutionDomain
  endpointId: string
  endpointKind: RuntimeEndpointKind
  userMessage: string
  cwd?: string
}

export type RuntimeGatewayEvent =
  | { type: 'gateway_connected'; endpointId: string }
  | { type: 'runtime_status'; status: string; endpointId?: string }
  | { type: 'native_session'; nativeSessionId: string; endpointId?: string }
  | { type: 'public_runtime_available'; available: boolean; endpointId?: string }
  | { type: 'endpoint_unavailable'; endpointId?: string; reason: string }
  | { type: 'local_runtime_offline'; endpointId?: string; deviceId?: string }
  | { type: 'tunnel_connected'; endpointId: string; deviceId: string }
  | { type: 'tunnel_disconnected'; endpointId: string; deviceId: string }
  | { type: 'runtime_output'; delta: string; endpointId?: string }
  | { type: 'tool_started'; toolCallId?: string; toolName: string; input?: unknown; endpointId?: string }
  | { type: 'tool_delta'; toolCallId?: string; toolName?: string; delta: string; endpointId?: string }
  | { type: 'tool_completed'; toolCallId?: string; toolName: string; result?: unknown; endpointId?: string }
  | { type: 'approval_requested'; actionId?: string; title?: string; description: string; riskLevel?: string; endpointId?: string }
  | { type: 'question'; questionId?: string; title?: string; content: string; endpointId?: string }
  | { type: 'diff_created'; path?: string; diff: string; endpointId?: string }
  | { type: 'artifact_created'; artifactId?: string; artifactType: string; title: string; sourcePath?: string; contentRef?: string; endpointId?: string }
  | { type: 'runtime_completed'; endpointId?: string; summary?: string }
  | { type: 'runtime_failed'; endpointId?: string; error: string }
  | { type: 'runtime_cancelled'; endpointId?: string; reason?: string }
