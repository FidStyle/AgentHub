// src/domain/runtime-workspace.ts
var WORKSPACE_ROOT_REQUIRED = "WORKSPACE_ROOT_REQUIRED";
var SELECTED_WORKSPACE_NOT_FOUND = "SELECTED_WORKSPACE_NOT_FOUND";
var RUNTIME_CWD_MISMATCH = "RUNTIME_CWD_MISMATCH";
var PermissionBrokerEventKind = {
  ApprovalRequired: "approval_required",
  Rejected: "rejected",
  Approved: "approved",
  ExecutionAllowed: "execution_allowed",
  ExecutionBlocked: "execution_blocked"
};
var RoleDispatchEventKind = {
  PlanCreated: "plan_created",
  MailboxCreated: "mailbox_created",
  RoleDispatched: "role_dispatched"
};
var NativeCliToolActionKind = {
  ReadFile: "read_file",
  WriteFile: "write_file",
  InstallDependency: "install_dependency",
  StartService: "start_service",
  NetworkRequest: "network_request",
  WorkspaceExternalPathAccess: "workspace_external_path_access",
  DestructiveCommand: "destructive_command",
  ShellCommand: "shell_command"
};
function resolveSelectedWorkspaceScope(workspaces, selectedWorkspaceId, fileCandidates = []) {
  const workspace = workspaces.find((item) => item.id === selectedWorkspaceId);
  if (!workspace) {
    throw new Error(SELECTED_WORKSPACE_NOT_FOUND);
  }
  const workspaceRoot = normalizeWorkspaceRoot(workspace);
  return {
    workspaceId: workspace.id,
    executionDomain: workspace.executionDomain,
    workspaceRoot,
    cwd: workspaceRoot,
    visibleFiles: visibleWorkspaceFiles(workspaceRoot, fileCandidates)
  };
}
function createRuntimeInvokeInputFromChat(input) {
  const scope = resolveSelectedWorkspaceScope(
    input.workspaces,
    input.selectedWorkspaceId,
    input.fileCandidates
  );
  const contextPackage = {
    id: `ctx-${input.selectedWorkspaceId}-${input.sessionId}-${input.roleAgentId}`,
    workspaceId: scope.workspaceId,
    sessionId: input.sessionId,
    roleAgentId: input.roleAgentId,
    workspaceRoot: scope.workspaceRoot,
    messages: [...input.messages ?? [input.userMessage]],
    artifacts: [...input.artifacts ?? []],
    files: [...scope.visibleFiles],
    visibleFiles: [...scope.visibleFiles],
    constraints: [
      "Only use files visible inside the selected workspace root.",
      "Do not infer stack, package manager, AGENTS.md, Trellis, or monorepo context from the AgentHub host repository.",
      ...input.constraints ?? []
    ]
  };
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
    nativeSessionId: input.nativeSessionId
  };
}
function assertRuntimeCwdMatchesWorkspaceRoot(input) {
  if (normalizeAbsolutePath(input.cwd) !== normalizeAbsolutePath(input.workspaceRoot)) {
    throw new Error(RUNTIME_CWD_MISMATCH);
  }
}
function createRuntimeWorkerJob(input) {
  assertRuntimeCwdMatchesWorkspaceRoot(input);
  return {
    id: `worker-${input.workspaceId}-${input.sessionId}-${input.roleAgentId}`,
    workspaceId: input.workspaceId,
    sessionId: input.sessionId,
    roleAgentId: input.roleAgentId,
    runtimeType: input.runtimeType,
    executionDomain: input.executionDomain,
    workspaceRoot: input.workspaceRoot,
    cwd: input.cwd,
    runtimeInvocationContextId: input.contextPackage.id
  };
}
function visibleWorkspaceFiles(workspaceRoot, fileCandidates) {
  const root = normalizeAbsolutePath(workspaceRoot);
  return fileCandidates.map((candidate) => normalizeCandidatePath(root, candidate)).filter((candidate) => Boolean(candidate)).map((candidate) => relativePathFromRoot(root, candidate)).filter((file, index, files) => file.length > 0 && files.indexOf(file) === index).sort();
}
function evaluateNativeCliToolPermission(toolCall, input) {
  const workspaceRoot = normalizeAbsolutePath(input.workspaceRoot);
  const timestamp = toolCall.requestedAt ?? "1970-01-01T00:00:00.000Z";
  const normalizedTargets = [toolCall.cwd, ...toolCall.targetPaths ?? []].map(
    (path) => normalizeCandidatePath(workspaceRoot, path)
  );
  if (toolCall.workspaceId !== input.workspaceId) {
    return blockedPermissionResult(toolCall, {
      reason: "Tool call workspace does not match the selected workspace.",
      workspaceRoot,
      targetPaths: [],
      timestamp,
      code: "WORKSPACE_MISMATCH"
    });
  }
  if (normalizedTargets.some((path) => !path)) {
    return blockedPermissionResult(toolCall, {
      reason: "Tool call targets a path outside the selected workspace root.",
      workspaceRoot,
      targetPaths: normalizedTargets.filter((path) => Boolean(path)),
      timestamp,
      code: "OUTSIDE_WORKSPACE_ROOT"
    });
  }
  const approval = createToolApproval(toolCall);
  const targetPaths = normalizedTargets;
  if (!input.decision) {
    return {
      allowed: false,
      approval,
      code: "APPROVAL_REQUIRED",
      events: [
        permissionEvent(toolCall, {
          kind: PermissionBrokerEventKind.ApprovalRequired,
          approvalId: approval.id,
          reason: "Tool call requires product permission approval before execution.",
          workspaceRoot,
          targetPaths,
          timestamp
        })
      ]
    };
  }
  if (input.decision.status === "rejected") {
    return {
      allowed: false,
      approval: decideToolApproval(approval, input.decision),
      code: "APPROVAL_REJECTED",
      events: [
        permissionEvent(toolCall, {
          kind: PermissionBrokerEventKind.Rejected,
          approvalId: approval.id,
          reason: "User rejected the permission request.",
          workspaceRoot,
          targetPaths,
          timestamp: input.decision.decidedAt ?? timestamp
        }),
        permissionEvent(toolCall, {
          kind: PermissionBrokerEventKind.ExecutionBlocked,
          approvalId: approval.id,
          reason: "Rejected permission prevents execution.",
          workspaceRoot,
          targetPaths,
          timestamp: input.decision.decidedAt ?? timestamp
        })
      ]
    };
  }
  return {
    allowed: true,
    approval: decideToolApproval(approval, input.decision),
    events: [
      permissionEvent(toolCall, {
        kind: PermissionBrokerEventKind.Approved,
        approvalId: approval.id,
        reason: "User approved the permission request.",
        workspaceRoot,
        targetPaths,
        timestamp: input.decision.decidedAt ?? timestamp
      }),
      permissionEvent(toolCall, {
        kind: PermissionBrokerEventKind.ExecutionAllowed,
        approvalId: approval.id,
        reason: "Approved tool call is constrained to the selected workspace root.",
        workspaceRoot,
        targetPaths,
        timestamp: input.decision.decidedAt ?? timestamp
      })
    ]
  };
}
function createArchitectDispatch(input) {
  const targetRoleAgentIds = inferEngineeringRoleTargets(input.userMessage);
  const requiresEngineeringDispatch = targetRoleAgentIds.length > 0;
  const planId = `plan-${input.sessionId}-architect`;
  const mailboxId = `mailbox-${input.sessionId}-architect`;
  if (!requiresEngineeringDispatch) {
    return {
      requiresEngineeringDispatch,
      planId,
      mailboxId,
      targetRoleAgentIds,
      events: []
    };
  }
  const base = {
    workspaceId: input.workspaceId,
    sessionId: input.sessionId,
    planId,
    mailboxId,
    fromRoleAgentId: input.architectRoleAgentId
  };
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
        reason: "Architect request requires structured engineering execution."
      },
      {
        ...base,
        id: `dispatch-${mailboxId}-created`,
        kind: RoleDispatchEventKind.MailboxCreated,
        reason: "Architect created a mailbox for downstream role handoff."
      },
      ...targetRoleAgentIds.map((roleAgentId) => ({
        ...base,
        id: `dispatch-${planId}-${roleAgentId}`,
        kind: RoleDispatchEventKind.RoleDispatched,
        toRoleAgentId: roleAgentId,
        reason: "Architect dispatched an engineering role for implementation work."
      }))
    ]
  };
}
function createAcceptancePlanSummary(input) {
  const dispatch = createArchitectDispatch({
    workspaceId: input.workspaceId,
    sessionId: input.sessionId,
    architectRoleAgentId: "role-architect",
    userMessage: input.userMessage
  });
  return {
    id: dispatch.planId,
    runId: `run-${input.sessionId}-architect`,
    workspaceId: input.workspaceId,
    sessionId: input.sessionId,
    version: 1,
    summary: "\u67B6\u6784\u5E08\u5C06\u7B80\u5355\u8BA1\u7B97\u5668\u7F51\u7AD9\u62C6\u5206\u4E3A\u524D\u7AEF\u754C\u9762\u4E0E SQLite \u5386\u53F2\u8BB0\u5F55\u540E\u7AEF\u5B9E\u73B0\u3002",
    status: "validated",
    nodes: dispatch.targetRoleAgentIds.map((roleAgentId) => ({
      id: `node-${roleAgentId}`,
      title: roleAgentId === "role-backend" ? "\u5B9E\u73B0 SQLite \u5386\u53F2\u8BB0\u5F55\u540E\u7AEF" : "\u5B9E\u73B0\u52A0\u51CF\u4E58\u9664\u7F51\u7AD9\u754C\u9762",
      roleAgentId,
      dependsOn: [],
      expectedArtifact: "implementation-result",
      frIds: ["FR-ORCH-001", "FR-RUNTIME-001", "FR-PERM-001"],
      riskLevel: "medium",
      status: "ready"
    }))
  };
}
function normalizeWorkspaceRoot(workspace) {
  const root = workspace.descriptor?.cloudProjectDir ?? workspace.descriptor?.rootPath;
  if (!root) {
    throw new Error(WORKSPACE_ROOT_REQUIRED);
  }
  return normalizeAbsolutePath(root);
}
function normalizeCandidatePath(root, candidate) {
  const normalized = candidate.startsWith("/") ? normalizeAbsolutePath(candidate) : normalizeAbsolutePath(`${root}/${candidate}`);
  return isPathInsideRoot(root, normalized) ? normalized : null;
}
function normalizeAbsolutePath(path) {
  if (!path.startsWith("/")) {
    throw new Error("ABSOLUTE_PATH_REQUIRED");
  }
  const parts = [];
  for (const part of path.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") parts.pop();
    else parts.push(part);
  }
  return `/${parts.join("/")}`;
}
function isPathInsideRoot(root, candidate) {
  return candidate === root || candidate.startsWith(`${root}/`);
}
function relativePathFromRoot(root, candidate) {
  return candidate === root ? "" : candidate.slice(root.length + 1);
}
function createToolApproval(toolCall) {
  return {
    id: `approval-${toolCall.id}`,
    sourceType: "permission_escalation",
    sourceId: toolCall.runtimeInvocationId,
    status: "pending",
    riskLevel: permissionRiskLevel(toolCall.actionKind)
  };
}
function decideToolApproval(approval, decision) {
  return {
    ...approval,
    status: decision.status,
    decidedAt: new Date(decision.decidedAt ?? "1970-01-01T00:00:00.000Z")
  };
}
function blockedPermissionResult(toolCall, input) {
  return {
    allowed: false,
    code: input.code,
    events: [
      permissionEvent(toolCall, {
        kind: PermissionBrokerEventKind.ExecutionBlocked,
        reason: input.reason,
        workspaceRoot: input.workspaceRoot,
        targetPaths: input.targetPaths,
        timestamp: input.timestamp
      })
    ]
  };
}
function permissionEvent(toolCall, input) {
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
    timestamp: input.timestamp
  };
}
function permissionRiskLevel(actionKind) {
  if (actionKind === NativeCliToolActionKind.DestructiveCommand || actionKind === NativeCliToolActionKind.WorkspaceExternalPathAccess) {
    return "high";
  }
  if (actionKind === NativeCliToolActionKind.ReadFile) {
    return "low";
  }
  return "medium";
}
function inferEngineeringRoleTargets(userMessage) {
  const normalized = userMessage.toLowerCase();
  const targets = /* @__PURE__ */ new Set();
  if (normalized.includes("sqlite") || normalized.includes("\u6570\u636E\u5E93") || normalized.includes("\u5B58\u50A8") || normalized.includes("\u540E\u7AEF") || normalized.includes("api")) {
    targets.add("role-backend");
  }
  if (normalized.includes("\u7F51\u7AD9") || normalized.includes("\u9875\u9762") || normalized.includes("\u524D\u7AEF") || normalized.includes("ui") || normalized.includes("\u52A0\u51CF\u4E58\u9664")) {
    targets.add("role-frontend");
  }
  return [...targets];
}

