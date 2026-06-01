# 验收真实闭环 4：核心 @ 对话远程链路

## Goal

实现并验证 `cloud` 工作区远程 runtime 链路：`@角色` 消息经 Gateway/Redis/worker/真实 executor 返回非 echo agent 回复，落库并刷新恢复。

## Requirements

- runtime worker 采用真实 executor 配置；无凭证时明确阻塞。
- E2E 必须断言 agent 回复非空、非 echo、带角色上下文、刷新后存在。
- Mobile/PWA 复用同一 `/api/chat` 语义。

## Acceptance Criteria

- [x] Web cloud 工作区核心 `@` 流程跑通。
- [x] Mobile/PWA 至少覆盖浏览器视口真实 API 流程。
- [x] runtime_logs 与 messages 可交叉验证。

## Verification Notes

- 2026-06-01：真实 acceptance 环境下跑通 cloud `@架构师` API 链路：Web `/api/chat` -> Gateway -> Redis -> runtime worker -> real executor -> SSE -> agent message 落库。
- SSE 证据：`gateway_connected, public_runtime_available, runtime_status, runtime_output, runtime_completed, done`。
- 输出证据：`远程 cloud runtime 已收到：remote relay 1780289376831。`，非空且非原 prompt echo。
- DB 证据：最新 cloud `runtime_sessions.status=completed`，`messages` 存在 agent 回复，`runtime_logs` 可读回 runtime output/completed 事件。
- 验证命令：`pnpm env:acceptance:smoke` PASS（CRUD 5/5，chat 14/14）；定向 cloud @ 验真脚本 PASS。
- 2026-06-01：390x844 Mobile/PWA 视口使用真实 auth cookie 和真实移动 UI 跑通 cloud `/api/chat`。证据：`workspaceId=11175e6c-097c-47b9-ad6e-efc1db3de3b7`，`sessionId=adc9f312-73e0-42e0-9f62-5a9061922e55`，`chatStatus=200`，agent 回复 `mobile cloud ok 1780289810933`，刷新后 user/agent 消息仍可见。
- Mobile/PWA DB 证据：`runtime_sessions.id=4467740f-5e6f-4c50-913a-af11611d7661`，`status=completed`，`runtime_endpoints.kind=public_cloud`，`runtime_logs` 为 `gateway_connected:0, runtime_status:0, public_runtime_available:1, runtime_output:1, runtime_completed:2`，`messages` 含 user + agent 各 1 条。
- 截图证据：`e2e/artifacts/opencli-uat/mobile-cloud-real-flow-390x844.png`；布局断言：`width=390, scrollWidth=390, height=844`，无横向滚动。
- 质量修正：`HostedRuntimeAdapter` 对 public cloud 不再重复持久化 worker 已写入的 `runtime_*` 事件，避免 `runtime_logs` 双写与重复 seq；Gateway 仍持久化自身事件和 timeout sentinel。
- 验证命令：`pnpm --filter @agenthub/web type-check` PASS；`pnpm --filter @agenthub/web test -- __tests__/runtime __tests__/api/chat.test.ts` PASS（7 files / 31 tests）。

## References

- `research/contracts/ACCEPTANCE-REAL-FLOW-2026-06-01.md`
- `.trellis/spec/cross-layer/runtime-gateway-contract.md`
