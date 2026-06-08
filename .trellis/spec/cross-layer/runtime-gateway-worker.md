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
