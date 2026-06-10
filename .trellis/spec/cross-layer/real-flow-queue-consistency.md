# Real Flow Queue Consistency Contract

## Scenario: Plan Node Terminal Queue Consistency

### 1. Scope / Trigger

- Trigger: modifying plan nodes, mailbox dispatch, runtime terminal handlers, retry/resume/requeue/cancel APIs, or approval continuation.

### 2. Signatures

- `plan_nodes.status`: terminal values include `completed`, `failed`, `cancelled`, `skipped`, `blocked`.
- `plan_node_attempts.status` / `agent_mailbox_items.status`: active values are `queued`, `running`, `waiting`; terminal values are `completed`, `failed`, `cancelled`, `dead_letter`.
- `POST /api/mailbox/dispatch-ready`
- `POST /api/plan-nodes/:id/resume|retry|requeue|cancel`

### 3. Contracts

- A terminal plan node must not leave same-node queued/waiting attempts or mailbox items dispatchable.
- Retry/resume/requeue supersedes old same-node active queue rows before inserting new work.
- Dispatch-ready must reconcile terminal plan nodes before selecting ready mailbox rows.
- Web/Mobile plan supervision must not show a completed plan while latest attempt/mailbox remains active.
- `/api/chat` must not emit SSE `done` while the current plan still has `ready`, `pending`, `queued`, or `running` nodes, or while same-session `runtime_sessions.status="running"` remains. If a runtime subscription ends without `runtime_completed`, `runtime_failed`, or `runtime_waiting`, fail closed: mark active plan nodes/runtime rows failed, write a visible failure event, and only then close the SSE stream.

### 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| Completed node has queued mailbox | dispatch-ready marks it terminal and dispatches nothing |
| Resume waiting node | old active rows become cancelled before new queued row |
| Approved action completes node | stale same-node active rows close |
| SSE stream closes without runtime terminal event | active plan/runtime rows fail closed before `done` is emitted |

### 5. Good/Base/Bad Cases

- Good: Final architect node completes and all same-node attempts/mailbox rows are terminal.
- Good: SSE `done` means the plan is completed, failed, or waiting with durable DB state; refresh shows the same terminal/waiting state.
- Bad: UI says plan completed while dispatch-ready can still run old queued work.
- Bad: SSE emits `done` while a runtime session is still `running` and downstream artifact nodes remain `pending`.

### 6. Tests Required

- Runtime worker terminal update test.
- Plan-node control superseding test.
- Mailbox dispatch reconciliation test.
- Web/Mobile readback consistency test when claiming final pass.

### 7. Wrong vs Correct

#### Wrong

- Plan completed; latest attempt still queued.

#### Correct

- Plan completed; old queued/waiting rows are completed or cancelled.
