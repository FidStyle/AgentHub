# Cloud Runtime Gateway 契约

## 场景：Runtime 统一经 Cloud Gateway 路由

### 1. 范围与触发条件

- 触发条件：`FR-RUNTIME-001`、`FR-DEVICE-001`、`FR-DESK-001`、`FR-MOB-001` 涉及 Runtime 执行、Web/Mobile 访问用户本地 Runtime、或 public cloud Runtime 池。
- 权威产品合同：`research/contracts/P1-RUNTIME-GATEWAY.md`。
- Cloud Runtime Gateway 是必需实体，不是 optional provider。它统一承载 `public_cloud` 与 `user_local` runtime endpoint。
- D-003 已决策为全部自建：public cloud runtime 池、Cloud Gateway、DB、cache 均使用官方镜像或开源实现自部署；不采用 Supabase/Fly/Neon/Upstash 等包装平台。

### 2. Signatures

```typescript
type RuntimeEndpointKind = 'public_cloud' | 'user_local';
type RuntimeType = 'hosted' | 'claude_code' | 'codex' | 'opencode';
type ExecutionDomain = 'cloud' | 'local_desktop';

type RuntimeEndpointStatus = 'available' | 'offline' | 'unconfigured';
type RuntimeRunStatus = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';
type DeviceRuntimeChannelStatus = 'connected' | 'disconnected';

interface RuntimeEndpoint {
  id: string;
  userId?: string;
  kind: RuntimeEndpointKind;
  runtimeType: RuntimeType;
  deviceId?: string;
  status: RuntimeEndpointStatus;
}

interface RuntimeGatewayInvokeInput {
  workspaceId: string;
  sessionId: string;
  roleAgentId?: string;
  executionDomain: ExecutionDomain;
  endpointId: string;
  endpointKind: RuntimeEndpointKind;
  userMessage: string;
  cwd?: string;
}

type RuntimeGatewayEvent =
  | { type: 'gateway_connected'; endpointId: string }
  | { type: 'runtime_status'; status: string; endpointId?: string }
  | { type: 'public_runtime_available'; available: boolean; endpointId?: string }
  | { type: 'endpoint_unavailable'; endpointId?: string; reason: string }
  | { type: 'local_runtime_offline'; endpointId?: string; deviceId?: string }
  | { type: 'tunnel_connected'; endpointId: string; deviceId: string }
  | { type: 'tunnel_disconnected'; endpointId: string; deviceId: string };
```

DB tables for P1 foundation:

- `runtime_endpoints`
- `runtime_sessions`
- `runtime_logs`
- `device_runtime_channels`
- `runtime_capabilities`

### 3. Contracts

- Web/Mobile never connect to a user's local IP, localhost port, or Desktop listener directly.
- `/api/chat` and future runtime APIs route through Cloud Runtime Gateway first.
- `public_cloud` endpoint means AgentHub-operated shared runtime capacity.
- `user_local` endpoint means a user's Desktop local runtime exposed through Gateway relay/tunnel.
- Desktop may start a local child process or listen on a local port, but remote clients can only access it through Gateway and authenticated DeviceChannel/tunnel.
- HostedRuntimeAdapter must be implemented as Gateway client/contract boundary. It must not bypass Gateway by hardcoding a provider-specific service.
- Self-hosted public runtime deployment can be unconfigured while Gateway contracts, DB records, and error events still work.
- Public cloud worker dispatch must establish the runtime event subscription before enqueueing the job. Enqueue-before-subscribe can miss fast worker `runtime_output` pub/sub messages and falsely produce `runtime_completed` without an agent reply persisted.

### 4. Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| `cloud` workspace has no configured `public_cloud` endpoint | Emit `endpoint_unavailable` plus `runtime_status`; do not return fake assistant success |
| `local_desktop` workspace has no connected Desktop tunnel | Emit `local_runtime_offline`; preserve `DEVICE_OFFLINE` compatibility while P0 tests depend on it |
| Web/Mobile attempts to store or use local IP/port for runtime | Reject or ignore; runtime route must use `endpointId` |
| Self-hosted public runtime worker is not deployed yet | Store endpoint as `unconfigured`; do not block Gateway schema/routing work |
| Runtime event contains credentials or local env secrets | Redact before persistence |

