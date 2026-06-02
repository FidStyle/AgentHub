type ExecutionDomain = 'cloud' | 'local_desktop';
interface Workspace {
    id: string;
    name: string;
    userId: string;
    executionDomain: ExecutionDomain;
    createdAt: Date;
}

type DeviceType = 'desktop';
interface Device {
    id: string;
    userId: string;
    type: DeviceType;
    name: string;
    online: boolean;
    lastHeartbeat: Date;
}

type SessionStatus = 'active' | 'archived';
type RoutingMode = 'direct' | 'orchestrated';
interface Session {
    id: string;
    workspaceId: string;
    executionDomain: ExecutionDomain;
    status: SessionStatus;
    routingMode: RoutingMode;
    createdAt: Date;
}

type MessageType = 'text' | 'plan_card' | 'result_card' | 'approval' | 'system_event';
type SenderType = 'user' | 'agent' | 'system';
type StreamingStatus = 'idle' | 'streaming' | 'complete';
type RuntimeMessagePart = {
    id: string;
    type: 'tool';
    status: 'running' | 'completed' | 'failed';
    toolName: string;
    input?: unknown;
    delta?: string;
    result?: unknown;
} | {
    id: string;
    type: 'permission';
    status: 'pending';
    actionId?: string;
    title?: string;
    description: string;
    riskLevel?: string;
} | {
    id: string;
    type: 'question';
    status: 'pending';
    questionId?: string;
    title?: string;
    content: string;
} | {
    id: string;
    type: 'diff';
    status: 'created';
    path?: string;
    diff: string;
} | {
    id: string;
    type: 'artifact';
    status: 'created';
    artifactId?: string;
    artifactType: string;
    title: string;
    sourcePath?: string;
    contentRef?: string;
};
interface Message {
    id: string;
    session_id: string;
    sender_type: SenderType;
    sender_id: string | null;
    role_agent_id: string | null;
    content: string;
    message_type: MessageType;
    streaming_status: StreamingStatus;
    metadata: Record<string, unknown> | null;
    is_pinned: boolean;
    created_at: string;
    updated_at: string;
}

type ArtifactType = 'markdown' | 'code' | 'image' | 'file' | 'preview' | 'diff' | 'action_status';
interface Artifact {
    id: string;
    messageId: string;
    type: ArtifactType;
    content: string;
    metadata?: Record<string, unknown>;
}

type RoleType = 'orchestrator' | 'engineer' | 'reviewer' | 'tester' | 'custom';
interface RoleAgent {
    id: string;
    workspaceId: string;
    name: string;
    roleType: RoleType;
    systemPrompt: string;
    capabilities: string[];
    allowOrchestration: boolean;
}

type RuntimeType = 'hosted' | 'claude_code' | 'codex' | 'opencode';
type RuntimeSessionStatus = 'idle' | 'running' | 'completed' | 'failed';
type RuntimeEndpointKind = 'public_cloud' | 'user_local';
type RuntimeEndpointStatus = 'available' | 'offline' | 'unconfigured';
type RuntimeRunStatus = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';
type DeviceRuntimeChannelStatus = 'connected' | 'disconnected';
interface RuntimeEndpoint {
    id: string;
    userId?: string;
    kind: RuntimeEndpointKind;
    runtimeType: RuntimeType;
    deviceId?: string;
    status: RuntimeEndpointStatus;
}
interface RuntimeBinding {
    id: string;
    workspaceId: string;
    roleAgentId: string;
    runtimeType: RuntimeType;
    executionDomain: ExecutionDomain;
    config?: Record<string, unknown>;
}
interface RuntimeSession {
    id: string;
    runtimeBindingId: string;
    nativeSessionId: string | null;
    cwd: string;
    status: RuntimeSessionStatus;
    capabilities: string[];
}

type ActionType = 'preview' | 'test' | 'build' | 'shell';
type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
type ActionStatus = 'pending' | 'approved' | 'running' | 'completed' | 'failed' | 'cancelled';
interface ActionRequest {
    id: string;
    sessionId: string;
    type: ActionType;
    executionDomain: ExecutionDomain;
    workingDir: string;
    riskLevel: RiskLevel;
    status: ActionStatus;
    command?: string;
}

type ApprovalSource = 'action' | 'plan' | 'permission_escalation' | 'retry';
type ApprovalStatus = 'pending' | 'approved' | 'rejected';
interface PendingApproval {
    id: string;
    sourceType: ApprovalSource;
    sourceId: string;
    riskLevel: RiskLevel;
    status: ApprovalStatus;
    decidedAt?: Date;
}

type TaskResultStatus = 'success' | 'partial' | 'failed';
interface TaskResult {
    id: string;
    planNodeId: string;
    roleAgentId: string;
    status: TaskResultStatus;
    summary: string;
    changedFiles: string[];
    diffUrl?: string;
    previewUrl?: string;
}

