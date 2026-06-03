import type { RiskLevel } from './action'
import type { ApprovalStatus, PendingApproval } from './approval'
import type { ExecutionDomain, Workspace } from './workspace'
import type { RuntimeType } from './runtime'

export const WORKSPACE_ROOT_REQUIRED = 'WORKSPACE_ROOT_REQUIRED'
export const SELECTED_WORKSPACE_NOT_FOUND = 'SELECTED_WORKSPACE_NOT_FOUND'
export const RUNTIME_CWD_MISMATCH = 'RUNTIME_CWD_MISMATCH'

export type RuntimeInvocationStatus = 'starting' | 'running' | 'awaiting_approval' | 'completed' | 'failed' | 'cancelled'
export type RuntimePermissionMode = 'default' | 'plan' | 'read_only' | 'dangerous_bypass'

export interface RuntimeWorkspaceDescriptor {
  rootPath?: string | null
  cloudProjectDir?: string | null
}

export interface RuntimeWorkspace extends Pick<Workspace, 'id' | 'name' | 'executionDomain'> {
  descriptor?: RuntimeWorkspaceDescriptor | null
}

export interface RuntimeWorkspaceScope {
  workspaceId: string
  executionDomain: ExecutionDomain
  workspaceRoot: string
  cwd: string
  visibleFiles: string[]
}

export interface ContextPackage {
  id: string
  workspaceId: string
  sessionId: string
  roleAgentId: string
  workspaceRoot: string
  messages: string[]
  artifacts: string[]
  files: string[]
  visibleFiles: string[]
  constraints: string[]
}

export interface RuntimeInvokeInput {
  workspaceId: string
  sessionId: string
  roleAgentId: string
  runtimeType: RuntimeType
  executionDomain: ExecutionDomain
  workspaceRoot: string
  cwd: string
  contextPackage: ContextPackage
  userMessage: string
  permissionMode?: RuntimePermissionMode
  nativeSessionId?: string
}

export interface RuntimeSessionRecord {
  workspaceId: string
  sessionId: string
  roleAgentId: string
  runtimeType: RuntimeType
  executionDomain: ExecutionDomain
  workspaceRoot: string
  cwd: string
  status: RuntimeInvocationStatus
  adapterVersion: string
  nativeSessionId?: string
  lastInvocationAt: string
}

export interface ChatRuntimeInvocationInput {
  selectedWorkspaceId: string
  sessionId: string
  roleAgentId: string
  runtimeType: RuntimeType
  workspaces: RuntimeWorkspace[]
  userMessage: string
  messages?: string[]
  artifacts?: string[]
  fileCandidates?: string[]
  constraints?: string[]
  permissionMode?: RuntimePermissionMode
  nativeSessionId?: string
}

export const PermissionBrokerEventKind = {
  ApprovalRequired: 'approval_required',
  Rejected: 'rejected',
  Approved: 'approved',
  ExecutionAllowed: 'execution_allowed',
  ExecutionBlocked: 'execution_blocked',
} as const

export type PermissionBrokerEventKind =
  (typeof PermissionBrokerEventKind)[keyof typeof PermissionBrokerEventKind]

export const RoleDispatchEventKind = {
  PlanCreated: 'plan_created',
  MailboxCreated: 'mailbox_created',
  RoleDispatched: 'role_dispatched',
} as const

export type RoleDispatchEventKind =
  (typeof RoleDispatchEventKind)[keyof typeof RoleDispatchEventKind]

export const NativeCliToolActionKind = {
  ReadFile: 'read_file',
  WriteFile: 'write_file',
  InstallDependency: 'install_dependency',
  StartService: 'start_service',
  NetworkRequest: 'network_request',
  WorkspaceExternalPathAccess: 'workspace_external_path_access',
  DestructiveCommand: 'destructive_command',
  ShellCommand: 'shell_command',
} as const

export type NativeCliToolActionKind =
  (typeof NativeCliToolActionKind)[keyof typeof NativeCliToolActionKind]

