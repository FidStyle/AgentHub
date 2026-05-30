# Milestone Audit: adhoc-role-chat-runtime-deliver

**Milestone**: Ad-hoc: ROLE-CHAT-RUNTIME-DELIVER (REG-20260530-006)
**Type**: adhoc (single-phase, standalone)
**Audited**: 2026-05-30T14:06:36Z

## Artifact Chain
- analyze: ANL-role-chat-runtime-deliver-2026-05-30 ✓
- plan: PLN-20260530-role-chat-runtime-deliver ✓
- execute: (committed eed577f) ✓
- verify: verification.json passed=true ✓
- review: review.json PASS ✓
- uat: uat.md 2/2 passed ✓

## Integration Checks

1. **Shared Interfaces**: passed. `gateway.ts:7` imports `{ enqueue, subscribeEvents, setCancel, isWorkerAlive }` from `./redis-client`; `redis-client.ts:153` exports `isWorkerAlive(): Promise<boolean>`. `runtime-worker.ts:3` imports `{ ..., setWorkerAlive, clearWorkerAlive, type RuntimeJob }` from `../lib/runtime/redis-client`; both are exported at `redis-client.ts:146` (`setWorkerAlive`) and `redis-client.ts:158` (`clearWorkerAlive`). Signatures align: `setWorkerAlive(ttlSec?)` called arg-less at `runtime-worker.ts:104` (uses default TTL), `clearWorkerAlive()` called at `runtime-worker.ts:96` shutdown. `executor.ts` exports `ScriptedRealExecutor`, `FakeExecutor`, `CliRuntimeExecutor`, `CliRuntimeType`, `RuntimeExecutor`; all imported by `runtime-worker.ts:2`. No interface drift.

2. **Dependency Chains**: passed. Both producer and consumer resolve the presence key from a single module-level constant — there is no duplicated literal to drift. Confirmed value: `const workerAliveKey = 'agenthub:runtime:worker:alive'` (`redis-client.ts:8`). Producer: `setWorkerAlive` → `r.set(workerAliveKey, ...)` (`redis-client.ts:150`). Consumer: `isWorkerAlive` → `r.exists(workerAliveKey)` (`redis-client.ts:155`). Cleanup: `clearWorkerAlive` → `r.del(workerAliveKey)` (`redis-client.ts:160`). The E2E `waitForWorkerAlive` independently polls the literal `'agenthub:runtime:worker:alive'` (`global-setup.ts:39`) — identical to the constant. No silent-failure mismatch.

3. **Data Contracts**: passed. `RuntimeJob` is defined once in `redis-client.ts:16` (`runtimeSessionId`, `endpointId?`, `prompt`, `systemPrompt?`, `fail?`). Gateway enqueue (`gateway.ts:136-141`) supplies `runtimeSessionId`, `endpointId`, `prompt: userMessage ?? ''`, `systemPrompt` — a structural subset, `fail` omitted (optional). Worker `processJob(job: RuntimeJob, ...)` (`runtime-worker.ts:39`) consumes `job.runtimeSessionId`, `job.systemPrompt`, `job.prompt`, `job.endpointId`, `job.fail` — all valid fields. `systemPrompt` prepend at `runtime-worker.ts:54` matches gateway intent. `ExecutorJob` (`executor.ts:8`: `prompt`, `fail?`) is correctly narrowed from `RuntimeJob` at the `executor.execute({ prompt, fail: job.fail })` call (`runtime-worker.ts:55`). Contract consistent end-to-end.

4. **API Consistency**: passed. `RuntimeErrorCode.ENDPOINT_UNAVAILABLE = 'endpoint_unavailable'` exported from `packages/shared/src/runtime/error-codes.ts:3` (re-exported via `runtime/index.ts:3`); gateway imports `{ RuntimeErrorCode }` from `@agenthub/shared` (`gateway.ts:3`) and emits it at `gateway.ts:121`. Event types used by gateway — `runtime_status`, `public_runtime_available`, `endpoint_unavailable` — all match the `RuntimeGatewayEvent` union in `packages/shared/src/runtime/gateway.ts:17-19` (`runtime_status{status,endpointId?}`, `public_runtime_available{available,endpointId?}`, `endpoint_unavailable{endpointId?,reason}`). Worker-emitted event types (`runtime_status`, `runtime_output`, `runtime_completed`, `runtime_failed`, `runtime_cancelled`) flow through `subscribeEvents` as `RuntimeGatewayEvent`. Note: `packages/shared/dist` was rebuilt in the same commit (eed577f) to resolve a stale-dist build mismatch root cause — dist now in sync with source.

5. **Configuration**: passed. TTL default `RUNTIME_WORKER_PRESENCE_TTL_SEC = 15` (`redis-client.ts:147`). Worker refreshes the key every main-loop iteration: `setWorkerAlive()` then `dequeue(5)` (`runtime-worker.ts:104-105`), so the worst-case refresh interval is the 5s BRPOP timeout (when the queue is idle; faster when jobs arrive). 5s refresh < 15s TTL with a 3× safety margin — the key cannot expire mid-flight while the worker is alive. Docker compose sets `RUNTIME_EXECUTOR: ${RUNTIME_EXECUTOR:-script}` (`docker-compose.runtime.yml:49`) and E2E global-setup injects `RUNTIME_EXECUTOR=script` for the worker (`global-setup.ts:81`), consistent with the `createExecutor` script branch (`runtime-worker.ts:16`).

6. **Error Handling**: passed. Both negative paths short-circuit BEFORE `enqueue` (`gateway.ts:136`): unconfigured/null-id at `gateway.ts:126-129` and no-REDIS_URL/no-live-worker at `gateway.ts:130-133`, each `yield* emitUnavailable(...)` (emits `public_runtime_available:false` + `runtime_status:endpoint_unavailable` + `endpoint_unavailable` + sets session `failed`) then `return` — no job is enqueued, so nothing can hang on an empty queue. Worker clears presence on shutdown: `process.on('SIGTERM'|'SIGINT', shutdown)` where `shutdown` calls `await clearWorkerAlive().catch(()=>{})` (`runtime-worker.ts:95-100`), so a graceful stop immediately drops the gate to the unavailable path (plus TTL backstop if killed ungracefully). Unit test `gateway-gating.test.ts` asserts `enqueueMock` called 0 times on both negative paths and `failed` status set; the no-worker E2E asserts POST /api/chat returns in <15s (vs the 60s idle timeout) with a Chinese error notice and zero role badges.

## Gaps
None. All 6 integration concerns passed. The highest-risk silent-failure point (presence key name mismatch between producer and consumer) is mitigated by a single shared module-level constant referenced by both, with the E2E polling literal independently confirmed identical.

## Verdict
PASS
