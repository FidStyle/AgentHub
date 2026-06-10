# Runtime Gateway Permission Wait Contract

## Scenario: Non-Full-Control Runtime Permission Boundary

### 1. Scope / Trigger

- Trigger: modifying Runtime permission modes, native CLI tool approval, `subscribeEvents`, `/api/chat` streaming, action approval, plan node waiting state, or frontend permission cards.

### 2. Signatures

- Runtime job input: `RuntimeJob.permissionMode?: string | null`.
- Waiting event: `{ type: "runtime_waiting", reason: string, waitingFor: "approval" | "question" | "continuation" }`.
- Approval event: `{ type: "approval_requested", actionId, description, riskLevel, actionKind, workspaceRoot, cwd, targetPaths, commandPreview }`.
- Durable rows: `actions.status="pending"`, `plan_nodes.status="waiting"`, `plan_node_attempts.status="waiting"`, `agent_mailbox_items.status="waiting"`, `runtime_sessions.status="waiting"`.

### 3. Contracts

- Only `permissionMode="full_control"` and `permissionMode="dangerous_bypass"` may auto-approve native CLI tool execution.
- `standard`, `sandbox`, `auto`, null, and unknown modes must create a pending action and visible permission card before side effects execute.
- Codex `file_change` events are observed after the CLI has started applying workspace changes and do not carry replayable file content. Do not use non-automatic Codex `file_change` observed actions as the first approval boundary. For orchestrated Codex runtime nodes, ready mailbox dispatch, and standard/manual/auto non-automatic modes, create a `runtime_invoke_preapproval` action before starting the runtime; approval runs that specific node with `permissionMode="full_control"` and preserves the original plan node/attempt/mailbox IDs.
- Manual permission branch verifiers must run with a real runtime executor and live runtime worker. A preflight such as `real runtime executor and live runtime worker are required` is a failed acceptance run, not a skipped product state.
- Full-control auto-approved native CLI activity must still produce durable IM permission parts with `autoApproved: true`, `status: "completed"` or `"failed"`, and `permissionMode`, so Web/Mobile refresh readback shows the audit card instead of hiding the action in backend logs.
- A permission or user-question boundary is not a runtime failure. Emit `approval_requested` or `question`, then emit `runtime_waiting` so Redis/SSE subscribers terminate without timeout.
- Do not emit `runtime_failed` for permission wait boundaries. Real unavailable, timeout, path escape, and executor errors must still emit `runtime_failed`.
- Approved continuations must preserve original action/runtime metadata. If the continuation hits a second permission or question, the approved action remains `completed` while the plan node/attempt/mailbox return to `waiting`.

### 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| Non-full-control tool request | Persist pending action, emit `approval_requested`, mark rows waiting, emit `runtime_waiting` |
| Non-full-control orchestrated Codex runtime node | Persist pending `actions.action_type="runtime_invoke"` with `result.source="runtime_invoke_preapproval"`, mark plan node/attempt/mailbox waiting, emit or persist permission card, and do not start the CLI until approval |
| Approved `runtime_invoke_preapproval` | Queue the approved node with `permissionMode="full_control"`, mark the same action running/completed, and let plan progress dispatch the next ready node |
| User question request | Emit `question`, mark rows waiting, emit `runtime_waiting` |
| Full-control tool request | Persist completed auto-approved action, emit durable IM auto-approval card, and continue inline |
| Full-control observed CLI action | Persist completed/failed audit action and runtime permission part with `autoApproved: true` |
| Runtime CLI missing or times out | Emit `runtime_failed`, mark runtime/session rows failed |
| Approved continuation reaches next permission | Previous action stays completed; new action pending; node waits |
| Manual permission UAT lacks live runtime worker or real executor | Fail preflight and reopen the permission blocker |
| Manual permission prompt is routed to Agent draft creation | Fail the permission branch; the verifier did not exercise approval_requested/allow/reject |

### 5. Good/Base/Bad Cases

- Good: Standard mode shows `message-permission-card`; refresh/API readback shows the same pending action and waiting node.
- Good: In a multi-node standard Codex run, the user can approve successive `runtime_invoke_preapproval` cards; each approved node runs, downstream nodes become ready, and the plan can complete without any pre-approval file side effect.
- Base: Full-control canonical product delivery has no manual pending permission card and still has action audit rows plus auto-approved IM permission cards.
- Bad: `approval_requested` is followed by `runtime_failed` and the UI displays "运行时执行失败".
- Bad: Redis subscription times out after a permission card because no terminal wait event was emitted.
- Bad: A permission allow/reject verifier only produces an `agent_draft` result card and never creates `approval_requested`.

### 6. Tests Required

- Worker unit test: non-full-control tool request returns `waiting`, emits `approval_requested` + `runtime_waiting`, not `runtime_failed`.
- Redis unit test: `runtime_waiting` is a terminal subscription boundary and does not produce timeout failure.
- API chat test: question/permission wait persists message parts and visible status `等待授权`.
- Store/component test: permission cards render without duplicate cards and without a failure notice.
- Full-control regression: auto-approved actions continue, durable IM cards have `autoApproved: true`, and the product delivery path completes.
- Manual branch regression: prompts used for allow/reject must be classified as implementation/tool-action requests, not conversational Agent creation requests.
- Standard Codex regression: a fresh allow branch must keep approving pending actions until the plan is `completed`, verify the target file content, and verify reject leaves no side effect file.

### 7. Wrong vs Correct

#### Wrong

`approval_requested` is emitted, the worker throws, marks `runtime_sessions.status="failed"`, and emits `runtime_failed`.

#### Correct

`approval_requested` is emitted, durable queue rows become `waiting`, `runtime_sessions.status="waiting"`, and the stream ends with `runtime_waiting`.

#### Wrong

A standard multi-agent Codex run starts the CLI in `workspace-write` and treats the later `file_change` observed event as a user-approvable action.

#### Correct

The plan node creates a `runtime_invoke_preapproval` action before CLI startup. Approval starts that node in `full_control`; rejection leaves the node waiting and produces no file or command side effect.