export interface NativeCliToolCall {
  id: string
  workspaceId: string
  sessionId: string
  runtimeInvocationId: string
  actionKind: NativeCliToolActionKind
  cwd: string
  targetPaths?: string[]
  commandPreview?: string
  requestedAt?: string
}

export interface PermissionBrokerDecision {
  approvalId: string
  status: Extract<ApprovalStatus, 'approved' | 'rejected'>
  decidedBy: string
  decidedAt?: string
}

export interface PermissionBrokerEvent {
  id: string
  workspaceId: string
  sessionId: string
  runtimeInvocationId: string
  toolCallId: string
  actionKind: NativeCliToolActionKind
  kind: PermissionBrokerEventKind
  approvalId?: string
  reason: string
  workspaceRoot: string
  cwd: string
  targetPaths: string[]
  commandPreview?: string
  timestamp: string
}

export interface PermissionBrokerResult {
  allowed: boolean
  approval?: PendingApproval
  events: PermissionBrokerEvent[]
  code?: 'APPROVAL_REQUIRED' | 'APPROVAL_REJECTED' | 'OUTSIDE_WORKSPACE_ROOT' | 'WORKSPACE_MISMATCH'
}

export interface ArchitectDispatchInput {
  workspaceId: string
  sessionId: string
  architectRoleAgentId: string
  userMessage: string
}

export interface RoleDispatchEvent {
  id: string
  kind: RoleDispatchEventKind
  workspaceId: string
  sessionId: string
  planId: string
  mailboxId: string
  fromRoleAgentId: string
  toRoleAgentId?: string
  reason: string
}

export interface ArchitectDispatchResult {
  requiresEngineeringDispatch: boolean
  planId: string
  mailboxId: string
  targetRoleAgentIds: string[]
  events: RoleDispatchEvent[]
}

export interface RuntimeWorkerJob {
  id: string
  workspaceId: string
  sessionId: string
  roleAgentId: string
  runtimeType: RuntimeType
  executionDomain: ExecutionDomain
  workspaceRoot: string
  cwd: string
  runtimeInvocationContextId: string
}

export function resolveSelectedWorkspaceScope(
  workspaces: RuntimeWorkspace[],
  selectedWorkspaceId: string,
  fileCandidates: string[] = [],
): RuntimeWorkspaceScope {
  const workspace = workspaces.find((item) => item.id === selectedWorkspaceId)
  if (!workspace) {
    throw new Error(SELECTED_WORKSPACE_NOT_FOUND)
  }

  const workspaceRoot = normalizeWorkspaceRoot(workspace)
  return {
    workspaceId: workspace.id,
    executionDomain: workspace.executionDomain,
    workspaceRoot,
    cwd: workspaceRoot,
    visibleFiles: visibleWorkspaceFiles(workspaceRoot, fileCandidates),
  }
}

export function createRuntimeInvokeInputFromChat(
  input: ChatRuntimeInvocationInput,
): RuntimeInvokeInput {
  const scope = resolveSelectedWorkspaceScope(
    input.workspaces,
    input.selectedWorkspaceId,
    input.fileCandidates,
  )
  const contextPackage: ContextPackage = {
    id: `ctx-${input.selectedWorkspaceId}-${input.sessionId}-${input.roleAgentId}`,
    workspaceId: scope.workspaceId,
    sessionId: input.sessionId,
    roleAgentId: input.roleAgentId,
    workspaceRoot: scope.workspaceRoot,
    messages: [...(input.messages ?? [input.userMessage])],
    artifacts: [...(input.artifacts ?? [])],
    files: [...scope.visibleFiles],
    visibleFiles: [...scope.visibleFiles],
    constraints: [
      'Only use files visible inside the selected workspace root.',
      'Do not infer stack, package manager, AGENTS.md, Trellis, or monorepo context from the AgentHub host repository.',
      ...(input.constraints ?? []),
    ],
  }

  return {
    workspaceId: scope.workspaceId,
    sessionId: input.sessionId,
    roleAgentId: input.roleAgentId,
    runtimeType: input.runtimeType,
    executionDomain: scope.executionDomain,
    workspaceRoot: scope.workspaceRoot,
    cwd: scope.cwd,
    contextPackage,
    userMessage: input.userMessage,
    permissionMode: input.permissionMode,
    nativeSessionId: input.nativeSessionId,
  }
}

