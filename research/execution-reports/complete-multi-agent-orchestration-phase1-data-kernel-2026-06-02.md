# COMPLETE-MULTI-AGENT-ORCHESTRATION-2026-06-02 Phase 1 数据内核首切片报告

## 结论

2026-06-02，Phase 1 已完成第二组可验证后端切片：durable mailbox/attempt schema、shared/database types、plan node 控制 API、plan timeline API、runtime inventory API、`runtime_invoke` 初始投递的 attempt/mailbox 记录、mailbox ready wave/per-role serialization 纯函数、mailbox reply/dead-letter 数据写入 API、ready scheduler 边界 API，以及旧 `runtime:*` capability tag 的 no-compat API 拒绝。

本报告不宣称完整多 Agent 编排完成。当前只证明 Phase 1 数据内核和 API 控制面继续落地；真实 worker consumer、动态 DAG 调度、三端 UI、真实 Claude+Codex UAT 仍未完成。

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
| Mailbox scheduling | `selectReadyMailboxItems` 保证同一角色一次只消费一个 inbound item，跨角色可形成 ready wave；`nextPlanNodeAttemptDraft` 保留 retry lineage。 |
| Mailbox reply API | 新增 `POST /api/mailbox-items/:id/reply`，创建 durable `reply` mailbox item，保留 `attempt_id` / `parent_attempt_id` / `lineage_root_id`，并把原 inbound item 与关联 attempt 标记 completed；原始 orchestrator/null 来源时要求显式 `to_role_agent_id`，避免写入违反 NOT NULL 的伪目标。 |
| Mailbox dead-letter API | 新增 `POST /api/mailbox-items/:id/dead-letter`，把 mailbox item、关联 attempt 标记 `dead_letter`，并把关联 plan node 标记 failed，同时保留原始 mailbox/attempt 证据。 |
| Ready scheduler boundary API | 新增 `GET /api/mailbox/ready?session_id=`，按会话归属校验 owner，读取 durable mailbox rows 后使用 shared `selectReadyMailboxItems` 返回 ready wave，证明同角色串行、跨角色可并发的 API 边界。 |
| No-compat guard | `/api/role-agents` POST/PATCH 拒绝 `capabilities` 中的 `runtime:*` 旧标签，要求使用 `runtime_type`；runtime dispatch 只读取 `role_agents.runtime_type` 并忽略旧 capability tag；`RUNTIME_EXECUTOR=fake/script` 在非测试授权环境下拒绝；旧 `/api/runtime/invoke` 返回 410，不再假装本地 runtime invoked。 |

## 验证命令

- `pnpm --filter @agenthub/web test -- __tests__/api/plan-node-controls-inventory.test.ts __tests__/api/plans-actions-owner.test.ts __tests__/orchestrator/action-dispatcher.test.ts` PASS（3 files / 15 tests）。
- `pnpm --filter @agenthub/web type-check` PASS。
- `pnpm --filter @agenthub/web test -- __tests__/api/chat.test.ts __tests__/api/role-agents.test.ts __tests__/runtime/gateway-gating.test.ts __tests__/runtime/local-device-relay.test.ts __tests__/runtime/executor.test.ts __tests__/api/plans-actions-owner.test.ts __tests__/api/plan-node-controls-inventory.test.ts __tests__/orchestrator/action-dispatcher.test.ts` PASS（8 files / 64 tests）。
- `pnpm --filter @agenthub/shared test` PASS（4 files / 27 tests）。
- `pnpm --filter @agenthub/shared build` PASS。
- 追加验证：`pnpm --filter @agenthub/shared test` PASS（5 files / 30 tests）。
- 追加验证：`pnpm --filter @agenthub/web test -- __tests__/api/role-agents.test.ts` PASS（1 file / 23 tests）。
- 追加验证：`pnpm --filter @agenthub/web test -- __tests__/api/chat.test.ts __tests__/api/role-agents.test.ts __tests__/api/plan-node-controls-inventory.test.ts __tests__/orchestrator/action-dispatcher.test.ts __tests__/runtime/executor.test.ts __tests__/runtime/gateway-gating.test.ts __tests__/runtime/local-device-relay.test.ts` PASS（7 files / 58 tests）。
- 追加验证：`pnpm --filter @agenthub/web type-check && pnpm --filter @agenthub/shared type-check` PASS。
- 追加验证：`pnpm env:acceptance:up` PASS，重新 seed acceptance DB 并应用当前 schema。
- 追加验证：`pnpm env:acceptance:smoke` PASS（CRUD 5/5，`/api/chat` 11/11；cloud SSE 包含 `gateway_connected`、`endpoint_unavailable`、`done`，local_desktop 未连接创建 409）。
- 追加验证：`pnpm --filter @agenthub/web test -- __tests__/api/mailbox-controls.test.ts` PASS（1 file / 6 tests）。
- 追加验证：`pnpm --filter @agenthub/web test -- __tests__/api/mailbox-controls.test.ts __tests__/api/plan-node-controls-inventory.test.ts` PASS（2 files / 12 tests）。
- 追加验证：`pnpm --filter @agenthub/web type-check` PASS。
- 追加验证：`pnpm --filter @agenthub/shared type-check` PASS。
- 追加验证：`pnpm --filter @agenthub/web test -- __tests__/runtime/executor.test.ts __tests__/orchestrator/action-dispatcher.test.ts` PASS（2 files / 16 tests）。

## 剩余风险

- 当前 Phase 1 已覆盖 initial/control inbound item、reply item、dead-letter 更新和 ready scheduler API 边界；真实 worker 级 per-role consumer 仍待 Phase 2。
- Phase 1 no-compat 已覆盖角色 runtime tag、fake/script executor、旧 runtime invoke 入口的负向测试；后续如新增旧 payload 入口，必须继续按当前规范拒绝而不是兼容。
- Web/Desktop/Mobile 尚未消费 timeline/inventory API，三端 UI 仍是后续 Phase 4。
- 真实 Claude+Codex 多角色 UAT 尚未执行，不能把本切片作为最终完成证据。
