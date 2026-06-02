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
- Required worker env: same `REDIS_URL`, plus `RUNTIME_EXECUTOR=real` or unset. `RUNTIME_CLI` is only the default when a queued job has no `runtimeType`; a live worker must dispatch per-job `claude_code` and `codex`.
- Test-only worker env: `RUNTIME_EXECUTOR=script|fake` is allowed only under `NODE_ENV=test` or `AGENTHUB_ALLOW_TEST_EXECUTOR=true`; it must not be used as product or acceptance proof.
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

- Good: `REDIS_URL=redis://localhost:6379 pnpm --filter @agenthub/web start` and `REDIS_URL=redis://localhost:6379 RUNTIME_EXECUTOR=real pnpm --filter @agenthub/web exec tsx server/runtime-worker.ts`; queued jobs select Claude Code or Codex from `role_agents.runtime_type`.
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
REDIS_URL=redis://localhost:6379 RUNTIME_EXECUTOR=real pnpm --filter @agenthub/web exec tsx server/runtime-worker.ts
```

## Scenario: Role Runtime Binding And Handoff Context

### 1. Scope / Trigger

- Trigger: `FR-AGENT-001` and `FR-RUNTIME-001` when Role Agents can run on different local or cloud CLIs in one session.
- Applies to `role_agents`, `/api/role-agents`, `/api/chat`, `HostedRuntimeAdapter`, runtime gateway jobs, Desktop DeviceChannel invoke payloads, `messages.metadata`, and SSE events.
- Reference input: role-routing systems in `refer_proj` separate role identity/prompt from execution provider; mailbox-style handoff systems treat upstream replies as explicit inbound context, not just UI text.

### 2. Signatures

```typescript
type RoleRuntimeType = 'claude_code' | 'codex';

interface RoleAgentRow {
  id: string;
  workspace_id: string;
  name: string;
  role_type: string;
  system_prompt: string;
  capabilities: string[];
  runtime_type: RoleRuntimeType;
  is_orchestrator: boolean;
}