### 5. Good/Base/Bad Cases

- Good: Web sends `/api/chat`; backend creates a `runtime_sessions` row, routes to Gateway, emits `gateway_connected`, then routes to `public_cloud` or `user_local`.
- Base: self-hosted public runtime worker is not deployed; request persists a runtime session/log and emits `endpoint_unavailable` with a Chinese user-facing next step.
- Bad: `HostedRuntimeAdapter` returns a hardcoded assistant message or `minimal_adapter` text and claims runtime execution succeeded.
- Bad: Mobile connects directly to a Desktop localhost URL or stores a user's private IP/port as the runtime target.

### 6. Tests Required

- DB migration test: all runtime gateway tables are created idempotently and do not alter P0 workspace/session/message tables.
- API integration test: `/api/chat` creates `runtime_sessions` / `runtime_logs` and emits Gateway events.
- `public_cloud` unconfigured test: no fake success; returns `endpoint_unavailable` / `public_runtime_available=false`.
- `public_cloud` live worker test: fast deterministic executor streams `runtime_output`, emits `runtime_completed`, and `/api/chat` persists both user and agent messages.
- `user_local` offline test: no fake success; returns `local_runtime_offline` and backwards-compatible `DEVICE_OFFLINE`.
- Security test: runtime endpoint creation rejects local IP/port as a Web/Mobile-controlled target.

### 7. Wrong vs Correct

#### Wrong

```typescript
const adapter = new HostedRuntimeAdapter();
return adapter.generateHardcodedResponse(message);
```

#### Correct

```typescript
const endpoint = await runtimeGateway.resolveEndpoint({
  workspaceId,
  executionDomain,
});

const runtimeSession = await runtimeGateway.createSession({
  workspaceId,
  sessionId,
  endpointId: endpoint.id,
});

for await (const event of runtimeGateway.invoke({ runtimeSession, userMessage })) {
  await persistRuntimeEvent(runtimeSession.id, event);
  yield toSse(event);
}
```

## Scenario: Public Cloud Worker Liveness Env

### 1. Scope / Trigger

- Trigger: Web server, runtime worker, or acceptance scripts claim the `cloud` conversation path is live.
- Applies to `pnpm --filter @agenthub/web start`, `apps/web/server/runtime-worker.ts`, `/api/chat`, and opencli/browser UAT.

### 2. Signatures

- Required Web env for live cloud runtime: `REDIS_URL=redis://<host>:<port>`.
- Required worker env: same `REDIS_URL`, plus `RUNTIME_EXECUTOR=real|script|fake`, and for real CLI `RUNTIME_CLI=codex|claude_code`.
- Runtime events proving liveness: `public_runtime_available=true`, at least one `runtime_output`, then `runtime_completed`.

### 3. Contracts

- The Web server and runtime worker must point at the same Redis instance. A live worker process alone is not enough.
- `/api/chat` must gate `public_cloud` on both a configured endpoint and `isWorkerAlive()` using the Web process `REDIS_URL`.
- If Web lacks `REDIS_URL`, it must emit `endpoint_unavailable` instead of enqueueing a job or fabricating a reply.
- Acceptance commands must start Web with `REDIS_URL=redis://localhost:6379` whenever the worker is started locally.

### 4. Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| Worker running but Web process lacks `REDIS_URL` | `endpoint_unavailable`; no fake agent reply |
| Web and worker use different Redis URLs | `endpoint_unavailable` or timeout; test must fail |
| Web and worker share Redis and endpoint is available | SSE has `runtime_output` chunks and terminal `runtime_completed` |

### 5. Good/Base/Bad Cases

