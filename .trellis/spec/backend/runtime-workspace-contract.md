# Runtime Workspace Contract

## Scenario: Selected Workspace Runtime Isolation

### 1. Scope / Trigger

- Trigger: modifying runtime cwd, approved native tools, workspace file writes, permission continuation, or mobile approval readback.

### 2. Signatures

- Runtime invoke input: `{ workspaceId, sessionId, roleAgentId?, cwd?, prompt, attachmentRefs? }`
- Approved native tool metadata: `{ workspaceRoot, cwd, targetPaths[], commandPreview, runtimeSessionId, nativeSessionId? }`
- Mobile approval readback: same action IDs and statuses as Web.

### 3. Contracts

- Runtime cwd must be the selected workspace root or a validated child path.
- No runtime/tool path may read or write the AgentHub host repo unless that repo is the selected workspace.
- Approved native tool continuation must preserve original runtime/session/action IDs.
- Permission approval state is separate from tool execution state.
- Mobile/PWA can approve/reject/read status; complex editing remains Web/Desktop.
- Native user-question tool requests must create a visible waiting state and resume only after user input.

### 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| `cwd` outside workspace | reject before execution |
| `targetPaths` outside workspace | reject before approval continuation |
| Approved action lacks native tool metadata | fail visibly, do not execute |
| Mobile approves action | Web/Mobile readback show same durable status |
| User rejects tool question | action/node waits or fails closed; no side effect |

### 5. Good/Base/Bad Cases

- Good: A write-file approval resumes the original runtime action inside selected workspace and updates the same action card.
- Base: Runtime asks the user a question; UI shows waiting and resumes after the answer.
- Bad: Approval card says `执行中` as the approval decision.
- Bad: Runtime writes to the host repository because workspace root was missing.

### 6. Tests Required

- Workspace root/path validation unit tests.
- Approved native tool continuation integration tests.
- Permission label/status mapping tests.
- Mobile readback test for approval/reject status.
- Native user-question wait/resume test.

### 7. Wrong vs Correct

#### Wrong

- Use `process.cwd()` as runtime cwd when workspace root is absent.

#### Correct

- Fail before execution unless a selected workspace root is available and validated.