export function assertRuntimeCwdMatchesWorkspaceRoot(
  input: Pick<RuntimeInvokeInput, 'cwd' | 'workspaceRoot'>,
): void {
  if (normalizeAbsolutePath(input.cwd) !== normalizeAbsolutePath(input.workspaceRoot)) {
    throw new Error(RUNTIME_CWD_MISMATCH)
  }
}

export function createRuntimeWorkerJob(input: RuntimeInvokeInput): RuntimeWorkerJob {
  assertRuntimeCwdMatchesWorkspaceRoot(input)
  return {
    id: `worker-${input.workspaceId}-${input.sessionId}-${input.roleAgentId}`,
    workspaceId: input.workspaceId,
    sessionId: input.sessionId,
    roleAgentId: input.roleAgentId,
    runtimeType: input.runtimeType,
    executionDomain: input.executionDomain,
    workspaceRoot: input.workspaceRoot,
    cwd: input.cwd,
    runtimeInvocationContextId: input.contextPackage.id,
  }
}

export function visibleWorkspaceFiles(workspaceRoot: string, fileCandidates: string[]): string[] {
  const root = normalizeAbsolutePath(workspaceRoot)
  return fileCandidates
    .map((candidate) => normalizeCandidatePath(root, candidate))
    .filter((candidate): candidate is string => Boolean(candidate))
    .map((candidate) => relativePathFromRoot(root, candidate))
    .filter((file, index, files) => file.length > 0 && files.indexOf(file) === index)
    .sort()
}

export function evaluateNativeCliToolPermission(
  toolCall: NativeCliToolCall,
  input: {
    workspaceRoot: string
    workspaceId: string
    decision?: PermissionBrokerDecision
  },
): PermissionBrokerResult {
  const workspaceRoot = normalizeAbsolutePath(input.workspaceRoot)
  const timestamp = toolCall.requestedAt ?? '1970-01-01T00:00:00.000Z'
  const normalizedTargets = [toolCall.cwd, ...(toolCall.targetPaths ?? [])].map((path) =>
    normalizeCandidatePath(workspaceRoot, path),
  )

  if (toolCall.workspaceId !== input.workspaceId) {
    return blockedPermissionResult(toolCall, {
      reason: 'Tool call workspace does not match the selected workspace.',
      workspaceRoot,
      targetPaths: [],
      timestamp,
      code: 'WORKSPACE_MISMATCH',
    })
  }

  if (normalizedTargets.some((path) => !path)) {
    return blockedPermissionResult(toolCall, {
      reason: 'Tool call targets a path outside the selected workspace root.',
      workspaceRoot,
      targetPaths: normalizedTargets.filter((path): path is string => Boolean(path)),
      timestamp,
      code: 'OUTSIDE_WORKSPACE_ROOT',
    })
  }

  const approval = createToolApproval(toolCall)
  const targetPaths = normalizedTargets as string[]

  if (!input.decision) {
    return {
      allowed: false,
      approval,
      code: 'APPROVAL_REQUIRED',
      events: [
        permissionEvent(toolCall, {
          kind: PermissionBrokerEventKind.ApprovalRequired,
          approvalId: approval.id,
          reason: 'Tool call requires product permission approval before execution.',
          workspaceRoot,
          targetPaths,
          timestamp,
        }),
      ],
    }
  }

  if (input.decision.status === 'rejected') {
    return {
      allowed: false,
      approval: decideToolApproval(approval, input.decision),
      code: 'APPROVAL_REJECTED',
      events: [
        permissionEvent(toolCall, {
          kind: PermissionBrokerEventKind.Rejected,
          approvalId: approval.id,
          reason: 'User rejected the permission request.',
          workspaceRoot,
          targetPaths,
          timestamp: input.decision.decidedAt ?? timestamp,
        }),
        permissionEvent(toolCall, {
          kind: PermissionBrokerEventKind.ExecutionBlocked,
          approvalId: approval.id,
          reason: 'Rejected permission prevents execution.',
          workspaceRoot,
          targetPaths,
          timestamp: input.decision.decidedAt ?? timestamp,
        }),
      ],
    }
  }

  return {
    allowed: true,
    approval: decideToolApproval(approval, input.decision),
    events: [
      permissionEvent(toolCall, {
        kind: PermissionBrokerEventKind.Approved,
        approvalId: approval.id,
        reason: 'User approved the permission request.',
        workspaceRoot,
        targetPaths,
        timestamp: input.decision.decidedAt ?? timestamp,
      }),
      permissionEvent(toolCall, {
        kind: PermissionBrokerEventKind.ExecutionAllowed,
        approvalId: approval.id,
        reason: 'Approved tool call is constrained to the selected workspace root.',
        workspaceRoot,
        targetPaths,
        timestamp: input.decision.decidedAt ?? timestamp,
      }),
    ],
  }
}