declare const FR_IDS: {
    readonly AUTH_001: "FR-AUTH-001";
    readonly WS_001: "FR-WS-001";
    readonly DEVICE_001: "FR-DEVICE-001";
    readonly WEB_001: "FR-WEB-001";
    readonly DESK_001: "FR-DESK-001";
    readonly MOB_001: "FR-MOB-001";
    readonly CHAT_001: "FR-CHAT-001";
    readonly AGENT_001: "FR-AGENT-001";
    readonly RUNTIME_001: "FR-RUNTIME-001";
    readonly ORCH_001: "FR-ORCH-001";
    readonly CTX_001: "FR-CTX-001";
    readonly ARTIFACT_001: "FR-ARTIFACT-001";
    readonly RESULT_001: "FR-RESULT-001";
    readonly ACTION_001: "FR-ACTION-001";
    readonly PERM_001: "FR-PERM-001";
    readonly NOTIFY_001: "FR-NOTIFY-001";
};
type FrId = (typeof FR_IDS)[keyof typeof FR_IDS];

declare const colors: {
    readonly primary: "hsl(222.2, 47.4%, 11.2%)";
    readonly primaryForeground: "hsl(210, 40%, 98%)";
    readonly muted: "hsl(210, 40%, 96.1%)";
    readonly mutedForeground: "hsl(215.4, 16.3%, 46.9%)";
    readonly border: "hsl(214.3, 31.8%, 91.4%)";
    readonly background: "hsl(0, 0%, 100%)";
    readonly card: "hsl(0, 0%, 100%)";
    readonly success: "hsl(142, 71%, 45%)";
    readonly destructive: "hsl(0, 84.2%, 60.2%)";
    readonly accent: "hsl(210, 40%, 96.1%)";
};
type ColorToken = keyof typeof colors;

interface RuntimeAdapter {
    type: RuntimeType;
    execute(command: string, cwd: string): Promise<RuntimeResult>;
    isAvailable(): Promise<boolean>;
}
interface RuntimeResult {
    exitCode: number;
    stdout: string;
    stderr: string;
    duration: number;
    nativeSessionId?: string | null;
}
interface OrchestratorConfig {
    maxConcurrent: number;
    defaultRuntime: RuntimeType;
    approvalRequired: (riskLevel: string) => boolean;
}
declare const DEFAULT_ORCHESTRATOR_CONFIG: OrchestratorConfig;

interface RuntimeGatewayInvokeInput {
    workspaceId: string;
    sessionId: string;
    roleAgentId?: string;
    executionDomain: ExecutionDomain;
    endpointId: string;
    endpointKind: RuntimeEndpointKind;
    runtimeType?: RuntimeType;
    userMessage: string;
    cwd?: string;
}
type RuntimeGatewayEvent = {
    type: 'gateway_connected';
    endpointId: string;
} | {
    type: 'runtime_status';
    status: string;
    endpointId?: string;
} | {
    type: 'native_session';
    nativeSessionId: string;
    endpointId?: string;
} | {
    type: 'public_runtime_available';
    available: boolean;
    endpointId?: string;
} | {
    type: 'endpoint_unavailable';
    endpointId?: string;
    reason: string;
} | {
    type: 'local_runtime_offline';
    endpointId?: string;
    deviceId?: string;
} | {
    type: 'tunnel_connected';
    endpointId: string;
    deviceId: string;
} | {
    type: 'tunnel_disconnected';
    endpointId: string;
    deviceId: string;
} | {
    type: 'runtime_output';
    delta: string;
    endpointId?: string;
} | {
    type: 'tool_started';
    toolCallId?: string;
    toolName: string;
    input?: unknown;
    endpointId?: string;
} | {
    type: 'tool_delta';
    toolCallId?: string;
    toolName?: string;
    delta: string;
    endpointId?: string;
} | {
    type: 'tool_completed';
    toolCallId?: string;
    toolName: string;
    result?: unknown;
    endpointId?: string;
} | {
    type: 'approval_requested';
    actionId?: string;
    title?: string;
    description: string;
    riskLevel?: string;
    endpointId?: string;
} | {
    type: 'question';
    questionId?: string;
    title?: string;
    content: string;
    endpointId?: string;
} | {
    type: 'diff_created';
    path?: string;
    diff: string;
    endpointId?: string;
} | {
    type: 'artifact_created';
    artifactId?: string;
    artifactType: string;
    title: string;
    sourcePath?: string;
    contentRef?: string;
    endpointId?: string;
} | {
    type: 'runtime_completed';
    endpointId?: string;
    summary?: string;
} | {
    type: 'runtime_failed';
    endpointId?: string;
    error: string;
} | {
    type: 'runtime_cancelled';
    endpointId?: string;
    reason?: string;
};

