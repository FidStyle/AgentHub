export type RuntimeEventType =
  | 'started'
  | 'session_discovered'
  | 'text_delta'
  | 'tool_started'
  | 'tool_delta'
  | 'tool_completed'
  | 'approval_requested'
  | 'artifact_created'
  | 'waiting'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface BaseRuntimeEvent {
  type: RuntimeEventType
  sessionId: string
  timestamp: number
}

export interface RuntimeStartedEvent extends BaseRuntimeEvent {
  type: 'started'
  runtimeType: string
  cwd: string
}

export interface RuntimeSessionDiscoveredEvent extends BaseRuntimeEvent {
  type: 'session_discovered'
  nativeSessionId: string
}

export interface RuntimeTextDeltaEvent extends BaseRuntimeEvent {
  type: 'text_delta'
  delta: string
}

export interface RuntimeToolStartedEvent extends BaseRuntimeEvent {
  type: 'tool_started'
  toolName: string
  toolInput?: string
}

export interface RuntimeToolDeltaEvent extends BaseRuntimeEvent {
  type: 'tool_delta'
  toolName: string
  delta: string
}

export interface RuntimeToolCompletedEvent extends BaseRuntimeEvent {
  type: 'tool_completed'
  toolName: string
  result?: string
}

export interface RuntimeApprovalRequestedEvent extends BaseRuntimeEvent {
  type: 'approval_requested'
  description: string
  riskLevel: string
}

export interface RuntimeArtifactCreatedEvent extends BaseRuntimeEvent {
  type: 'artifact_created'
  artifactType: string
  path?: string
  content?: string
}

export interface RuntimeCompletedEvent extends BaseRuntimeEvent {
  type: 'completed'
  summary?: string
  exitCode: number
}

export interface RuntimeFailedEvent extends BaseRuntimeEvent {
  type: 'failed'
  error: string
  exitCode?: number
}

export interface RuntimeCancelledEvent extends BaseRuntimeEvent {
  type: 'cancelled'
  reason?: string
}

export type RuntimeEvent =
  | RuntimeStartedEvent
  | RuntimeSessionDiscoveredEvent
  | RuntimeTextDeltaEvent
  | RuntimeToolStartedEvent
  | RuntimeToolDeltaEvent
  | RuntimeToolCompletedEvent
  | RuntimeApprovalRequestedEvent
  | RuntimeArtifactCreatedEvent
  | RuntimeCompletedEvent
  | RuntimeFailedEvent
  | RuntimeCancelledEvent
