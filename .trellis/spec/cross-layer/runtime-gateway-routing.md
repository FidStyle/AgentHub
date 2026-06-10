# Runtime Gateway Routing Contract

## Scenario: Runtime Routes Through Gateway

### 1. Scope / Trigger

- Trigger: modifying runtime endpoint resolution, `/api/chat` runtime dispatch, or workspace execution-domain behavior.

### 2. Signatures

- `resolveEndpoint({ userId, workspaceId, executionDomain })`
- `runtime_endpoints`: `id`, `user_id`, `workspace_id`, `execution_domain`, `status`.
- Execution domains: workspace `cloud` maps to gateway `public_cloud`; workspace `local_desktop` maps to gateway `user_local`.
- `workspaces.local_root_display`: required for `local_desktop` workspaces. This is the cwd/workspace root forwarded to Desktop.
- Desktop publishes `runtime_detection` and `workspace_roots` capabilities through DeviceChannel. `workspace_roots` values are `{ path, healthy }`.

### 3. Contracts

- `public_cloud` uses cloud runtime endpoint and worker queue.
- `user_local` routes through Desktop DeviceChannel.
- Web/server remains the source of truth for roles, sessions, permissions, artifacts, runtime sessions, and logs.
- Desktop is only the local execution bridge: runtime diagnosis, authorized local workspace roots, local CLI invocation, and local execution logs.
- Mobile is a lightweight IM/approval/preview surface. It must not own local runtime configuration.
- Creating a `local_desktop` workspace must require selecting a healthy Desktop-reported workspace root and must persist it to `workspaces.local_root_display`.
- `/api/chat` for `local_desktop` must fail before runtime job creation when `local_root_display` is missing.
- Desktop must reject every runtime invoke whose `cwd` is missing or outside a healthy Desktop-reported workspace root.
- Missing endpoint returns an explicit unavailable state.
- No runtime path may silently fall back to host repo execution.

### 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| No cloud endpoint | visible `endpoint_unavailable` or equivalent |
| Local device offline | visible desktop offline error |
| Workspace root missing | fail before runtime job creation |
| Selected local root not reported by Desktop | workspace creation fails with a visible validation error |
| Desktop receives cwd outside authorized roots | Desktop emits runtime `failed` and returns failed response |

### 5. Good/Base/Bad Cases

- Good: Cloud workspace creates runtime job with workspace cwd.
- Good: Local Desktop workspace uses `local_root_display` as cwd, and Desktop executes only if cwd is inside an authorized root.
- Bad: API returns hardcoded assistant reply when endpoint is missing.
- Bad: Web creates a `local_desktop` workspace without a Desktop-reported root.

### 6. Tests Required

- Endpoint resolution unit tests.
- `/api/chat` unavailable-runtime integration test.
- Workspace-root isolation test.
- Runtime status test for `desktop.workspaceRoots`.
- Workspace creation test for required/allowed `local_root_display`.
- Desktop runtime host test for outside-root rejection.

### 7. Wrong vs Correct

#### Wrong

- If Gateway is missing, call a fake local executor.

#### Correct

- Return a visible unavailable error and keep durable state consistent.