declare const RuntimeErrorCode: {
    readonly DEVICE_OFFLINE: "DEVICE_OFFLINE";
    readonly ENDPOINT_UNAVAILABLE: "endpoint_unavailable";
    readonly PUBLIC_RUNTIME_UNCONFIGURED: "public_runtime_unconfigured";
    readonly TUNNEL_DISCONNECTED: "tunnel_disconnected";
};
type RuntimeErrorCode = (typeof RuntimeErrorCode)[keyof typeof RuntimeErrorCode];

type FrameType = 'auth' | 'connected' | 'heartbeat' | 'heartbeat_ack' | 'request' | 'response' | 'event';
interface BaseFrame {
    type: FrameType;
    seq: number;
}
interface AuthFrame extends BaseFrame {
    type: 'auth';
    deviceToken: string;
}
interface ConnectedFrame extends BaseFrame {
    type: 'connected';
    deviceId: string;
    workspaceIds: string[];
}
interface HeartbeatFrame extends BaseFrame {
    type: 'heartbeat';
    sentAt: number;
}
interface HeartbeatAckFrame extends BaseFrame {
    type: 'heartbeat_ack';
    sentAt: number;
}
type RequestType = 'runtime_invoke' | 'runtime_cancel' | 'action_execute' | 'detect_runtime';
interface RequestFrame extends BaseFrame {
    type: 'request';
    requestId: string;
    requestType: RequestType;
    payload: Record<string, unknown>;
}
interface ResponseFrame extends BaseFrame {
    type: 'response';
    requestId: string;
    ok: boolean;
    error?: string;
    payload?: Record<string, unknown>;
}
interface EventFrame extends BaseFrame {
    type: 'event';
    eventId: string;
    eventType: string;
    payload: Record<string, unknown>;
}
type DeviceFrame = AuthFrame | ConnectedFrame | HeartbeatFrame | HeartbeatAckFrame | RequestFrame | ResponseFrame | EventFrame;
declare function serializeFrame(frame: DeviceFrame): string;
declare function parseFrame(data: string): DeviceFrame | null;
declare class SeqGenerator {
    private seq;
    next(): number;
    reset(): void;
}

type RuntimeEventType = 'started' | 'session_discovered' | 'text_delta' | 'tool_started' | 'tool_delta' | 'tool_completed' | 'approval_requested' | 'artifact_created' | 'completed' | 'failed' | 'cancelled';
interface BaseRuntimeEvent {
    type: RuntimeEventType;
    sessionId: string;
    timestamp: number;
}
interface RuntimeStartedEvent extends BaseRuntimeEvent {
    type: 'started';
    runtimeType: string;
    cwd: string;
}
interface RuntimeSessionDiscoveredEvent extends BaseRuntimeEvent {
    type: 'session_discovered';
    nativeSessionId: string;
}
interface RuntimeTextDeltaEvent extends BaseRuntimeEvent {
    type: 'text_delta';
    delta: string;
}
interface RuntimeToolStartedEvent extends BaseRuntimeEvent {
    type: 'tool_started';
    toolName: string;
    toolInput?: string;
}
interface RuntimeToolDeltaEvent extends BaseRuntimeEvent {
    type: 'tool_delta';
    toolName: string;
    delta: string;
}
interface RuntimeToolCompletedEvent extends BaseRuntimeEvent {
    type: 'tool_completed';
    toolName: string;
    result?: string;
}
interface RuntimeApprovalRequestedEvent extends BaseRuntimeEvent {
    type: 'approval_requested';
    description: string;
    riskLevel: string;
}
interface RuntimeArtifactCreatedEvent extends BaseRuntimeEvent {
    type: 'artifact_created';
    artifactType: string;
    path?: string;
    content?: string;
}
interface RuntimeCompletedEvent extends BaseRuntimeEvent {
    type: 'completed';
    summary?: string;
    exitCode: number;
}
interface RuntimeFailedEvent extends BaseRuntimeEvent {
    type: 'failed';
    error: string;
    exitCode?: number;
}
interface RuntimeCancelledEvent extends BaseRuntimeEvent {
    type: 'cancelled';
    reason?: string;
}
type RuntimeEvent = RuntimeStartedEvent | RuntimeSessionDiscoveredEvent | RuntimeTextDeltaEvent | RuntimeToolStartedEvent | RuntimeToolDeltaEvent | RuntimeToolCompletedEvent | RuntimeApprovalRequestedEvent | RuntimeArtifactCreatedEvent | RuntimeCompletedEvent | RuntimeFailedEvent | RuntimeCancelledEvent;

