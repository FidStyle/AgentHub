# P1-RUNTIME-GATEWAY — Phase 1 执行报告（Gateway 契约 + DB 模型 + 路由/事件）

> 状态：**Phase 1 execute 完成并验收通过**。日期：2026-05-29。Ralph session `ralph-20260529-170344`。

## 概要

| 字段 | 值 |
|------|-----|
| 任务 ID | P1-RUNTIME-GATEWAY（里程碑 P1-RT，Phase 1） |
| 权威合同 | `research/contracts/P1-RUNTIME-GATEWAY.md` + `.trellis/spec/cross-layer/runtime-gateway-contract.md` |
| 计划 | `PLN-20260529-p1-rt-gateway-phase1`（4 tasks / 2 waves） |
| 范围 | Gateway contract + DB 模型 + routing/event semantics；**不要求真实 provider 部署**（D-003 → Phase 3） |
| 最终状态 | ✅ 全部完成，验证通过，review verdict=PASS |

## 交付物

| Task | 交付 | 验收 |
|------|------|------|
| TASK-001 | `packages/shared`：`RuntimeGatewayEvent`（7 变体）、`RuntimeEndpointKind/Status`、`RuntimeEndpoint`、`RuntimeGatewayInvokeInput` | tsc exit 0 |
| TASK-002 | `docker/postgres/p0-test-schema.sql` 追加 5 表（runtime_endpoints/sessions/logs/device_runtime_channels/capabilities，全 `IF NOT EXISTS`）+ `apps/web/lib/schema/runtime.ts` drizzle + query-client 白名单 | 二次 apply 幂等 exit 0；P0 sessions/messages 不变 |
| TASK-003 | `apps/web/lib/runtime/gateway.ts` 抽象（resolveEndpoint/createSession/invoke/persistRuntimeEvent）+ `hosted-adapter.ts` 去除 minimal_adapter + `app/api/chat/route.ts` 按 endpoint 路由 + session 落库 | tsc exit 0；无 minimal_adapter |
| TASK-004 | `apps/web/scripts/verify-p1-runtime-gateway.ts` 集成测试（DB 幂等 + cloud/local 事件 + 落库读回 + 安全） | 真实 DB 12 passed / 0 failed / 1 skip(PASS) |

## 验证证据（fresh）

- **type-check**：`packages/shared` tsc exit 0；`apps/web` tsc exit 0。
- **DB 迁移幂等**：对 `agenthub_p0_test` 二次 apply schema 均 exit 0；5 张 gateway 表存在；P0 `sessions`(8 cols/6 rows)、`messages`(12 cols/6 rows) 前后不变。
- **/api/chat 路由 + 事件**：gateway cloud 分支 emit `public_runtime_available=false` + `runtime_status` + `endpoint_unavailable`，**不返回假 assistant 成功**；local 分支 emit `local_runtime_offline` + 保留 `DEVICE_OFFLINE` 兼容。
- **落库读回**：persistence probe 对真实 DB 写 `runtime_sessions` + `runtime_logs` 读回成功，payload secret 字段 `[REDACTED]`，FK cascade 清理正常。
- **安全**：`isLocalNetworkTarget` 拒绝 loopback + RFC1918（6/6）；Web/Mobile 只用 endpointId，不直连本地端口。
- **集成测试**：`verify-p1-runtime-gateway.ts` 12 passed / 0 failed / 1 skipped(PASS)；skip 项为 /api/chat 端到端 SSE（需 dev server + TEST_AUTH_COOKIE），落库逻辑已 probe 独立验证。
- **review**：verdict=PASS，spec_compliance=ALL_MET，4 维度全 PASS，severity critical/high/medium=0，low=1（非阻塞）。

## 边界遵守

- 未触及真实 provider 部署（D-003 deferred → Phase 3）。
- 未改 Desktop RuntimeHost / StreamAdapter / DeviceChannel 主链路。
- 未 ALTER/DROP 任何 P0 表。

## 残留 / 后续

- Phase 1 仅 1 个 low finding：endpoint.id 为 null 时 connected 事件 endpointId 落为空串（语义可接受）。
- /api/chat 端到端 SSE 断言需运行 dev server + TEST_AUTH_COOKIE，正式 completion gate 前可补齐。
- Phase 2：Desktop local runtime tunnel 接入 gateway；Phase 3：public_cloud 池部署基座选型（D-003）。