// src/constants/fr-ids.ts
var FR_IDS = {
  AUTH_001: "FR-AUTH-001",
  WS_001: "FR-WS-001",
  DEVICE_001: "FR-DEVICE-001",
  WEB_001: "FR-WEB-001",
  DESK_001: "FR-DESK-001",
  MOB_001: "FR-MOB-001",
  CHAT_001: "FR-CHAT-001",
  AGENT_001: "FR-AGENT-001",
  RUNTIME_001: "FR-RUNTIME-001",
  ORCH_001: "FR-ORCH-001",
  CTX_001: "FR-CTX-001",
  ARTIFACT_001: "FR-ARTIFACT-001",
  RESULT_001: "FR-RESULT-001",
  ACTION_001: "FR-ACTION-001",
  PERM_001: "FR-PERM-001",
  NOTIFY_001: "FR-NOTIFY-001"
};

// src/constants/colors.ts
var colors = {
  primary: "hsl(222.2, 47.4%, 11.2%)",
  primaryForeground: "hsl(210, 40%, 98%)",
  muted: "hsl(210, 40%, 96.1%)",
  mutedForeground: "hsl(215.4, 16.3%, 46.9%)",
  border: "hsl(214.3, 31.8%, 91.4%)",
  background: "hsl(0, 0%, 100%)",
  card: "hsl(0, 0%, 100%)",
  success: "hsl(142, 71%, 45%)",
  destructive: "hsl(0, 84.2%, 60.2%)",
  accent: "hsl(210, 40%, 96.1%)"
};