/** Orchestrator Plan DAG Types */
interface PlanNode {
    id: string;
    plan_id: string;
    label: string;
    agent_id?: string;
    status: 'pending' | 'ready' | 'running' | 'completed' | 'failed' | 'skipped';
    action_type?: 'runtime_invoke' | 'action_exec' | 'human_confirm';
    action_payload?: Record<string, unknown>;
    result?: Record<string, unknown>;
    depends_on: string[];
    started_at?: string;
    completed_at?: string;
}
interface PlanDAG {
    nodes: {
        id: string;
        label: string;
        depends_on: string[];
    }[];
    edges: {
        from: string;
        to: string;
    }[];
}
interface Plan {
    id: string;
    session_id: string;
    owner_id: string;
    title: string;
    status: 'draft' | 'pending_confirm' | 'running' | 'completed' | 'failed' | 'cancelled';
    dag: PlanDAG;
    created_at: string;
    updated_at: string;
}
type PlanStatus = Plan['status'];
type PlanNodeStatus = PlanNode['status'];

/** Action execution types for orchestrator (extends domain types) */

type OrchestratorActionType = 'shell' | 'file_write' | 'git_push' | 'deploy';
type OrchestratorActionStatus = 'pending' | 'approved' | 'rejected' | 'running' | 'completed' | 'failed';
interface OrchestratorAction {
    id: string;
    plan_node_id?: string;
    session_id: string;
    owner_id: string;
    action_type: OrchestratorActionType;
    command: string;
    cwd?: string;
    risk_level: RiskLevel;
    status: OrchestratorActionStatus;
    requires_approval: boolean;
    result?: Record<string, unknown>;
    approved_at?: string;
    executed_at?: string;
    created_at: string;
}
/** Permission policy: determines if an action requires approval */
interface PermissionPolicy {
    action_type: string;
    risk_level: RiskLevel;
    requires_approval: boolean;
    description: string;
}
declare const DEFAULT_POLICIES: PermissionPolicy[];

/** Notification types */
type NotificationType = 'approval_required' | 'plan_completed' | 'action_failed' | 'info';
interface Notification {
    id: string;
    user_id: string;
    type: NotificationType;
    title: string;
    body?: string;
    ref_type?: 'plan' | 'action' | 'plan_node';
    ref_id?: string;
    read: boolean;
    created_at: string;
}

/** Context Handoff: passes context between role agents */
interface ContextPackage {
    from_agent_id: string;
    to_agent_id: string;
    session_id: string;
    summary: string;
    pinned_message_ids: string[];
    artifacts: {
        type: string;
        content: string;
    }[];
    metadata?: Record<string, unknown>;
    created_at: string;
}

export { type ActionRequest, type ActionStatus, type ActionType, type ApprovalSource, type ApprovalStatus, type Artifact, type ArtifactType, type AuthFrame, type BaseFrame, type BaseRuntimeEvent, type ColorToken, type ConnectedFrame, type ContextPackage, DEFAULT_ORCHESTRATOR_CONFIG, DEFAULT_POLICIES, type Device, type DeviceFrame, type DeviceRuntimeChannelStatus, type DeviceType, type EventFrame, type ExecutionDomain, FR_IDS, type FrId, type FrameType, type HeartbeatAckFrame, type HeartbeatFrame, type Message, type MessageType, type Notification, type NotificationType, type OrchestratorAction, type OrchestratorActionStatus, type OrchestratorActionType, type OrchestratorConfig, type PendingApproval, type PermissionPolicy, type Plan, type PlanDAG, type PlanNode, type PlanNodeStatus, type PlanStatus, type RequestFrame, type RequestType, type ResponseFrame, type RiskLevel, type RoleAgent, type RoleType, type RoutingMode, type RuntimeAdapter, type RuntimeApprovalRequestedEvent, type RuntimeArtifactCreatedEvent, type RuntimeBinding, type RuntimeCancelledEvent, type RuntimeCompletedEvent, type RuntimeEndpoint, type RuntimeEndpointKind, type RuntimeEndpointStatus, RuntimeErrorCode, type RuntimeEvent, type RuntimeEventType, type RuntimeFailedEvent, type RuntimeGatewayEvent, type RuntimeGatewayInvokeInput, type RuntimeMessagePart, type RuntimeResult, type RuntimeRunStatus, type RuntimeSession, type RuntimeSessionDiscoveredEvent, type RuntimeSessionStatus, type RuntimeStartedEvent, type RuntimeTextDeltaEvent, type RuntimeToolCompletedEvent, type RuntimeToolDeltaEvent, type RuntimeToolStartedEvent, type RuntimeType, type SenderType, SeqGenerator, type Session, type SessionStatus, type StreamingStatus, type TaskResult, type TaskResultStatus, type Workspace, colors, parseFrame, serializeFrame };
