# Cloud Runtime Gateway 契约

## 场景：Runtime 统一经 Cloud Gateway 路由

### 1. 范围与触发条件

- 触发条件：`FR-RUNTIME-001`、`FR-DEVICE-001`、`FR-DESK-001`、`FR-MOB-001` 涉及 Runtime 执行、Web/Mobile 访问用户本地 Runtime、或 public cloud Runtime 池。
- 权威产品合同：`research/contracts/P1-RUNTIME-GATEWAY.md`。
- Cloud Runtime Gateway 是必需实体，不是 optional provider。它统一承载 `public_cloud` 与 `user_local` runtime endpoint。
- D-003 只决定 public cloud runtime 池的部署基座（Modal/Fly/自建/其他），不决定 Gateway 是否存在。

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
- Provider deployment can be unconfigured while Gateway contracts, DB records, and error events still work.

### 4. Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| `cloud` workspace has no configured `public_cloud` endpoint | Emit `endpoint_unavailable` plus `runtime_status`; do not return fake assistant success |
| `local_desktop` workspace has no connected Desktop tunnel | Emit `local_runtime_offline`; preserve `DEVICE_OFFLINE` compatibility while P0 tests depend on it |
| Web/Mobile attempts to store or use local IP/port for runtime | Reject or ignore; runtime route must use `endpointId` |
| Runtime provider is not selected for public pool | Store endpoint as `unconfigured`; do not block Gateway schema/routing work |
| Runtime event contains credentials or local env secrets | Redact before persistence |

### 5. Good/Base/Bad Cases

- Good: Web sends `/api/chat`; backend creates a `runtime_sessions` row, routes to Gateway, emits `gateway_connected`, then routes to `public_cloud` or `user_local`.
- Base: public runtime provider is not configured; request persists a runtime session/log and emits `endpoint_unavailable` with a Chinese user-facing next step.
- Bad: `HostedRuntimeAdapter` returns a hardcoded assistant message or `minimal_adapter` text and claims runtime execution succeeded.
- Bad: Mobile connects directly to a Desktop localhost URL or stores a user's private IP/port as the runtime target.

### 6. Tests Required

- DB migration test: all runtime gateway tables are created idempotently and do not alter P0 workspace/session/message tables.
- API integration test: `/api/chat` creates `runtime_sessions` / `runtime_logs` and emits Gateway events.
- `public_cloud` unconfigured test: no fake success; returns `endpoint_unavailable` / `public_runtime_available=false`.
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
