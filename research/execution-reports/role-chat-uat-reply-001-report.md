# ROLE-CHAT-UAT-REPLY-001 执行报告

- **任务**: Web 角色对话可见 agent 回复闭环 + UI 可用性 UAT
- **里程碑**: M-adhoc-20260530-role-chat-uat-reply（Ralph session `ralph-20260530-190032`）
- **日期**: 2026-05-30
- **计划/产物目录**: `.workflow/scratch/20260530-plan-role-chat-uat-reply/`

## 1. 交付范围

| 子目标 | 内容 | 状态 |
|--------|------|------|
| G1 | 诊断并接线 runtime 回复路径：`/api/chat` 连通 runtime worker 或明确 FakeExecutor，dev/test 有清晰可见回复（不伪装生产） | ✅ MET |
| G2 | Web UI：@架构师发送后展示可见 agent 回复（带角色上下文标识），三栏/composer/role picker/发送按钮对齐可点击无重叠遮挡横向滚动 | ✅ MET |
| G3 | 真实浏览器 UAT/E2E：open → @架构师 → 发送 → 等到 agent 回复文本可见 → 带 role 上下文 → reload 用户+agent 消息都保留 | ✅ MET |
| G4 | 质量评审通过 + 治理台账更新：regression-ledger/project-tracker 同步，ROLE-CHAT-CORE-001 agent 回复 deferred 重定级 P0 并修复后关闭 | ✅ MET（本报告） |

## 2. 根因

ROLE-CHAT-CORE-001 在 P0 harness（无 Redis/worker）下将「可见 agent 回复 + 角色 Badge」断言 deferred，导致用户在 localhost:3000 @架构师发送后只见用户消息、无 agent 回复。根因有二：

1. **回复未落库**：`/api/chat` 流式消费 runtime 事件后未持久化 agent 回复，reload 即丢失。
2. **UAT harness 缺 runtime**：E2E 未拉起 Redis+worker，无法端到端验证可见回复。

## 3. 关键实现

- `apps/web/app/api/chat/route.ts`：流式累积 `runtime_output.delta`，仅在 `runtime_completed && reply` 非空时以 `sender_type=agent` 落 messages（no-fake-success：失败/不可用终态不伪造成功消息）。
- `apps/web/store/session-store.ts`：渲染 runtime 终态提示（仅 `!replyCreated` 时），`roleAgentId=null` 区分系统提示与 agent 回答。
- `package.json`：新增 `env:runtime:up` / `env:runtime:down` / `dev:full` 编排脚本。
- `e2e/global-setup.ts` + `e2e/helpers/auth-state.ts`：`RUNTIME_E2E=1` 拉起 Redis + worker(FakeExecutor) 接同一 p0 DB；修复 auth cookie 取裸 token（`split('=').pop()`），消除全 spec 401。
- `e2e/tests/web/role-chat-uat-reply.spec.ts`：硬验收 spec，等到可见回复 + role badge + 视觉断言 + reload 双向持久化。

## 4. 测试与验证证据

- **单测**: `npx vitest run __tests__/api/chat.test.ts` → chat suite 6/6 PASS，含新增 AT-005（completed → agent 回复落库）/ AT-006（未 completed → 不落库，no-fake-success）。
- **结构验证**: `verification.json` passed=true，5 must_haves 全 VERIFIED，anti_patterns.blockers 空，gaps 空。
- **代码评审**: `review.json` verdict=**PASS**，severity 0 critical / 0 high / 0 medium / 1 low（agent insert 未单独 try/catch，与既有 user insert 同模式，非阻塞）。
- **UAT/E2E**: `cd e2e && RUNTIME_E2E=1 npx playwright test --project=web-desktop web/role-chat-uat-reply.spec.ts web/web-workspace-ux.spec.ts web/role-chat-core.spec.ts` → **3 passed**，真实 DB+Redis+worker，无主链路 mock。DB 校验 messages 表同时存在 `sender_type=user` 与 `sender_type=agent`（role_agent_id 非空）行。详见 `.workflow/scratch/20260530-plan-role-chat-uat-reply/uat.md`。

## 5. 质量阶段发现并修复的回归（本任务引入）

TASK-005 让 agent 回复落库后，FakeExecutor 回显「系统提示+问题文本」使裸 `getByText(msg)` 在 reload 后命中用户消息与 agent 回显两处，触发 strict-mode violation。统一修复为按用户气泡 `.bg-primary/10` 精确定位（`web-workspace-ux.spec.ts:81` / `role-chat-core.spec.ts:65` / `role-chat-uat-reply.spec.ts:72`）。P0 无 worker 时该气泡仍是唯一匹配，修复 harness-agnostic。

## 6. 已知非阻塞观察

首次冷启动偶发 `message-role-badge` 30s 超时：Next.js dev 首次按需编译 `/api/chat`+`/api/messages` 叠加 worker `dequeue(5)` 轮询，首个 job 可见回复可能逼近 30s；预热后连续全绿。属 dev harness 预热特性，非产物逻辑缺陷。既有 7 个 vitest 失败经 `git stash` baseline 验证在 clean HEAD 同样存在，判定 out_of_scope。

## 7. 结论

ROLE-CHAT-UAT-REPLY-001 关闭 ROLE-CHAT-CORE-001 deferred 的「可见 agent 回复 + 角色 Badge」P0 缺口。G1-G4 全 MET，真实 DB+Redis+worker E2E 端到端验证通过。