interface RoleHandoffPackage {
  fromRoleAgentId: string | null;
  fromRoleName: string;
  toRoleAgentId: string | null;
  toRoleName: string;
  sessionId: string;
  summary: string;
  sourceMessageId: string | null;
  target?: string;
  phase?: 'direct' | 'planning' | 'worker' | 'summarizing';
  runtimeType?: RoleRuntimeType | null;
  createdAt: string;
}
```

DB contract:

- `role_agents.runtime_type text NOT NULL CHECK (runtime_type IN ('claude_code','codex'))`.
- Migration/bootstrap must convert existing `capabilities` runtime tags into `runtime_type` once, then remove those tags from `capabilities`.
- `messages.metadata.roleHandoffs?: RoleHandoffPackage[]` on the initiating user message.
- `messages.metadata.handoffsReceived?: RoleHandoffPackage[]` on downstream agent messages.

SSE contract:

- `role_selected`: `{ type: 'role_selected', roleAgentId }`.
- `role_handoff`: `{ type: 'role_handoff', toRoleAgentId, handoffs: RoleHandoffPackage[] }`.

### 3. Contracts

- Role runtime binding is a first-class `role_agents.runtime_type` field. It must not be encoded as `capabilities` tags such as `runtime:codex`.
- `/api/role-agents` POST/PATCH validates `runtime_type`; only `claude_code` and `codex` are accepted.
- Default workspace roles are localized Chinese roles with explicit runtime binding:
  - `架构师` -> `claude_code`
  - `前端工程师` -> `claude_code`
  - `后端工程师` -> `codex`
- `/api/chat` must pass the selected role's `runtime_type` to the gateway. Public cloud jobs and local Desktop invokes both honor the same field.
- Local Desktop runtime invoke must fail when the selected role runtime is not installed/authenticated/launchable. It must not switch to another available CLI.
- Multi-role execution creates a handoff package from each completed upstream role to each later selected role, injects it into the downstream system prompt, emits it over SSE, and persists it in message metadata.
- Handoff prompt injection must filter by receiver: a role may only receive packages where `toRoleAgentId` matches the current role. Do not pass global handoff state into every role prompt.
- Handoff summaries are bounded before prompt injection; current limit is the last 4000 characters of each upstream reply.

### 4. Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| `POST/PATCH /api/role-agents` receives `runtime_type='hosted'` or `runtime:codex` | 400 with Chinese validation error |
| Role capabilities include `runtime:*` | Treat as ordinary invalid product data; do not use it for routing |
| Selected role has `runtime_type='codex'` | Gateway job/device invoke uses Codex |
| Selected role has `runtime_type='claude_code'` | Gateway job/device invoke uses Claude Code |
| Local Desktop has only Codex ready but selected role requires Claude Code | `runtime_failed`; no device invoke with Codex |
| Multiple roles are selected | Later role prompt contains `上游角色交接上下文`; messages persist `handoffsReceived` |
| A handoff is addressed to another role | Current role prompt does not include it |
| Worker or Desktop unavailable | Preserve runtime unavailable/offline error semantics; do not fabricate handoff success |

### 5. Good/Base/Bad Cases

- Good: User selects `前端工程师` then `后端工程师`; Web invokes Claude Code first, then Codex with a structured handoff summary from frontend to backend; both agent messages persist role id, runtime parts, and handoff metadata.
- Base: Only one role is selected; no `role_handoff` event is emitted and normal role prompt/runtime routing still works.
- Bad: Backend role has `capabilities=['runtime:codex']` but no `runtime_type`; `/api/chat` reads the capability tag and silently routes to Codex.

### 6. Tests Required

- API role-agent tests: create/update accepts `claude_code`/`codex` and rejects invalid runtime strings.
- Chat route tests: multi-role dispatch uses `role_agents.runtime_type` without `runtime:*` tags and persists `handoffsReceived`.
- Chat route tests: one worker does not receive another worker's addressed handoff; summarizer receives planner/worker packages addressed to it.
- Runtime gateway tests: local Desktop selected runtime mismatch fails without sending a device invoke.
- E2E/UAT: Web role configuration UI exposes runtime selector and role chat SSE includes `role_handoff` for multi-role sends.

### 7. Wrong vs Correct

#### Wrong

```typescript
const runtime = role.capabilities.includes('runtime:codex') ? 'codex' : 'claude_code';
```

#### Correct

```typescript
const runtime = role.runtime_type;
await gateway.invoke({ roleAgentId: role.id, runtimeType: runtime, systemPrompt });
```

## Scenario: Native Session Resume And Orchestrated Role Plan

### 1. Scope / Trigger

- Trigger: A single AgentHub session runs multiple configured roles, or a role sends more than one message to the same CLI/cwd.
- Applies to `/api/chat`, `HostedRuntimeAdapter`, `runtime_sessions`, Redis runtime jobs, `runtime-worker`, CLI executor, `plans`, `plan_nodes`, SSE, and `messages.metadata`.
- Reference input: ClawWork-style conductor/performer rooms, CCB mailbox fan-out/fan-in, ccm-orchestra persistent agent sessions, and ACP session restore all require durable worker sessions instead of one-shot `--print` only.

### 2. Signatures

```typescript
type CliRuntimeType = 'claude_code' | 'codex';

interface RuntimeSessionRow {
  session_id: string;
  role_agent_id: string | null;
  runtime_type: CliRuntimeType;
  cwd: string | null;
  native_session_id: string | null;
  capability_snapshot: RuntimeCapabilitiesSnapshot | RuntimeCapabilitiesSnapshot[];
  status: 'idle' | 'running' | 'completed' | 'failed' | 'cancelled';
}

interface RuntimeJob {
  runtimeSessionId: string;
  runtimeType?: CliRuntimeType;
  nativeSessionId?: string | null;
  cwd?: string | null;
  prompt: string;
  systemPrompt?: string;
}