// src/runtime/adapter.ts
var DEFAULT_ORCHESTRATOR_CONFIG = {
  maxConcurrent: 3,
  defaultRuntime: "claude_code",
  approvalRequired: (risk) => risk === "critical" || risk === "high"
};

// src/runtime/output-accumulator.ts
function commonRawOverlapLength(left, right) {
  const max = Math.min(left.length, right.length);
  for (let length = max; length > 0; length--) {
    if (left.slice(-length) === right.slice(0, length)) return length;
  }
  return 0;
}
function appendRuntimeDelta(current, delta) {
  if (!delta) return current;
  if (!current) return delta;
  if (current.endsWith(delta)) return current;
  const overlap = commonRawOverlapLength(current, delta);
  return overlap > 0 ? current + delta.slice(overlap) : current + delta;
}
function createRuntimeOutputAccumulator(initialContent = "") {
  let content = initialContent;
  let lastSeq = 0;
  return {
    append(eventOrDelta) {
      const event = typeof eventOrDelta === "string" ? { type: "runtime_output", delta: eventOrDelta } : eventOrDelta;
      if (typeof event.seq === "number") {
        if (event.seq <= lastSeq) return content;
        lastSeq = event.seq;
      }
      if (event.mode === "replace") {
        content = event.delta ?? "";
        return content;
      }
      const delta = event.delta ?? "";
      if (event.mode === "append" || typeof event.seq === "number") {
        content += delta;
        return content;
      }
      content = appendRuntimeDelta(content, delta);
      return content;
    },
    value() {
      return content;
    }
  };
}