- Good: `REDIS_URL=redis://localhost:6379 pnpm --filter @agenthub/web start` and `REDIS_URL=redis://localhost:6379 RUNTIME_EXECUTOR=real RUNTIME_CLI=codex pnpm --filter @agenthub/web exec tsx server/runtime-worker.ts`.
- Base: Worker intentionally unavailable; UI shows a Chinese unavailable state and persists no fake assistant message.
- Bad: Start only the worker with `REDIS_URL`, leave Web without it, then report cloud chat failure as a runtime bug.

### 6. Tests Required

- Unit/integration: endpoint unavailable path persists no agent message.
- Browser UAT: stream body contains multiple `runtime_output` events and refresh shows the persisted agent message.
- Evidence must record the Web and worker `REDIS_URL` values or startup commands.

### 7. Wrong vs Correct

#### Wrong

```bash
pnpm --filter @agenthub/web start
REDIS_URL=redis://localhost:6379 pnpm --filter @agenthub/web exec tsx server/runtime-worker.ts
```

#### Correct

```bash
REDIS_URL=redis://localhost:6379 pnpm --filter @agenthub/web start
REDIS_URL=redis://localhost:6379 RUNTIME_EXECUTOR=real RUNTIME_CLI=codex pnpm --filter @agenthub/web exec tsx server/runtime-worker.ts
```

## Scenario: Workspace Local Desktop Creation Gate

### 1. Scope / Trigger

- Trigger: Web Workspace or API creates a workspace with `execution_domain='local_desktop'`.
- Applies to `/api/workspaces`, workspace creation UI, `/api/runtime/status`, and any future mobile/desktop control surface that can create Local Desktop Workspace.

### 2. Signatures

```typescript
type DesktopStatus = 'connected' | 'disconnected' | 'not_bound';
type LocalRuntimeStatus = 'ready' | 'unavailable';

interface RuntimeStatusResponse {
  user: { id: string; name: string | null; email: string | null };
  desktop: {
    status: DesktopStatus;
    connected: boolean;
    device: { id: string; name: string; last_heartbeat: string | null } | null;
  };
  runtime: {
    status: LocalRuntimeStatus;
    description: string;
  };
}
```

### 3. Contracts

- Frontend may show a disabled state from `/api/runtime/status`, but backend remains authoritative.
- `/api/workspaces` MUST reject `execution_domain='local_desktop'` unless the authenticated user has a connected `device_runtime_channels` row for one of their desktop devices.
- Connected means `devices.user_id = currentUser.id`, `devices.type='desktop'`, and `device_runtime_channels.status='connected'`.
- Web/Mobile must not use local IP/port to prove local availability. The proof is Gateway DeviceChannel status.

### 4. Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| No desktop device bound | `/api/runtime/status.desktop.status='not_bound'`; local workspace create returns 409 |
| Desktop exists but no connected channel | status `disconnected`; local workspace create returns 409 |
| Connected DeviceChannel exists | status `connected`, runtime `ready`; local workspace create may proceed |
| DB/device status query fails | return 500 with backend error message; do not create workspace |

### 5. Good/Base/Bad Cases

- Good: Web dialog disables Local Desktop creation and backend returns 409 if the Desktop is offline.
- Base: Cloud workspace creation continues to work without Desktop.
- Bad: UI lets a user create `local_desktop` workspace while the Desktop connector is offline, producing an unusable workspace.

### 6. Tests Required

- API test or E2E: unauthenticated users still fail auth before state checks.
- API/E2E: `cloud` workspace creation succeeds without Desktop.
- API/E2E: `local_desktop` creation without connected `device_runtime_channels` returns 409 with a Chinese actionable message.
- E2E: workspace status bar displays login, Desktop connection, and local runtime state.

### 7. Wrong vs Correct

#### Wrong

```typescript
await fetch('/api/workspaces', {
  method: 'POST',
  body: JSON.stringify({ name, execution_domain: 'local_desktop' }),
});
```

#### Correct

```typescript
const status = await fetch('/api/runtime/status').then((r) => r.json());
if (!status.desktop.connected) {
  showDisabledLocalDesktopState();
}

// Backend repeats the same gate and returns 409 if the Desktop is not connected.
await createWorkspace({ name, execution_domain: 'local_desktop' });
```