interface OrchestratedPlanNodePayload {
  phase: 'planning' | 'worker' | 'summarizing';
  runtimeType: CliRuntimeType | null;
}
```

DB contract:

- `runtime_sessions.runtime_type text NOT NULL CHECK (runtime_type IN ('claude_code','codex'))`.
- `runtime_sessions.capability_snapshot jsonb DEFAULT '{}'::jsonb`.
- Native reuse scope is `(session_id, role_agent_id, runtime_type, cwd)`, newest non-null `native_session_id` first.
- `plan_nodes.action_type='runtime_invoke'` for orchestrated role execution.
- Worker nodes depend on the planner node; summarizer depends on all worker nodes.

### 3. Contracts

- Public cloud worker inventory is machine-wide: one live worker can execute any available/authenticated/launchable CLI on the machine, selected per queued job by `runtimeType`.
- Gateway must persist `runtime_detection` capability snapshots for the endpoint and copy the selected snapshot into the runtime session before enqueueing.
- If the selected runtime is unavailable, unauthenticated, or not launchable, Gateway emits `endpoint_unavailable` and marks the runtime session failed. It must not switch to another runtime.
- CLI execution uses official native resume when `nativeSessionId` exists:
  - Claude Code: `claude -p --resume <nativeSessionId> <prompt>`.
  - Codex: `codex exec resume --json -s read-only --color never <nativeSessionId> <prompt>`.
- Executor parses native session ids from CLI JSON lines and worker writes them back to `runtime_sessions.native_session_id`.
- Orchestrated chat with an orchestrator plus worker roles creates a durable `plans` row and `plan_nodes` rows, runs planner first, workers concurrently after planner success, then summarizer after all workers succeed.
- Confirming a `pending_confirm` plan must dispatch `plan_nodes.action_type='runtime_invoke'` directly to the runtime worker. It must not require a shell `command` payload.
- Planner/worker failures propagate: unrun downstream nodes are marked failed and the plan is marked failed. A plan must not be marked completed unless every required node completed.
- Runtime worker must update `plan_nodes` when `planNodeId` is present even when there is no `actionId`. When all sibling nodes reach terminal status, it settles the parent plan to `completed` or `failed`.
- Handoff packages are durable `ContextPackage` values and are injected only into the target role's prompt.

### 4. Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| Existing native id for same session/role/runtime/cwd | New runtime session starts with that `native_session_id` |
| Existing native id for different role/runtime/cwd | Do not reuse |
| Selected role requires Codex but only Claude Code is ready | `endpoint_unavailable`; no Claude fallback |
| Worker emits `nativeSessionId` without `delta` | Persist native id and emit `native_session`; do not create empty output chunk |
| Planner fails | Worker and summarizer nodes are failed as upstream-blocked; plan failed |
| Any worker fails | Summarizer node is failed as upstream-blocked; plan failed |
| Confirmed plan has ready `runtime_invoke` node with no command | Dispatch runtime job; node becomes running and later completed/failed by worker |
| Runtime job has `planNodeId` but no `actionId` | Worker still writes node terminal status and settles parent plan |
| Summarizer succeeds after all workers | Plan completed |

### 5. Good/Base/Bad Cases

- Good: Same session selects `架构师` + `前端工程师` + `后端工程师`; planner runs Claude Code, frontend runs Claude Code, backend runs Codex, summarizer runs Claude Code, and handoffs are persisted with target/phase/runtime metadata.
- Base: Single role chat creates a runtime session and reuses native session id for that role/runtime/cwd on the next message.
- Bad: Runtime session reuses a Codex native id for a Claude Code role, or a frontend handoff appears in backend prompt when it was addressed to the summarizer.

### 6. Tests Required

- Runtime gateway unit: native session reuse is scoped by session, role, runtime, and cwd.
- Runtime worker unit: per-job `runtimeType` selects the real CLI executor; `script/fake` are rejected outside test authorization.
- Executor unit: resume args are generated for Claude Code and Codex when native id exists; emitted native id is persisted by worker.
- Chat route unit: orchestrator+workers creates plan/nodes, uses per-role runtime types, filters handoffs by target, and marks plan failed when an upstream node fails.
- Plan confirm unit: `runtime_invoke` ready nodes dispatch without command/action rows.
- Runtime worker unit: pure `runtime_invoke` jobs with `planNodeId` and no `actionId` complete the node and settle parent plan.
- Browser/UAT: multi-role send shows plan start, role selected events, handoff events, and persisted role messages after refresh.

### 7. Wrong vs Correct

#### Wrong

```typescript
const nativeSessionId = await latestNativeSession(sessionId);
const runtimeType = process.env.RUNTIME_CLI ?? 'claude_code';
await runWorker({ runtimeType, nativeSessionId });
await db.from('plans').update({ status: 'completed' }).eq('id', planId);
```

#### Correct

```typescript
const nativeSessionId = await latestNativeSession({
  sessionId,
  roleAgentId,
  runtimeType: role.runtime_type,
  cwd,
});