// src/runtime/error-codes.ts
var RuntimeErrorCode = {
  DEVICE_OFFLINE: "DEVICE_OFFLINE",
  ENDPOINT_UNAVAILABLE: "endpoint_unavailable",
  PUBLIC_RUNTIME_UNCONFIGURED: "public_runtime_unconfigured",
  TUNNEL_DISCONNECTED: "tunnel_disconnected"
};

// src/protocol/frames.ts
function serializeFrame(frame) {
  return JSON.stringify(frame);
}
function parseFrame(data) {
  try {
    const parsed = JSON.parse(data);
    if (parsed && typeof parsed.type === "string" && typeof parsed.seq === "number") {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}
var SeqGenerator = class {
  seq = 0;
  next() {
    return ++this.seq;
  }
  reset() {
    this.seq = 0;
  }
};

// src/orchestrator/action.ts
var DEFAULT_POLICIES = [
  { action_type: "shell", risk_level: "low", requires_approval: false, description: "\u4F4E\u98CE\u9669 shell \u547D\u4EE4" },
  { action_type: "shell", risk_level: "medium", requires_approval: false, description: "\u4E2D\u98CE\u9669 shell \u547D\u4EE4" },
  { action_type: "shell", risk_level: "high", requires_approval: true, description: "\u9AD8\u98CE\u9669 shell \u547D\u4EE4" },
  { action_type: "file_write", risk_level: "low", requires_approval: false, description: "\u6587\u4EF6\u5199\u5165" },
  { action_type: "file_write", risk_level: "high", requires_approval: true, description: "\u9AD8\u98CE\u9669\u6587\u4EF6\u5199\u5165" },
  { action_type: "git_stage", risk_level: "low", requires_approval: false, description: "Git \u6682\u5B58" },
  { action_type: "git_unstage", risk_level: "low", requires_approval: false, description: "Git \u53D6\u6D88\u6682\u5B58" },
  { action_type: "git_discard", risk_level: "high", requires_approval: true, description: "\u4E22\u5F03 Git \u5DE5\u4F5C\u533A\u6539\u52A8" },
  { action_type: "git_push", risk_level: "medium", requires_approval: true, description: "Git \u63A8\u9001" },
  { action_type: "deploy", risk_level: "high", requires_approval: true, description: "\u90E8\u7F72\u64CD\u4F5C" }
];

// src/orchestrator/mailbox.ts
var ACTIVE_MAILBOX_STATUSES = /* @__PURE__ */ new Set(["running", "waiting"]);
function timestampMillis(value) {
  if (value instanceof Date) return value.getTime();
  return Date.parse(value);
}
function selectReadyMailboxItems(items) {
  const ordered = [...items].sort((a, b) => timestampMillis(a.created_at) - timestampMillis(b.created_at));
  const activeRoleQueues = new Set(
    ordered.filter((item) => item.direction === "inbound" && ACTIVE_MAILBOX_STATUSES.has(item.status)).map((item) => `${item.session_id}:${item.to_role_agent_id}`)
  );
  const selectedRoleQueues = /* @__PURE__ */ new Set();
  return ordered.filter((item) => {
    if (item.direction !== "inbound" || item.status !== "queued") return false;
    const queueKey = `${item.session_id}:${item.to_role_agent_id}`;
    if (activeRoleQueues.has(queueKey)) return false;
    if (selectedRoleQueues.has(queueKey)) return false;
    selectedRoleQueues.add(queueKey);
    return true;
  });
}
function nextPlanNodeAttemptDraft(input) {
  const previous = input.attempts.filter((attempt) => attempt.plan_node_id === input.planNodeId).sort((a, b) => b.attempt_number - a.attempt_number)[0];
  return {
    plan_node_id: input.planNodeId,
    attempt_number: (previous?.attempt_number ?? 0) + 1,
    control: input.control,
    previous_attempt_id: previous?.id ?? null,
    status: input.control === "cancel" ? "cancelled" : "queued"
  };
}
export {
  DEFAULT_ORCHESTRATOR_CONFIG,
  DEFAULT_POLICIES,
  FR_IDS,
  NativeCliToolActionKind,
  PermissionBrokerEventKind,
  RUNTIME_CWD_MISMATCH,
  RoleDispatchEventKind,
  RuntimeErrorCode,
  SELECTED_WORKSPACE_NOT_FOUND,
  SeqGenerator,
  WORKSPACE_ROOT_REQUIRED,
  appendRuntimeDelta,
  assertRuntimeCwdMatchesWorkspaceRoot,
  colors,
  createAcceptancePlanSummary,
  createArchitectDispatch,
  createRuntimeInvokeInputFromChat,
  createRuntimeOutputAccumulator,
  createRuntimeWorkerJob,
  evaluateNativeCliToolPermission,
  nextPlanNodeAttemptDraft,
  parseFrame,
  resolveSelectedWorkspaceScope,
  selectReadyMailboxItems,
  serializeFrame,
  visibleWorkspaceFiles
};
