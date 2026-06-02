# 完整多 Agent 编排最终补全

## Goal

在现有 `COMPLETE-MULTI-AGENT-ORCHESTRATION-2026-06-02` 合同基础上补齐仍未完全实现的产品闭环，重点把首轮多角色执行从 request-local 内存 wave 推进改为 durable mailbox / attempt / scheduler 驱动，并补齐 Web/Mobile/Desktop 可见状态与治理收口。

共享合同：`research/contracts/COMPLETE-MULTI-AGENT-ORCHESTRATION-2026-06-02.md`

## Current Gaps

- `/api/chat` 首轮编排已创建 `plans` / `plan_nodes` / attempt / mailbox evidence，但实际 ready wave 仍在请求内用内存数组和 `Promise.all` 执行，handoff 也先在内存数组中传播。
- `mailbox` / `dispatch-ready` / `advancePlanProgress` 已用于 retry/resume/recovery，但没有成为首轮执行的唯一 durable 调度路径。
- `dag-generator` 仍是规则型 planner -> workers -> summarizer，可服务当前线路，但需要更明确地把执行事实写进 durable DAG / mailbox / timeline。
- Web/Mobile/Desktop 已有最小监督面，但 node detail、handoff、attempt、runtime logs、角色名和 runtime health 展示仍偏薄。
- 合同状态和治理门禁尚未最终收口。

## Scope

本任务继续使用当前 canonical 线路：

- self-hosted Postgres / Redis
- Auth.js DB session
- Web Gateway / runtime worker
- Claude Code / Codex CLI
- `role_agents.runtime_type`
- `plans` / `plan_nodes` / `plan_node_attempts` / `agent_mailbox_items`

不做兼容分支；旧 mock/fallback/runtime tag 不作为产品路径。

## Requirements

1. `/api/chat` 首轮多角色执行必须通过 durable mailbox/attempt 调度，不能依赖 request-local handoff 数组作为执行真相。
2. 首轮 planner/worker/summarizer 节点应先创建 queued mailbox item，再通过同一调度函数投递 runtime worker。
3. Handoff 必须以 durable mailbox context 或 message metadata 可读回；下游 prompt 不能依赖未持久化的内存状态。
4. retry/resume/requeue 继续沿用相同 mailbox dispatch 路径。
5. Web timeline 至少能展示节点状态、角色名/runtime、attempt/mailbox/runtime evidence 入口信息。
6. Mobile/PWA 至少能读取同一计划状态和关键 retry/resume 控制。
7. Desktop 至少能展示 runtime inventory、角色 runtime health、native session 续接状态，且不暴露 API Key / Base URL。
8. 合同、tracker、ledger、execution report 和治理门禁必须同步。

## Acceptance Criteria

- [x] 新增或更新测试证明 `/api/chat` 首轮多角色执行会创建 queued mailbox item，并通过 mailbox dispatch 投递 runtime，而不是只在 request 内直接执行所有节点。
- [x] `dispatch-ready` / mailbox dispatch 与首轮执行共享同一核心调度函数。
- [x] retry/resume 后 attempt lineage、mailbox context、native session reuse 仍保持。
- [x] Web/Mobile/Desktop 读取真实 API/DB 状态，无假空态或 UI-only 状态。
- [x] `pnpm --filter @agenthub/web test -- __tests__/api/chat.test.ts __tests__/api/plan-node-controls-inventory.test.ts __tests__/runtime/executor.test.ts` 通过。
- [x] `pnpm --filter @agenthub/shared test` 通过。
- [x] `pnpm --filter @agenthub/web type-check` 通过。
- [ ] 治理门禁 `bash scripts/verify-governance-gate.sh COMPLETE-MULTI-AGENT-ORCHESTRATION-2026-06-02` 通过或明确只剩 commit-order 门禁。

## Out of Scope

- 不新增 Claude/Codex 之外的 runtime。
- 不引入外部托管平台。
- 不做复杂可视化 DAG 编辑器。
- 不保留旧 runtime tag 或 fake/script 产品线路。
