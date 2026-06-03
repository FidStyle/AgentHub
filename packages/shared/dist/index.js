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
      content = appendRuntimeDelta(content, event.delta ?? "");
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
  const activeSessions = new Set(
    ordered.filter((item) => item.direction === "inbound" && ACTIVE_MAILBOX_STATUSES.has(item.status)).map((item) => item.session_id)
  );
  const selectedSessions = /* @__PURE__ */ new Set();
  return ordered.filter((item) => {
    if (item.direction !== "inbound" || item.status !== "queued") return false;
    if (activeSessions.has(item.session_id)) return false;
    if (selectedSessions.has(item.session_id)) return false;
    selectedSessions.add(item.session_id);
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
  RuntimeErrorCode,
  SeqGenerator,
  appendRuntimeDelta,
  colors,
  createRuntimeOutputAccumulator,
  nextPlanNodeAttemptDraft,
  parseFrame,
  selectReadyMailboxItems,
  serializeFrame
};
