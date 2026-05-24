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

// src/runtime/adapter.ts
var DEFAULT_ORCHESTRATOR_CONFIG = {
  maxConcurrent: 3,
  defaultRuntime: "claude_code",
  approvalRequired: (risk) => risk === "critical" || risk === "high"
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
  { action_type: "git_push", risk_level: "medium", requires_approval: true, description: "Git \u63A8\u9001" },
  { action_type: "deploy", risk_level: "high", requires_approval: true, description: "\u90E8\u7F72\u64CD\u4F5C" }
];
export {
  DEFAULT_ORCHESTRATOR_CONFIG,
  DEFAULT_POLICIES,
  FR_IDS,
  SeqGenerator,
  parseFrame,
  serializeFrame
};