await enqueue({
  runtimeType: role.runtime_type,
  nativeSessionId,
  cwd,
});

const planCompleted = plannerOk && workerResults.every(Boolean) && summarizerOk;
await db.from('plans').update({ status: planCompleted ? 'completed' : 'failed' }).eq('id', planId);
```

## Scenario: Final Multi-Agent Mailbox, Plan Recovery, And Runtime Inventory

### 1. Scope / Trigger

- Trigger: `COMPLETE-MULTI-AGENT-ORCHESTRATION-2026-06-02` Phase 1-5, or any task that claims final multi-agent orchestration, handoff, retry/resume/cancel, runtime inventory, or three-surface supervision is complete.
- Applies to `plans`, `plan_nodes`, mailbox/handoff rows, `runtime_sessions`, `runtime_logs`, `role_agents`, `/api/chat`, plan-node control APIs, runtime inventory APIs, Web timeline, Desktop runtime doctor, Mobile/PWA supervision, and acceptance schema/bootstrap.
- This scenario supersedes metadata-only handoff as a completion target. Existing message metadata can remain as a source link, but final acceptance requires durable mailbox/attempt/reply/lineage data.

### 2. Signatures

```typescript
type PlanNodeControl = 'retry' | 'resume' | 'cancel' | 'requeue';
type MailboxDirection = 'outbound' | 'inbound' | 'reply';
type MailboxStatus =
  | 'queued'
  | 'running'
  | 'waiting'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'dead_letter';

interface AgentMailboxItem {
  id: string;
  workspaceId: string;
  sessionId: string;
  planId: string | null;
  planNodeId: string | null;
  direction: MailboxDirection;
  fromRoleAgentId: string | null;
  toRoleAgentId: string;
  attemptId: string;
  parentAttemptId: string | null;
  lineageRootId: string;
  runtimeType: 'claude_code' | 'codex';
  status: MailboxStatus;
  contextPackage: ContextPackage;
  replyToMailboxItemId?: string | null;
}

interface PlanNodeAttempt {
  id: string;
  planNodeId: string;
  attemptNumber: number;
  control: PlanNodeControl | 'initial';
  previousAttemptId: string | null;
  runtimeSessionId: string | null;
  mailboxItemId: string | null;
  status: MailboxStatus;
}

