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
type ChatKind = 'group' | 'direct';
interface Session {
    id: string;
    workspaceId: string;
    executionDomain: ExecutionDomain;
    status: SessionStatus;
    routingMode: RoutingMode;
    chatKind?: ChatKind;
    directRoleAgentId?: string | null;
    isPinned?: boolean;
    pinnedAt?: Date | null;
    lastActivityAt?: Date | null;
    createdAt: Date;
}
interface SessionParticipant {
    sessionId: string;
    roleAgentId: string;
}

type MessageType = 'text' | 'plan_card' | 'result_card' | 'approval' | 'system_event' | 'role_acknowledgement';
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
    status: 'pending' | 'approved' | 'rejected' | 'running' | 'completed' | 'failed';
    actionId?: string;
    title?: string;
    description: string;
    riskLevel?: string;
    actionKind?: string;
    workspaceRoot?: string;
    cwd?: string;
    targetPaths?: string[];
    commandPreview?: string;
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
    applicable?: boolean;
    applyable?: boolean;
    actionId?: string;
} | {
    id: string;
    type: 'artifact';
    status: 'created';
    artifactId?: string;
    artifactType: string;
    title: string;
    sourcePath?: string;
    contentRef?: string;
    previewUrl?: string;
    downloadUrl?: string;
} | {
    id: string;
    type: 'attachment';
    status: 'created';
    attachmentId?: string;
    name: string;
    mime?: string;
    size?: number;
    contentRef?: string;
    downloadUrl?: string;
} | {
    id: string;
    type: 'web_preview';
    status: 'created' | 'unavailable';
    title: string;
    url?: string;
    description?: string;
    iframeUrl?: string;
} | {
    id: string;
    type: 'publish_status';
    status: 'pending' | 'running' | 'stopped' | 'failed';
    artifactId?: string;
    title: string;
    url?: string;
    message?: string;
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

type ArtifactType = 'markdown' | 'code' | 'image' | 'file' | 'preview' | 'diff' | 'action_status' | 'document' | 'presentation';
interface Artifact {
    id: string;
    messageId: string;
    type: ArtifactType;
    content: string;
    metadata?: Record<string, unknown>;
}

type RoleType = 'orchestrator' | 'engineer' | 'reviewer' | 'tester' | 'custom';
type RoleAgentToolId = 'file_read' | 'file_write' | 'shell' | 'git_cli' | 'web_search' | 'web_fetch' | 'browser_preview' | 'diff_apply' | 'artifact_store' | 'publish_service' | 'ppt_master';
declare const ROLE_AGENT_TOOLS: readonly RoleAgentToolId[];
declare function isRoleAgentToolId(value: unknown): value is RoleAgentToolId;
declare function normalizeRoleAgentTools(value: unknown): RoleAgentToolId[];
declare function normalizeCapabilityTags(value: unknown): string[];
interface RoleAgent {
    id: string;
    workspaceId: string;
    name: string;
    roleType: RoleType;
    systemPrompt: string;
    capabilityTags: string[];
    enabledToolIds: RoleAgentToolId[];
    runtimeType: 'claude_code' | 'codex';
    allowOrchestration: boolean;
}

type RuntimeType = 'hosted' | 'claude_code' | 'codex' | 'opencode';
type RuntimeSessionStatus = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';
type CliRuntimeType = 'claude_code' | 'codex';
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
    sessionId: string;
    roleAgentId: string | null;
    runtimeType: CliRuntimeType;
    nativeSessionId: string | null;
    cwd: string | null;
    status: RuntimeSessionStatus;
    capabilitySnapshot: RuntimeCapabilitiesSnapshot | null;
}
interface RuntimeCapabilitiesSnapshot {
    runtimeType: CliRuntimeType;
    available: boolean;
    authenticated: boolean;
    launchable: boolean;
    supportsResume: boolean;
    supportsContinue: boolean;
    version?: string;
    cliPath?: string;
    diagnostic?: string;
}

type ActionType = 'preview' | 'test' | 'build' | 'shell' | 'git_stage' | 'git_unstage' | 'git_discard';
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

