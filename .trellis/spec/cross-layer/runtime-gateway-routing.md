# Runtime Gateway Routing Contract

## Scenario: Runtime Routes Through Gateway

### 1. Scope / Trigger

- Trigger: modifying runtime endpoint resolution, `/api/chat` runtime dispatch, or workspace execution-domain behavior.

### 2. Signatures

- `resolveEndpoint({ userId, workspaceId, executionDomain })`
- `runtime_endpoints`: `id`, `user_id`, `workspace_id`, `execution_domain`, `status`.
- Execution domains: `public_cloud`, `user_local`.

### 3. Contracts

- `public_cloud` uses cloud runtime endpoint and worker queue.
- `user_local` routes through Desktop DeviceChannel.
- Missing endpoint returns an explicit unavailable state.
- No runtime path may silently fall back to host repo execution.

### 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| No cloud endpoint | visible `endpoint_unavailable` or equivalent |
| Local device offline | visible desktop offline error |
| Workspace root missing | fail before runtime job creation |

### 5. Good/Base/Bad Cases

- Good: Cloud workspace creates runtime job with workspace cwd.
- Bad: API returns hardcoded assistant reply when endpoint is missing.

### 6. Tests Required

- Endpoint resolution unit tests.
- `/api/chat` unavailable-runtime integration test.
- Workspace-root isolation test.

### 7. Wrong vs Correct

#### Wrong

- If Gateway is missing, call a fake local executor.

#### Correct

- Return a visible unavailable error and keep durable state consistent.
