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
export {
  DEFAULT_ORCHESTRATOR_CONFIG,
  FR_IDS
};
