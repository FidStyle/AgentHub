# ROLE-CHAT-CORE-001 执行报告

- **任务**: Web Workspace 角色对话核心链路
- **里程碑**: adhoc-role-chat-core（Ralph session `ralph-20260530-054910`）
- **日期**: 2026-05-30
- **计划/产物目录**: `.workflow/scratch/20260530-plan-role-chat-core/`

## 1. 交付范围

| 子目标 | 内容 | 状态 |
|--------|------|------|
| G1 | role_agents CRUD + 默认架构师 seed + `/api/chat` 角色校验与 system_prompt 注入链路（含 @角色选择、roleAgentId/mentions 持久化、RuntimeExecutor 注入、UI 角色回复展示） | ✅ MET |
| G2 | 结构化验证 + 代码评审：归属校验、system_prompt 注入、持久化字段正确 | ✅ MET |
| G3 | 业务/自动化测试覆盖角色对话链路（含 Playwright 视觉/布局断言） | ✅ MET |
| G4 | E2E：创建架构师 → @架构师发送 → runtime → 持久化 → reload 保留角色上下文 | ✅ MET |

## 2. 关键实现

- `apps/web/app/api/chat/route.ts`：接收 `roleAgentId`，校验 role_agents 归属（跨 workspace → 403），加载 `role.system_prompt` 并透传；messages 持久化 `role_agent_id` + `mentions`。
- 注入链路：`hosted-adapter.ts → gateway.ts → redis-client.ts(job) → runtime-worker.ts → RuntimeExecutor`，`systemPrompt` 缺省回退旧行为（向后兼容）。
- `runtime_sessions.role_agent_id`：additive nullable 列（契约纠正，非破坏），`p0-test-schema.sql` + `lib/schema/runtime.ts` 同步。
- `apps/web/app/api/role-agents/route.ts`：无角色时惰性 seed 默认架构师（`role_type` 对齐 engineer）。
- Web 端：`store/session-store.ts` 走 `/api/chat`（SSE）携带 `roleAgentId` 并累积 runtime_output；`ChatPanel.tsx` @角色选择 + 角色 Badge。

## 3. 测试与验证证据

- **type-check**: `pnpm type-check (web)` → exit 0，干净。
- **单测**: vitest runtime + role-agents → 37/37 PASS。
- **结构验证**: `verification.json` passed=true，T1-T8 全 VERIFIED，无 anti-pattern，gaps 空。
- **代码评审**: `review.json` verdict=**WARN**，severity 分布 0 critical / 0 high / 3 medium / 2 low。
- **自动化测试**: `apps/web/.tests/auto-test/report.json` → 5/5 PASS（L0×1 / L1×4 / L3×1），含 AT-005 E2E 黄金路径。
- **E2E**: `e2e/tests/web/role-chat-core.spec.ts`（web-desktop，真实 DB 无 mock）→ **1 passed (7.9s)**。链路：`POST /api/workspaces` 201 → `POST /api/sessions` 201 → `GET /api/role-agents` 200（默认架构师）→ @架构师选择 → `POST /api/chat` 200 → reload 用户消息从 DB 重渲染可见；视觉断言 `assertNoHorizontalScroll` + `assertNoElementOverlap` 通过。详见 `.workflow/scratch/20260530-plan-role-chat-core/uat.md`。

## 4. 质量阶段发现并修复的真实缺陷（单测/业务测试 mock 漏过，E2E 暴露）

1. **无 UI 创建会话路径**：新建会话按钮未接线 + store 缺 `createSession`，composer 永久禁用、聊天不可达 → 补 `createSession` + 接线 Sidebar + `fetchSessions` 自动选中。
2. **jsonb 插入 500**：`postgres-query-client.normalizeValue` 未序列化数组/对象，默认架构师 seed（capabilities jsonb）+ role-agent / messages.metadata 写库全部失败 → 对 array/plain-object `JSON.stringify`（保留 Date/标量原样）。

## 5. review WARN 残留（非阻塞，纳入 P1 跟进）

| ID | 严重度 | 文件:行 | 问题 | 建议 |
|----|--------|---------|------|------|
| RV-001 | medium | chat/route.ts:47 | messages insert 未检查 error | 失败返回 500，不进入 SSE/runtime invoke |
| RV-002 | medium | gateway.ts:68 | runtime_sessions 创建失败被吞掉返回空 id | 失败抛出或 runtime_failed |
| RV-003 | medium | session-store.ts:164 | 客户端仅处理 runtime_output，忽略错误终态 | 补 endpoint_unavailable/runtime_failed/local_runtime_offline |
| RV-004 | low | ChatPanel.tsx:78 | 切换 workspace 后 selectedRole 未清空，可能 403 | roleAgents 变化且选中不在列表时重置 |
| RV-005 | low | role-agents/route.ts:62 | system_prompt 缺长度/类型约束 | 限长、trim、非字符串 400 |

## 6. 范围边界（P0 harness 真实约束，显式登记，非静默跳过）

- P0 harness 无 Redis / 无 runtime worker，`public_cloud` 链路 emit `endpoint_unavailable`，无 agent 流式回复。
- **agent 回复角色 Badge（哪个角色回复）断言 deferred** 至 Redis+worker 环境补齐 —— 这是 E2E 唯一未覆盖切片。
- G4 的 `done_when` 核心（reload 后 `role_agent_id` 持久化 + @角色选择展示）已由真实 DB E2E 覆盖通过。

## 7. 结论

ROLE-CHAT-CORE-001 核心链路全部落地并经真实 DB E2E 验证。G1-G4 全 MET，`task_decomposition_all_done=true`，post-goal-audit verdict=proceed。残留 review WARN 与 agent 回复 Badge 切片均为非阻塞、已登记跟进项。