interface RuntimeInventoryItem {
  runtimeType: 'claude_code' | 'codex';
  available: boolean;
  authenticated: boolean;
  launchable: boolean;
  version?: string;
  path?: string;
  capabilitySnapshot: RuntimeCapabilitiesSnapshot;
  checkedAt: string;
  errorCode?: string;
  errorMessage?: string;
}
```

Required API contract:

- `GET /api/runtime/inventory` returns machine-wide Claude Code/Codex inventory and per-role selected runtime health.
- `GET /api/plans/:planId/timeline` returns plan, nodes, attempts, mailbox items, runtime sessions/log summaries and artifacts from durable rows.
- `POST /api/plan-nodes/:id/retry` creates a new attempt and mailbox item; it never overwrites old evidence.
- `POST /api/plan-nodes/:id/resume` continues from the newest resumable attempt/native session in the same `(session_id, role_agent_id, runtime_type, cwd)` scope.
- `POST /api/plan-nodes/:id/cancel` records cancellation for the current attempt and propagates blocked/cancelled state to downstream nodes according to the plan policy.
- `POST /api/plan-nodes/:id/requeue` moves a queued/failed recoverable node back to scheduler evaluation without changing prior attempt evidence.

### 3. Contracts

- Final handoff is durable mailbox data. `messages.metadata.roleHandoffs` is not enough for final completion.
- Every role consumes inbound mailbox items serially. Cross-role dispatch may run concurrently when dependencies and runtime capacity allow it.
- Retry and resume create new `plan_node_attempts` or equivalent lineage rows. They must keep previous runtime logs, runtime session ids, mailbox items and error evidence readable.
- Reply is a durable event addressed to an agent or Orchestrator, not a direct in-memory callback.
- Dead-letter or failed inbox state is required when a handoff cannot be delivered, the target runtime is unavailable, or retry limit is exceeded.
- Runtime inventory is informational and diagnostic. It may show alternatives, but product routing still uses `role_agents.runtime_type` as a hard requirement.
- No compatibility fallback is allowed for product execution. Old runtime tags, fake/script executors, old payload fields and hardcoded success states must fail, be migrated once, or be confined to explicit test-only paths.

### 4. Validation & Error Matrix

| Condition | Required result |
| --- | --- |
| Retry a failed plan node | New attempt row; old attempt/log/session remains readable; downstream nodes recompute from new attempt |
| Resume a node with matching native session | Uses newest native id in same session/role/runtime/cwd scope |
| Resume a node with only another role/runtime native id | Does not reuse; returns explicit non-resumable or starts a new allowed attempt according to API contract |
| Cancel a running node | Runtime/session/log/node attempt record `cancelled`; downstream policy is persisted |
| Handoff target role has queued item already running | New inbound waits; same role is not concurrently invoked |
| Frontend and backend roles are both ready | Different roles may run concurrently if dependencies and runtime inventory allow it |
| Runtime inventory says Codex unavailable for Codex-bound role | Plan node blocks/fails with explicit error; no Claude fallback |
| Message metadata contains handoff but durable mailbox row is missing | Not accepted as final handoff evidence |
| Old `runtime:*` capability tag appears in product routing | Test must fail; code must not route from it |

### 5. Good/Base/Bad Cases

- Good: Planner creates two worker nodes; frontend and backend inbound mailbox items are created; each role consumes one item serially; backend retry creates attempt 2 with lineage to attempt 1; summarizer waits for the successful latest attempts and records reply lineage.
- Base: Direct single-role chat creates no cross-role mailbox, but still records runtime inventory, runtime session and native session continuity.
- Bad: `/api/chat` stores `messages.metadata.handoffsReceived` and reports final mailbox complete without any durable attempt/reply/lineage row.

### 6. Tests Required

- Shared/domain tests for mailbox status transitions, lineage invariants, per-role serialization and ready wave calculation.
- API tests for `GET /api/runtime/inventory`, `GET /api/plans/:planId/timeline`, and all plan-node control APIs.
- Worker tests for cancel/interrupt, retry attempt creation, pure plan-node jobs, and parent plan settlement after resume.
- Web E2E for timeline, node detail, handoff viewer, retry/resume/cancel/requeue and refresh persistence.
- Desktop UAT/E2E for machine inventory, auth/launch/native session doctor and per-role runtime health.
- Mobile/PWA E2E for plan supervision, approval, artifact preview and critical retry/resume controls.
- Acceptance UAT with real Claude Code + Codex CLI; fake/script executor is not valid evidence.

### 7. Wrong vs Correct

#### Wrong

```typescript
await db.messages.update({
  metadata: { handoffsReceived: [handoff] },
});
await db.plan_nodes.update({ status: 'completed' });
```

#### Correct

```typescript
const attempt = await createPlanNodeAttempt({
  planNodeId,
  previousAttemptId,
  control: 'retry',
});

const mailboxItem = await enqueueInboundMailbox({
  planNodeId,
  attemptId: attempt.id,
  fromRoleAgentId,
  toRoleAgentId,
  contextPackage,
});

await scheduleRoleInboundQueue({
  roleAgentId: toRoleAgentId,
  runtimeType: role.runtime_type,
});
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
