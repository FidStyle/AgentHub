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

type RuntimeType = 'hosted' | 'claude_code' | 'codex';
type RuntimeSessionStatus = 'idle' | 'running' | 'completed' | 'failed';
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
}
interface OrchestratorConfig {
    maxConcurrent: number;
    defaultRuntime: RuntimeType;
    approvalRequired: (riskLevel: string) => boolean;
}
declare const DEFAULT_ORCHESTRATOR_CONFIG: OrchestratorConfig;

export { type ActionRequest, type ActionStatus, type ActionType, type ApprovalSource, type ApprovalStatus, type Artifact, type ArtifactType, DEFAULT_ORCHESTRATOR_CONFIG, type Device, type DeviceType, type ExecutionDomain, FR_IDS, type FrId, type Message, type MessageType, type OrchestratorConfig, type PendingApproval, type RiskLevel, type RoleAgent, type RoleType, type RoutingMode, type RuntimeAdapter, type RuntimeBinding, type RuntimeResult, type RuntimeSession, type RuntimeSessionStatus, type RuntimeType, type SenderType, type Session, type SessionStatus, type StreamingStatus, type TaskResult, type TaskResultStatus, type Workspace };
