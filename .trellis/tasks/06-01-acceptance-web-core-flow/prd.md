# 验收硬化 3：Web 主链路真实回归

## Goal

确保 Web 主端真实用户链路从入口到消息回复、产物/编排展示、刷新恢复全部可验收。

## Shared Contract

- `research/contracts/ACCEPTANCE-HARDENING-2026-06-01.md`

## Requirements

- 登录/测试认证、workspace list、新建 workspace、进入 workspace、session 创建/切换全部走真实 DB/API。
- Chat 发送必须调用 `/api/chat`，有 worker 时可见 agent 回复并落库；无 worker 时立即中文错误态。
- Role Agent、Artifact Panel、Orchestrator Panel 使用真实 API 数据。
- reload 后用户消息、agent 回复、role badge、context/output/orchestrator 状态恢复。
- E2E 不得只断言可见或 HTTP 200。

## Acceptance Criteria

- [x] Web 主链路 E2E worker-mode 通过。
- [x] Web no-worker 错误态 E2E 通过。
- [x] Artifact/Orchestrator 数据一致性 E2E 通过。
- [x] 视觉布局断言通过。
- [x] 相关 API/integration 测试通过。

## Execution Notes

- Web worker-mode E2E 使用真实 Postgres、Auth.js session、Redis、runtime worker 和 `ScriptedRealExecutor`，覆盖 workspace/session/chat/reload、Role Agent、Artifact、Orchestrator。
- Web no-worker E2E 使用 Redis 但不启动 worker，验证 `/api/chat` 立即进入中文错误态，不空等、不伪造 agent 成功。
- 修复 `ArtifactPanel` 产物筛选漏 `result_card`，真实 result card 现在会显示在「产物」Tab。
- 修复 `/api/plans` 本地 Postgres 写入 `plan_nodes.depends_on uuid[]` 时数组被 JSON 序列化导致的 500。
- E2E 按实际 UI 更新：Role Agents 位于「上下文」Tab，Orchestrator 位于「变更」Tab；Artifact/Orchestrator tests 改为自建真实 workspace/session 数据，不再依赖外部 `TEST_WORKSPACE_ID`/`TEST_SESSION_ID` 才能执行。

## Verification

- `RUNTIME_E2E=1 npx playwright test --config e2e/playwright.config.ts --project=web-desktop --workers=1 tests/web/p0-main-flow.spec.ts tests/messaging.spec.ts tests/artifact.spec.ts tests/web/web-orchestrator-ui.spec.ts tests/web/artifact-panel-data.spec.ts`：7 passed。
- `RUNTIME_E2E_NOWORKER=1 npx playwright test --config e2e/playwright.config.ts --project=web-desktop --workers=1 tests/web/role-chat-no-worker.spec.ts tests/messaging.spec.ts`：2 passed。

## Report

- `research/execution-reports/acceptance-web-core-flow-2026-06-01.md`

## Likely Starting Evidence

- `apps/web/app/api/chat/route.ts`
- `apps/web/lib/runtime/gateway.ts`
- `apps/web/components/workspace/*`
- `apps/web/components/orchestrator/*`
- `e2e/tests/web/*`
- `e2e/tests/artifact.spec.ts`
- `e2e/tests/messaging.spec.ts`
- `e2e/tests/workspace.spec.ts`
