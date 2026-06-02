# COMPLETE-MULTI-AGENT-ORCHESTRATION-2026-06-02 最终补全报告

## 结论

2026-06-03，根据“需要完全实现”的复核要求，补齐完整多 Agent 编排中最后两个未完全落实点：

- 首轮 `/api/chat` 多角色执行的 durable evidence 从 `queued` attempt/mailbox 开始，并通过共享 `dispatchPreparedRuntimeInvokeNode` runtime-node dispatcher 创建 runtime session、更新 attempt/mailbox/plan node、订阅后投递 Redis worker job。
- Web 编排面板读取 `/api/plans/:id/timeline`，在节点上展示 role/runtime、attempt、mailbox、runtime session、native session 和 runtime log evidence。

这使首轮执行、retry/resume/requeue、worker 终态回写和 Web timeline 证据都落到同一套 durable contract。

## 代码变更

- `apps/web/app/api/chat/route.ts`
  - 首轮节点 attempt/mailbox 初始状态改为 `queued`。
  - mailbox context 持久化 `receivedHandoffs`。
  - 首轮 orchestrated cloud 节点改为调用共享 runtime-node dispatcher；当前 SSE 响应只负责订阅 worker event，不再 direct adapter 执行 planner/worker/summarizer。
- `apps/web/lib/orchestrator/action-dispatcher.ts`
  - 导出共享 `dispatchPreparedRuntimeInvokeNode`，并支持调用方提供订阅后投递 hook，避免快速 worker event 丢失。
- `apps/web/lib/runtime/hosted-adapter.ts`
  - HostedRuntimeAdapter 接收并转发 plan node / attempt / mailbox evidence。
- `apps/web/lib/runtime/gateway.ts`
  - public cloud runtime job 入队时携带 plan node / attempt / mailbox ids，worker 可直接回写同一 evidence。
- `apps/web/components/orchestrator/OrchestratorPanel.tsx`
  - 加载 plans/actions 后同步读取 timeline API，构建节点 evidence。
- `apps/web/components/orchestrator/PlanCard.tsx`
  - 展示角色名/runtime、attempt/mailbox/runtime session/native session/log count。
- `apps/web/__tests__/api/chat.test.ts`
  - 断言首轮多角色执行不走 direct HostedRuntimeAdapter，而是通过共享 dispatcher enqueue 携带 `planNodeId`、`attemptId`、`mailboxItemId` 的 runtime job。
  - 断言首轮 mailbox context 持久化 downstream handoff。

## 验证

已通过：

```bash
pnpm --filter @agenthub/web test -- __tests__/api/chat.test.ts --run
pnpm --filter @agenthub/web test -- __tests__/api/chat.test.ts __tests__/api/plan-node-controls-inventory.test.ts __tests__/runtime/executor.test.ts --run
pnpm --filter @agenthub/shared test -- --run
pnpm --filter @agenthub/web type-check
```

结果：

- Web focused tests PASS：3 files / 38 tests。
- Shared tests PASS：5 files / 31 tests。
- Web type-check PASS。

## 残留范围

无当前 canonical 线路 blocker。

不纳入本次完成范围：

- 可拖拽 DAG 编辑器。
- Claude/Codex 之外的新 runtime。
- 旧 runtime tag / fake/script 产品兼容路径。
- 原生 RN 设备 GUI 与外部 OAuth 人工点击自动化。