declare const WORKSPACE_ROOT_REQUIRED = "WORKSPACE_ROOT_REQUIRED";
declare const SELECTED_WORKSPACE_NOT_FOUND = "SELECTED_WORKSPACE_NOT_FOUND";
declare const RUNTIME_CWD_MISMATCH = "RUNTIME_CWD_MISMATCH";
type RuntimeInvocationStatus = 'starting' | 'running' | 'awaiting_approval' | 'completed' | 'failed' | 'cancelled';
type RuntimePermissionMode = 'default' | 'plan' | 'read_only' | 'dangerous_bypass';
interface RuntimeWorkspaceDescriptor {
    rootPath?: string | null;
    cloudProjectDir?: string | null;
}
interface RuntimeWorkspace extends Pick<Workspace, 'id' | 'name' | 'executionDomain'> {
    descriptor?: RuntimeWorkspaceDescriptor | null;
}
interface RuntimeWorkspaceScope {
    workspaceId: string;
    executionDomain: ExecutionDomain;
    workspaceRoot: string;
    cwd: string;
    visibleFiles: string[];
}
interface RuntimeWorkspaceContextPackage {
    id: string;
    workspaceId: string;
    sessionId: string;
    roleAgentId: string;
    workspaceRoot: string;
    messages: string[];
    artifacts: string[];
    files: string[];
    visibleFiles: string[];
    constraints: string[];
}
interface RuntimeInvokeInput {
    workspaceId: string;
    sessionId: string;
    roleAgentId: string;
    runtimeType: RuntimeType;
    executionDomain: ExecutionDomain;
    workspaceRoot: string;
    cwd: string;
    contextPackage: RuntimeWorkspaceContextPackage;
    userMessage: string;
    permissionMode?: RuntimePermissionMode;
    nativeSessionId?: string;
}
interface RuntimeSessionRecord {
    workspaceId: string;
    sessionId: string;
    roleAgentId: string;
    runtimeType: RuntimeType;
    executionDomain: ExecutionDomain;
    workspaceRoot: string;
    cwd: string;
    status: RuntimeInvocationStatus;
    adapterVersion: string;
    nativeSessionId?: string;
    lastInvocationAt: string;
}
interface ChatRuntimeInvocationInput {
    selectedWorkspaceId: string;
    sessionId: string;
    roleAgentId: string;
    runtimeType: RuntimeType;
    workspaces: RuntimeWorkspace[];
    userMessage: string;
    messages?: string[];
    artifacts?: string[];
    fileCandidates?: string[];
    constraints?: string[];
    permissionMode?: RuntimePermissionMode;
    nativeSessionId?: string;
}
declare const PermissionBrokerEventKind: {
    readonly ApprovalRequired: "approval_required";
    readonly Rejected: "rejected";
    readonly Approved: "approved";
    readonly ExecutionAllowed: "execution_allowed";
    readonly ExecutionBlocked: "execution_blocked";
};
type PermissionBrokerEventKind = (typeof PermissionBrokerEventKind)[keyof typeof PermissionBrokerEventKind];
declare const RoleDispatchEventKind: {
    readonly PlanCreated: "plan_created";
    readonly MailboxCreated: "mailbox_created";
    readonly RoleDispatched: "role_dispatched";
};
type RoleDispatchEventKind = (typeof RoleDispatchEventKind)[keyof typeof RoleDispatchEventKind];
declare const NativeCliToolActionKind: {
    readonly ReadFile: "read_file";
    readonly WriteFile: "write_file";
    readonly InstallDependency: "install_dependency";
    readonly StartService: "start_service";
    readonly NetworkRequest: "network_request";
    readonly WorkspaceExternalPathAccess: "workspace_external_path_access";
    readonly DestructiveCommand: "destructive_command";
    readonly ShellCommand: "shell_command";
};
type NativeCliToolActionKind = (typeof NativeCliToolActionKind)[keyof typeof NativeCliToolActionKind];
interface NativeCliToolCall {
    id: string;
    workspaceId: string;
    sessionId: string;
    runtimeInvocationId: string;
    actionKind: NativeCliToolActionKind;
    cwd: string;
    targetPaths?: string[];
    commandPreview?: string;
    requestedAt?: string;
}
interface PermissionBrokerDecision {
    approvalId: string;
    status: Extract<ApprovalStatus, 'approved' | 'rejected'>;
    decidedBy: string;
    decidedAt?: string;
}
interface PermissionBrokerEvent {
    id: string;
    workspaceId: string;
    sessionId: string;
    runtimeInvocationId: string;
    toolCallId: string;
    actionKind: NativeCliToolActionKind;
    kind: PermissionBrokerEventKind;
    approvalId?: string;
    reason: string;
    workspaceRoot: string;
    cwd: string;
    targetPaths: string[];
    commandPreview?: string;
    timestamp: string;
}
interface PermissionBrokerResult {
    allowed: boolean;
    approval?: PendingApproval;
    events: PermissionBrokerEvent[];
    code?: 'APPROVAL_REQUIRED' | 'APPROVAL_REJECTED' | 'OUTSIDE_WORKSPACE_ROOT' | 'WORKSPACE_MISMATCH';
}
interface ArchitectDispatchInput {
    workspaceId: string;
    sessionId: string;
    architectRoleAgentId: string;
    userMessage: string;
}
interface RoleDispatchEvent {
    id: string;
    kind: RoleDispatchEventKind;
    workspaceId: string;
    sessionId: string;
    planId: string;
    mailboxId: string;
    fromRoleAgentId: string;
    toRoleAgentId?: string;
    reason: string;
}
interface ArchitectDispatchResult {
    requiresEngineeringDispatch: boolean;
    planId: string;
    mailboxId: string;
    targetRoleAgentIds: string[];
    events: RoleDispatchEvent[];
}
interface RuntimeWorkerJob {
    id: string;
    workspaceId: string;
    sessionId: string;
    roleAgentId: string;
    runtimeType: RuntimeType;
    executionDomain: ExecutionDomain;
    workspaceRoot: string;
    cwd: string;
    runtimeInvocationContextId: string;
}
declare function resolveSelectedWorkspaceScope(workspaces: RuntimeWorkspace[], selectedWorkspaceId: string, fileCandidates?: string[]): RuntimeWorkspaceScope;
declare function createRuntimeInvokeInputFromChat(input: ChatRuntimeInvocationInput): RuntimeInvokeInput;
declare function assertRuntimeCwdMatchesWorkspaceRoot(input: Pick<RuntimeInvokeInput, 'cwd' | 'workspaceRoot'>): void;
declare function createRuntimeWorkerJob(input: RuntimeInvokeInput): RuntimeWorkerJob;
declare function visibleWorkspaceFiles(workspaceRoot: string, fileCandidates: string[]): string[];
declare function evaluateNativeCliToolPermission(toolCall: NativeCliToolCall, input: {
    workspaceRoot: string;
    workspaceId: string;
    decision?: PermissionBrokerDecision;
}): PermissionBrokerResult;
declare function createArchitectDispatch(input: ArchitectDispatchInput): ArchitectDispatchResult;
declare function createAcceptancePlanSummary(input: {
    workspaceId: string;
    sessionId: string;
    userMessage: string;
}): {
    id: string;
    runId: string;
    workspaceId: string;
    sessionId: string;
    version: number;
    summary: string;
    status: string;
    nodes: {
        id: string;
        title: string;
        roleAgentId: string;
        dependsOn: never[];
        expectedArtifact: string;
        frIds: string[];
        riskLevel: "medium";
        status: string;
    }[];
};

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
type RuntimeOutputMode = 'append' | 'replace';
type RuntimeOutputEvent = {
    type: 'runtime_output';
    delta: string;
    endpointId?: string;
    mode?: RuntimeOutputMode;
    seq?: number;
};
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
} | RuntimeOutputEvent | {
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
    actionKind?: string;
    workspaceRoot?: string;
    cwd?: string;
    targetPaths?: string[];
    commandPreview?: string;
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

declare function appendRuntimeDelta(current: string, delta: string): string;
declare function createRuntimeOutputAccumulator(initialContent?: string): {
    append(eventOrDelta: RuntimeOutputEvent | string): string;
    value(): string;
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
    status: 'pending' | 'ready' | 'waiting' | 'running' | 'completed' | 'failed' | 'skipped' | 'cancelled' | 'blocked';
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
type PlanNodeControl = 'retry' | 'resume' | 'cancel' | 'requeue';
type PlanNodeAttemptControl = PlanNodeControl | 'initial';
type MailboxDirection = 'outbound' | 'inbound' | 'reply';
type MailboxStatus = 'queued' | 'running' | 'waiting' | 'completed' | 'failed' | 'cancelled' | 'dead_letter';

/** Action execution types for orchestrator (extends domain types) */

type OrchestratorActionType = 'shell' | 'file_write' | 'git_push' | 'git_stage' | 'git_unstage' | 'git_discard' | 'deploy';
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
    fromRoleAgentId: string | null;
    fromRoleName: string;
    toRoleAgentId: string | null;
    toRoleName: string;
    sessionId: string;
    summary: string;
    sourceMessageId: string | null;
    target?: string;
    phase?: 'direct' | 'planning' | 'worker' | 'summarizing';
    runtimeType?: 'claude_code' | 'codex' | null;
    pinnedMessageIds?: string[];
    artifacts?: {
        type: string;
        content: string;
    }[];
    metadata?: Record<string, unknown>;
    createdAt: string;
}

interface AgentMailboxItem {
    id: string;
    workspace_id: string;
    session_id: string;
    plan_id: string | null;
    plan_node_id: string | null;
    direction: MailboxDirection;
    from_role_agent_id: string | null;
    to_role_agent_id: string;
    attempt_id: string | null;
    parent_attempt_id: string | null;
    lineage_root_id: string;
    runtime_type: CliRuntimeType;
    status: MailboxStatus;
    context_package: ContextPackage;
    reply_to_mailbox_item_id: string | null;
    error: string | null;
    created_at: string;
    updated_at: string;
}
interface PlanNodeAttempt {
    id: string;
    plan_node_id: string;
    attempt_number: number;
    control: PlanNodeAttemptControl;
    previous_attempt_id: string | null;
    runtime_session_id: string | null;
    mailbox_item_id: string | null;
    status: MailboxStatus;
    error: string | null;
    created_at: string;
    updated_at: string;
}
interface PlanNodeAttemptDraft {
    plan_node_id: string;
    attempt_number: number;
    control: PlanNodeAttemptControl;
    previous_attempt_id: string | null;
    status: MailboxStatus;
}
declare function selectReadyMailboxItems(items: AgentMailboxItem[]): AgentMailboxItem[];
declare function nextPlanNodeAttemptDraft(input: {
    planNodeId: string;
    control: PlanNodeAttemptControl;
    attempts: PlanNodeAttempt[];
}): PlanNodeAttemptDraft;

export { type ActionRequest, type ActionStatus, type ActionType, type AgentMailboxItem, type ApprovalSource, type ApprovalStatus, type ArchitectDispatchInput, type ArchitectDispatchResult, type Artifact, type ArtifactType, type AuthFrame, type BaseFrame, type BaseRuntimeEvent, type ChatKind, type ChatRuntimeInvocationInput, type CliRuntimeType, type ColorToken, type ConnectedFrame, type ContextPackage, DEFAULT_ORCHESTRATOR_CONFIG, DEFAULT_POLICIES, type Device, type DeviceFrame, type DeviceRuntimeChannelStatus, type DeviceType, type EventFrame, type ExecutionDomain, FR_IDS, type FrId, type FrameType, type HeartbeatAckFrame, type HeartbeatFrame, type MailboxDirection, type MailboxStatus, type Message, type MessageType, NativeCliToolActionKind, type NativeCliToolCall, type Notification, type NotificationType, type OrchestratorAction, type OrchestratorActionStatus, type OrchestratorActionType, type OrchestratorConfig, type PendingApproval, type PermissionBrokerDecision, type PermissionBrokerEvent, PermissionBrokerEventKind, type PermissionBrokerResult, type PermissionPolicy, type Plan, type PlanDAG, type PlanNode, type PlanNodeAttempt, type PlanNodeAttemptControl, type PlanNodeAttemptDraft, type PlanNodeControl, type PlanNodeStatus, type PlanStatus, ROLE_AGENT_TOOLS, RUNTIME_CWD_MISMATCH, type RequestFrame, type RequestType, type ResponseFrame, type RiskLevel, type RoleAgent, type RoleAgentToolId, type RoleDispatchEvent, RoleDispatchEventKind, type RoleType, type RoutingMode, type RuntimeAdapter, type RuntimeApprovalRequestedEvent, type RuntimeArtifactCreatedEvent, type RuntimeBinding, type RuntimeCancelledEvent, type RuntimeCapabilitiesSnapshot, type RuntimeCompletedEvent, type RuntimeEndpoint, type RuntimeEndpointKind, type RuntimeEndpointStatus, RuntimeErrorCode, type RuntimeEvent, type RuntimeEventType, type RuntimeFailedEvent, type RuntimeGatewayEvent, type RuntimeGatewayInvokeInput, type RuntimeInvocationStatus, type RuntimeInvokeInput, type RuntimeMessagePart, type RuntimeOutputEvent, type RuntimeOutputMode, type RuntimePermissionMode, type RuntimeResult, type RuntimeRunStatus, type RuntimeSession, type RuntimeSessionDiscoveredEvent, type RuntimeSessionRecord, type RuntimeSessionStatus, type RuntimeStartedEvent, type RuntimeTextDeltaEvent, type RuntimeToolCompletedEvent, type RuntimeToolDeltaEvent, type RuntimeToolStartedEvent, type RuntimeType, type RuntimeWorkerJob, type RuntimeWorkspace, type RuntimeWorkspaceContextPackage, type RuntimeWorkspaceDescriptor, type RuntimeWorkspaceScope, SELECTED_WORKSPACE_NOT_FOUND, type SenderType, SeqGenerator, type Session, type SessionParticipant, type SessionStatus, type StreamingStatus, type TaskResult, type TaskResultStatus, WORKSPACE_ROOT_REQUIRED, type Workspace, appendRuntimeDelta, assertRuntimeCwdMatchesWorkspaceRoot, colors, createAcceptancePlanSummary, createArchitectDispatch, createRuntimeInvokeInputFromChat, createRuntimeOutputAccumulator, createRuntimeWorkerJob, evaluateNativeCliToolPermission, isRoleAgentToolId, nextPlanNodeAttemptDraft, normalizeCapabilityTags, normalizeRoleAgentTools, parseFrame, resolveSelectedWorkspaceScope, selectReadyMailboxItems, serializeFrame, visibleWorkspaceFiles };
