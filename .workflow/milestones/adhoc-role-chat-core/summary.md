# Milestone: adhoc-role-chat-core — Ad-hoc: 角色对话链路 (ROLE-CHAT-CORE-001)

**Completed**: 2026-05-30
**Type**: adhoc
**Artifacts**: 4 archived (analyze: 1, plan: 1, execute: 1, verify: 1)

## Key Outcomes
- `/api/chat` 角色归属校验（跨 workspace 403）+ `system_prompt` 注入 RuntimeExecutor，透传链路 adapter→gateway→job→worker→executor，缺省回退旧行为。
- role_agents CRUD + 默认架构师惰性 seed；messages 持久化 `role_agent_id` + `mentions`；`runtime_sessions.role_agent_id`（additive nullable 列）。
- Web @角色选择 UI + `createSession` 接线（修复聊天不可达）；reload 保留角色上下文。
- 真实 DB E2E `role-chat-core.spec.ts` 1 passed：创建工作区 → 默认架构师 → @架构师 → `/api/chat` 持久化 → reload 保留。

## Learnings
- **Mock 漏检真实缺陷**：单测/业务测试以 mock 通过，但 E2E（真实 DB）暴露 2 个致命缺陷 —— 会话创建 UI 未接线导致 composer 永久禁用、聊天黄金路径不可达；`normalizeValue` 未序列化 jsonb 数组/对象导致 seed + metadata 写库 500。E2E 真实链路是发现"集成层"缺陷不可替代的手段。
- **harness 边界须显式登记**：P0 harness 无 Redis/worker → agent 流式回复无法覆盖；agent 回复角色 Badge 切片 deferred 并在 uat.md/audit 显式记录，而非静默 skip。

## Next Milestone
Ad-hoc task complete（adhoc 里程碑自包含，无后继）。残留 review WARN 3 medium 健壮性项纳入 P1-RT 跟进。