export function createArchitectDispatch(input: ArchitectDispatchInput): ArchitectDispatchResult {
  const targetRoleAgentIds = inferEngineeringRoleTargets(input.userMessage)
  const requiresEngineeringDispatch = targetRoleAgentIds.length > 0
  const planId = `plan-${input.sessionId}-architect`
  const mailboxId = `mailbox-${input.sessionId}-architect`

  if (!requiresEngineeringDispatch) {
    return {
      requiresEngineeringDispatch,
      planId,
      mailboxId,
      targetRoleAgentIds,
      events: [],
    }
  }

  const base = {
    workspaceId: input.workspaceId,
    sessionId: input.sessionId,
    planId,
    mailboxId,
    fromRoleAgentId: input.architectRoleAgentId,
  }

  return {
    requiresEngineeringDispatch,
    planId,
    mailboxId,
    targetRoleAgentIds,
    events: [
      {
        ...base,
        id: `dispatch-${planId}-created`,
        kind: RoleDispatchEventKind.PlanCreated,
        reason: 'Architect request requires structured engineering execution.',
      },
      {
        ...base,
        id: `dispatch-${mailboxId}-created`,
        kind: RoleDispatchEventKind.MailboxCreated,
        reason: 'Architect created a mailbox for downstream role handoff.',
      },
      ...targetRoleAgentIds.map((roleAgentId) => ({
        ...base,
        id: `dispatch-${planId}-${roleAgentId}`,
        kind: RoleDispatchEventKind.RoleDispatched,
        toRoleAgentId: roleAgentId,
        reason: 'Architect dispatched an engineering role for implementation work.',
      })),
    ],
  }
}

export function createAcceptancePlanSummary(input: {
  workspaceId: string
  sessionId: string
  userMessage: string
}) {
  const dispatch = createArchitectDispatch({
    workspaceId: input.workspaceId,
    sessionId: input.sessionId,
    architectRoleAgentId: 'role-architect',
    userMessage: input.userMessage,
  })

  return {
    id: dispatch.planId,
    runId: `run-${input.sessionId}-architect`,
    workspaceId: input.workspaceId,
    sessionId: input.sessionId,
    version: 1,
    summary: '架构师将简单计算器网站拆分为前端界面与 SQLite 历史记录后端实现。',
    status: 'validated',
    nodes: dispatch.targetRoleAgentIds.map((roleAgentId) => ({
      id: `node-${roleAgentId}`,
      title: roleAgentId === 'role-backend' ? '实现 SQLite 历史记录后端' : '实现加减乘除网站界面',
      roleAgentId,
      dependsOn: [],
      expectedArtifact: 'implementation-result',
      frIds: ['FR-ORCH-001', 'FR-RUNTIME-001', 'FR-PERM-001'],
      riskLevel: 'medium' as const,
      status: 'ready',
    })),
  }
}

function normalizeWorkspaceRoot(workspace: RuntimeWorkspace): string {
  const root = workspace.descriptor?.cloudProjectDir ?? workspace.descriptor?.rootPath
  if (!root) {
    throw new Error(WORKSPACE_ROOT_REQUIRED)
  }
  return normalizeAbsolutePath(root)
}

