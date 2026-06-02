# COMPLETE-MULTI-AGENT-ORCHESTRATION-2026-06-02 Phase 1 数据内核首切片报告

## 结论

2026-06-02，Phase 1 已完成第一组可验证后端切片：durable mailbox/attempt schema、shared/database types、plan node 控制 API、plan timeline API、runtime inventory API，以及 `runtime_invoke` 初始投递的 attempt/mailbox 记录。

本报告不宣称完整多 Agent 编排完成。当前只证明 Phase 1 数据内核和 API 控制面已开始落地；动态 DAG 调度、per-role inbound serialization、三端 UI、真实 Claude+Codex UAT 仍未完成。

## 完成范围

| 项 | 结果 |
| --- | --- |
| Schema | `docker/postgres/acceptance-schema.sql` 新增 `plan_node_attempts`、`agent_mailbox_items`，扩展 `plan_nodes.status` 为 waiting/cancelled/blocked 等最终状态。 |
| Shared types | `packages/shared/src/orchestrator/mailbox.ts`、`plan.ts`、`database.types.ts` 同步 `PlanNodeAttempt`、`AgentMailboxItem`、control/status 类型。 |
| Runtime invoke 初始证据 | `dispatchRuntimeInvokeNode` 在投递前创建 initial attempt 和 inbound mailbox；成功投递后 attempt/mailbox 进入 running，并把 `attemptId`、`mailboxItemId` 写入 node result。 |
| Plan node 控制 API | 新增 `POST /api/plan-nodes/:id/retry`、`resume`、`cancel`、`requeue`；retry/resume/requeue 创建新 attempt 和目标角色 inbound mailbox，cancel 只记录 cancelled attempt，不伪造执行。 |
| Timeline API | 新增 `GET /api/plans/:planId/timeline`，从 durable rows 返回 plan、nodes、attempts、mailbox、runtime sessions/logs、artifacts。 |
| Runtime inventory API | 新增 `GET /api/runtime/inventory?workspace_id=`，返回 machine-wide Claude Code/Codex inventory，并按 role runtime binding 映射 health。 |
| Local Postgres client | `apps/web/lib/postgres-query-client.ts` 白名单加入新表，acceptance 模式可读写。 |

## 验证命令

- `pnpm --filter @agenthub/web test -- __tests__/api/plan-node-controls-inventory.test.ts __tests__/api/plans-actions-owner.test.ts __tests__/orchestrator/action-dispatcher.test.ts` PASS（3 files / 15 tests）。
- `pnpm --filter @agenthub/web type-check` PASS。
- `pnpm --filter @agenthub/web test -- __tests__/api/chat.test.ts __tests__/api/role-agents.test.ts __tests__/runtime/gateway-gating.test.ts __tests__/runtime/local-device-relay.test.ts __tests__/runtime/executor.test.ts __tests__/api/plans-actions-owner.test.ts __tests__/api/plan-node-controls-inventory.test.ts __tests__/orchestrator/action-dispatcher.test.ts` PASS（8 files / 64 tests）。
- `pnpm --filter @agenthub/shared test` PASS（4 files / 27 tests）。
- `pnpm --filter @agenthub/shared build` PASS。

## 剩余风险

- 尚未运行 `pnpm env:acceptance:smoke` 验证新 schema 在真实 Postgres drop/reseed 下执行；下一切片应补。
- 当前 mailbox 只覆盖 initial/control inbound item；reply event、dead-letter scheduler、per-role serial consumer 和 ready wave calculation 仍待 Phase 2。
- Web/Desktop/Mobile 尚未消费 timeline/inventory API，三端 UI 仍是后续 Phase 4。
- 真实 Claude+Codex 多角色 UAT 尚未执行，不能把本切片作为最终完成证据。
