# Runtime Gateway Worker Contract

## Scenario: Worker Liveness, Queue, Logs

### 1. Scope / Trigger

- Trigger: modifying Redis queue, runtime worker heartbeat, runtime logs, or job terminal handling.

### 2. Signatures

- Env: `REDIS_URL`
- Tables: `runtime_sessions`, `runtime_logs`
- Events: `runtime_status`, `runtime_output.delta`, `runtime_completed`, `runtime_failed`.

### 3. Contracts

- If queue or worker is not alive, authorized runtime work fails visibly before claiming execution.
- Each attempted job writes a runtime session and logs meaningful terminal state.
- Runtime logs are append-only evidence; UI can summarize, not invent.

### 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| Missing `REDIS_URL` | action/chat reports worker unavailable |
| Worker heartbeat stale | do not enqueue as completed |
| Runtime exits non-zero | persist failed status and error |

### 5. Good/Base/Bad Cases

- Good: Worker consumes job, streams logs, and marks session completed/failed.
- Bad: Runtime worker failure is hidden behind "已完成".

### 6. Tests Required

- Worker liveness unit/API tests.
- Runtime log persistence tests.
- Terminal failure readback test.

### 7. Wrong vs Correct

#### Wrong

- No worker, but action status becomes completed.

#### Correct

- No worker, action/runtime status becomes unavailable/failed with Chinese reason.

## Scenario: Native Runtime Observed Tool Failure Recovery

### 1. Scope / Trigger

- Trigger: modifying native Runtime observed actions, full-control/auto-approved tool audit, runtime terminal handling, or plan-node failure semantics.

### 2. Signatures

- Runtime chunk: `{ observedAction: { status: "running" | "completed" | "failed", commandPreview?, output?, exitCode? } }`
- Events: `runtime_observed_action`, `runtime_output`, `runtime_completed`, `runtime_failed`.
- Tables reconciled by terminal state: `runtime_sessions`, `plan_node_attempts`, `agent_mailbox_items`, `plan_nodes`.

### 3. Contracts

- An auto-approved observed tool action with `status="failed"` is runtime evidence, not an immediate AgentHub node failure.
- The worker must persist and publish the failed `runtime_observed_action`, then continue consuming native Runtime output so Codex/Claude can select a fallback path.
- A failed observed action must not determine the runtime terminal state by itself. If the native Runtime process exits normally, the worker may complete the session even when the audit trail contains failed observed actions.
- Runtime terminal failure is determined by executor/process errors, explicit boundary errors, timeout, cancellation, liveness loss, or other worker-level failures, not by individual auto-approved shell command exit codes.
- Permission boundary failures remain terminal immediately: outside-workspace paths, malformed permission context, unavailable approval queue, native executor unavailable, hard timeout, idle timeout, or liveness loss.

### 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| Full-control observed action fails, then Runtime emits fallback text | Publish `runtime_observed_action failed`, continue streaming, finish `completed` |
| Full-control observed action fails, then a later observed action completes | Clear the earlier failure for terminal-state purposes |
| Full-control observed action fails and Runtime process exits normally | Keep the failed audit record but do not emit `runtime_failed` only because of that action |
| Runtime CLI exits non-zero or executor throws | Persist `failed`, emit `runtime_failed`, reconcile plan rows to failed |
| Non-full-control observed action starts and requires approval | Stop at `waiting`, emit `approval_requested`, do not consume the completed/failed tool result |
| Observed action or tool request targets workspace outside root | Fail closed immediately |

### 5. Good/Base/Bad Cases

- Good: Codex probes `require.resolve(...)`, receives `Cannot find module`, then writes a fallback PPT/HTML renderer; AgentHub shows the failed probe in the audit trail and still completes the node.
- Base: A command fails and the native Runtime gives no further output but exits normally; AgentHub records the failed command as audit evidence and lets downstream product checks decide whether a deliverable exists.
- Bad: The worker throws as soon as it sees `observedAction.status === "failed"`, preventing the native Runtime from trying its own fallback.

### 6. Tests Required

- Runtime worker unit test where a failed observed action is followed by fallback `runtime_output` and the job completes.
- Runtime worker unit test where an observed action fails but the executor exits normally and the job completes.
- Runtime worker unit test where executor/process errors still mark runtime session, attempt, mailbox, and plan node failed.
- Regression coverage that non-full-control observed action `running` still enters approval `waiting` before any tool completion is consumed.

### 7. Wrong vs Correct

#### Wrong

```ts
if (chunk.observedAction.status === 'failed') {
  throw new Error(error)
}
```

#### Correct

```ts
if (chunk.observedAction.status === 'failed') {
  continue
}
```
