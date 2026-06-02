# COMPLETE-MULTI-AGENT-ORCHESTRATION-2026-06-02 Phase 5 真实 UAT 与恢复报告

## 结论

2026-06-02，完整多 Agent 编排 Phase 5 已完成真实 Claude Code + Codex 双 CLI UAT，并补齐 plan-node `resume` 恢复 UAT。

本轮验证使用真实 Postgres/Redis/Auth.js session/Web Gateway/runtime worker/Claude Code/Codex CLI，不使用 `RUNTIME_EXECUTOR=fake` 或 `script` 作为产品成功证据。

## 真实多角色 UAT

命令：

```bash
set -a; source docker/.acceptance.env; set +a; \
REDIS_URL=${REDIS_URL:-redis://localhost:6379} \
RUNTIME_HEARTBEAT_EVENT_INTERVAL_MS=15000 \
pnpm --filter @agenthub/web exec tsx scripts/verify-complete-multi-agent-phase5.ts
```

结果：PASS。

证据：

| 项 | 值 |
| --- | --- |
| workspace | `bd4aea0e-9eba-4bf2-8364-0a997cf6b7f6` |
| session | `deb4f767-78ce-40b6-8802-705b255b9f88` |
| plan | `bb96a775-1946-4559-a4da-6f240d0c954f` |
| runtime sessions | `e294a9aa-7324-4582-adbd-449ab8c40105`, `9d4c2366-16ab-4b6c-bc64-7bcba8159ca1`, `a6856328-3c64-4e45-a1a6-1ad6ff498897`, `d6ff5bce-2451-49da-b1f5-458ee8e6d354` |

验证点：

- 默认角色包含 `架构师`、`前端工程师`、`后端工程师`。
- `架构师` 与 `前端工程师` 使用 Claude Code，`后端工程师` 使用 Codex。
- `/api/chat` SSE 包含 `orchestrator_plan_started`、`role_selected`、`role_handoff`、`runtime_completed`、`done`。
- SSE 不包含 `endpoint_unavailable` 或 `runtime_failed`。
- DB 持久化 `plans`、`plan_nodes`、`runtime_sessions`、`messages`、handoff metadata。
- planner/worker/summarizer 4 个节点全部 completed。
- 后端 Codex、前端 Claude Code 的 runtime session 均 completed，并记录 native session id。
- 用户消息记录 `roleHandoffs`，下游 agent 消息记录 `handoffsReceived`。

## 恢复 UAT

命令：

```bash
set -a; source docker/.acceptance.env; set +a; \
REDIS_URL=${REDIS_URL:-redis://localhost:6379} \
RUNTIME_HEARTBEAT_EVENT_INTERVAL_MS=15000 \
PHASE5_SESSION_ID=deb4f767-78ce-40b6-8802-705b255b9f88 \
pnpm --filter @agenthub/web exec tsx scripts/verify-complete-multi-agent-recovery.ts
```

结果：PASS。

证据：

| 项 | 值 |
| --- | --- |
| resumed node | `10d56ae4-e70b-4eb9-8e86-f1fa586636f9` |
| previous attempt | `4d0df89a-13b7-46e0-89d5-63a4ba580a5c` |
| resume attempt | `78ae3acf-34ac-4097-9d67-5afeae4a0c2f` |
| previous runtime session | `9d4c2366-16ab-4b6c-bc64-7bcba8159ca1` |
| resume runtime session | `8faab6bd-5ce1-4f23-8f70-6895483fc750` |
| runtime type | `codex` |
| native session id | `019e8935-5c8f-7e13-a931-e5fe7b17b706` |

验证点：

- `POST /api/plan-nodes/:id/resume` 返回 `control=resume`。
- resume 后节点进入 `ready`。
- 新 attempt 保留 `previous_attempt_id` lineage。
- resume 创建 queued mailbox item。
- mailbox context 记录 `previousRuntimeSessionId`。
- `POST /api/mailbox/dispatch-ready` 投递真实 ready mailbox。
- resume attempt 与 resume runtime session 均 completed。
- resume runtime session 复用同一 `role_agent_id`、`runtime_type`、`cwd` 和 Codex native session id。
- parent plan 恢复后重新 completed。

## 三端证据

截图：

- Web 工作台计划/运行时证据：`e2e/artifacts/complete-multi-agent-phase5/web-phase5-plan.png`
- Mobile/PWA 计划监督证据：`e2e/artifacts/complete-multi-agent-phase5/mobile-phase5-plan.png`
- Desktop Runtime 监督证据：`e2e/artifacts/complete-multi-agent-phase5/desktop-runtime-supervision.png`

采集验证：

- Web 截图页面文本包含 Phase 5 workspace、计划内容、Claude Code/Codex runtime 信息。
- Mobile/PWA 截图页面文本包含计划监督、4/4 节点完成、后端/前端/架构师节点状态。
- Desktop 截图页面文本包含 `Runtime 监督`、`机器能力`、`角色运行时健康`、`Native Session 续接`，且不包含 API Key / Base URL 输入入口。

## 修复项

本轮真实恢复 UAT 暴露并修复两个真实边界问题：

- 本地 Postgres client 返回 `created_at` 为 `Date`，`selectReadyMailboxItems` 过去只接受字符串并在 `dispatch-ready` 触发 500。已改为同时支持 `string | Date` 排序，并增加 shared 回归测试。
- Codex CLI 0.135 的 `codex exec resume` 不接受普通 `exec` 的 sandbox/color flags。已将 resume 参数修为 `codex exec resume --json --skip-git-repo-check <nativeSessionId> <prompt>`，并同步 executor 测试与 runtime gateway spec。

## 质量门禁

已通过：

- `pnpm --filter @agenthub/shared test -- src/__tests__/mailbox.test.ts --run` PASS（4 tests）。
- `pnpm --filter @agenthub/web test -- __tests__/api/chat.test.ts __tests__/runtime/executor.test.ts __tests__/runtime/subscribe-timeout.test.ts __tests__/runtime/liveness.test.ts --run` PASS（4 files / 37 tests）。
- `pnpm --filter @agenthub/web type-check` PASS。
- `pnpm --filter @agenthub/shared type-check` PASS。
- `pnpm type-check` PASS。
- `pnpm --filter @agenthub/desktop build` PASS。

## 剩余说明

本报告关闭 Phase 5 真实 CLI UAT、恢复 UAT 和三端截图证据。最终治理门禁仍依赖本报告、tracker、ledger 与相关代码进入 git commit 后再运行，因为治理脚本要求工作区干净且最近 commit 覆盖公开治理账本。