function normalizeCandidatePath(root: string, candidate: string): string | null {
  const normalized = candidate.startsWith('/')
    ? normalizeAbsolutePath(candidate)
    : normalizeAbsolutePath(`${root}/${candidate}`)
  return isPathInsideRoot(root, normalized) ? normalized : null
}

function normalizeAbsolutePath(path: string): string {
  if (!path.startsWith('/')) {
    throw new Error('ABSOLUTE_PATH_REQUIRED')
  }

  const parts: string[] = []
  for (const part of path.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') parts.pop()
    else parts.push(part)
  }
  return `/${parts.join('/')}`
}

function isPathInsideRoot(root: string, candidate: string): boolean {
  return candidate === root || candidate.startsWith(`${root}/`)
}

function relativePathFromRoot(root: string, candidate: string): string {
  return candidate === root ? '' : candidate.slice(root.length + 1)
}

function createToolApproval(toolCall: NativeCliToolCall): PendingApproval {
  return {
    id: `approval-${toolCall.id}`,
    sourceType: 'permission_escalation',
    sourceId: toolCall.runtimeInvocationId,
    status: 'pending',
    riskLevel: permissionRiskLevel(toolCall.actionKind),
  }
}

function decideToolApproval(
  approval: PendingApproval,
  decision: PermissionBrokerDecision,
): PendingApproval {
  return {
    ...approval,
    status: decision.status,
    decidedAt: new Date(decision.decidedAt ?? '1970-01-01T00:00:00.000Z'),
  }
}

function blockedPermissionResult(
  toolCall: NativeCliToolCall,
  input: {
    reason: string
    workspaceRoot: string
    targetPaths: string[]
    timestamp: string
    code: PermissionBrokerResult['code']
  },
): PermissionBrokerResult {
  return {
    allowed: false,
    code: input.code,
    events: [
      permissionEvent(toolCall, {
        kind: PermissionBrokerEventKind.ExecutionBlocked,
        reason: input.reason,
        workspaceRoot: input.workspaceRoot,
        targetPaths: input.targetPaths,
        timestamp: input.timestamp,
      }),
    ],
  }
}

function permissionEvent(
  toolCall: NativeCliToolCall,
  input: {
    kind: PermissionBrokerEventKind
    reason: string
    workspaceRoot: string
    targetPaths: string[]
    timestamp: string
    approvalId?: string
  },
): PermissionBrokerEvent {
  return {
    id: `permission-${toolCall.id}-${input.kind}`,
    workspaceId: toolCall.workspaceId,
    sessionId: toolCall.sessionId,
    runtimeInvocationId: toolCall.runtimeInvocationId,
    toolCallId: toolCall.id,
    actionKind: toolCall.actionKind,
    kind: input.kind,
    approvalId: input.approvalId,
    reason: input.reason,
    workspaceRoot: input.workspaceRoot,
    cwd: normalizeAbsolutePath(toolCall.cwd),
    targetPaths: input.targetPaths,
    commandPreview: toolCall.commandPreview,
    timestamp: input.timestamp,
  }
}

function permissionRiskLevel(actionKind: NativeCliToolActionKind): RiskLevel {
  if (
    actionKind === NativeCliToolActionKind.DestructiveCommand ||
    actionKind === NativeCliToolActionKind.WorkspaceExternalPathAccess
  ) {
    return 'high'
  }
  if (actionKind === NativeCliToolActionKind.ReadFile) {
    return 'low'
  }
  return 'medium'
}

function inferEngineeringRoleTargets(userMessage: string): string[] {
  const normalized = userMessage.toLowerCase()
  const targets = new Set<string>()
  if (
    normalized.includes('sqlite') ||
    normalized.includes('数据库') ||
    normalized.includes('存储') ||
    normalized.includes('后端') ||
    normalized.includes('api')
  ) {
    targets.add('role-backend')
  }
  if (
    normalized.includes('网站') ||
    normalized.includes('页面') ||
    normalized.includes('前端') ||
    normalized.includes('ui') ||
    normalized.includes('加减乘除')
  ) {
    targets.add('role-frontend')
  }
  return [...targets]
}
