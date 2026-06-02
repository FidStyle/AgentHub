# COMPLETE-MULTI-AGENT-ORCHESTRATION-2026-06-02 Phase 2 Scheduler Kernel 首切片报告

## 结论

2026-06-02，Phase 2 已完成第一组可验证后端切片：`GET /api/mailbox/ready` 的 ready wave 不再只是只读边界，新增 `POST /api/mailbox/dispatch-ready` 可按 durable mailbox rows 实际调度 ready inbound item 到 Runtime Gateway/worker 队列。

本报告不宣称完整 Phase 2 完成。当前只证明 scheduler 已能消费现有 queued mailbox/attempt，并复用 Phase 1 的 per-role serialization helper。动态 DAG 生成、wait-all fan-in、失败传播、reply 驱动后续节点和真实 Claude+Codex UAT 仍未完成。

## 完成范围

| 项 | 结果 |
| --- | --- |
| Prepared runtime dispatch | `dispatchRuntimeInvokeNode` 的投递路径拆出为“已有 attempt/mailbox 可复用”的 prepared dispatch，避免 scheduler 消费 mailbox 时重复创建 attempt 或 inbound mailbox。 |
| Mailbox runtime consumer | 新增 `dispatchMailboxRuntimeInvokeItem`，从 durable mailbox item + plan node 调度 runtime job，校验 session/workspace owner、cloud execution domain、目标角色和 canonical `role_agents.runtime_type`。 |
| Ready scheduler API | 新增 `POST /api/mailbox/dispatch-ready`，按 `session_id` 读取 ready wave，逐个加载 plan node 并调度；同一角色已有 running/waiting inbound 时不会 dispatch 后续 queued item，跨角色 ready item 可在同一 wave 中并发 enqueue。 |
| Failure semantics | 缺少 `attempt_id`、缺少 plan node、非 `runtime_invoke` 节点、非 cloud workspace、角色缺失、endpoint/worker 不可用都会写 dead-letter/failed evidence 或返回 explicit unavailable，禁止 fake success。 |
| No duplicate evidence | 调度 ready mailbox 只把已有 mailbox/attempt 标记 running 并写 runtime_session_id，不 insert 新 `plan_node_attempts` 或新 inbound `agent_mailbox_items`。 |

## 验证命令

- `pnpm --filter @agenthub/web test -- __tests__/api/mailbox-controls.test.ts __tests__/orchestrator/action-dispatcher.test.ts` PASS（2 files / 9 tests）。
- `pnpm --filter @agenthub/web type-check` PASS。

## 剩余风险

- 仍未实现动态 DAG generator/validator；当前只消费已存在的 durable mailbox rows。
- 仍未实现 wait-all/fan-in 后续节点自动解锁；reply event 尚未驱动 Orchestrator 或 summarizer。
- 仍未执行真实 Claude+Codex 双 CLI UAT；当前为 API/unit 级 scheduler kernel 验证。
