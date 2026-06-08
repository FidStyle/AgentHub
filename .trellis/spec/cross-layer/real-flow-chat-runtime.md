# Real Flow Chat Runtime Contract

## Scenario: Local / Cloud Chat, Role, Attachment, Artifact

### 1. Scope / Trigger

- Trigger: modifying `/api/chat`, message persistence, role dispatch, runtime gateway, attachments, or artifact creation.
- Applies to: Web, Mobile/PWA readback, Desktop connector state, runtime sessions/logs, `messages`, `attachments`, and `artifacts`.

### 2. Signatures

- `POST /api/chat`: `{ workspaceId, sessionId, content, roleAgentId?, roleAgentIds?, attachmentIds?, permissionMode? }`
- `GET /api/role-agents`: returns `id`, `name`, `role_type`, `capability_tags`, `runtime_type`, `is_orchestrator`.
- `POST /api/attachments`: persists file content or durable content ref.
- Runtime events: `runtime_status`, `runtime_output.delta`, `agent_message`, `artifact_created`, terminal event.

### 3. Contracts

- Web sends from the real chat entrypoint; internal function calls do not count as acceptance.
- `local_desktop` routes through DeviceChannel/Electron or returns a visible offline/auth/install error.
- `cloud` routes through Gateway/worker and writes `runtime_sessions` plus `runtime_logs`.
- `@角色` uses real role IDs and persists `messages.role_agent_id`.
- A mentioned custom role must create a visible, task-specific acknowledgement message.
- Attachments must be persisted and passed to runtime by durable ref or content summary.
- Artifacts must be stored in `artifacts` or a workspace file ref; chat-only text is not a durable artifact.

### 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| Local desktop disconnected | visible Chinese error; no fake agent success |
| Cloud worker unavailable | `endpoint_unavailable` or equivalent visible failure |
| Mentioned role missing | `403 角色不存在或无权限` |
| Attachment content unreadable | fail visibly before claiming runtime context |
| Artifact created | `artifacts` row or stable content ref can be reread |

### 5. Good/Base/Bad Cases

- Good: Send `@前端工程师` from Web, see role ack, runtime output, durable agent message, and refresh readback.
- Base: Runtime unavailable returns an actionable error and the plan remains failed/blocked.
- Bad: `/api/chat` returns hardcoded assistant text without runtime/session evidence.

### 6. Tests Required

- API tests for role ID persistence and unavailable runtime failure.
- DB tests for messages, runtime session/log, attachment ref, and artifact row.
- UI tests that reload and verify role badge, attachment/artifact card, and error state.

### 7. Wrong vs Correct

#### Wrong

- Return "done" from `/api/chat` while no runtime session or agent message exists.

#### Correct

- Persist runtime status/logs, then persist the agent message or a visible failure reason.
