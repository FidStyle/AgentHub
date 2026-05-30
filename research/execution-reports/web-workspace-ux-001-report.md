# WEB-WORKSPACE-UX-001 执行报告

- **任务**: Web Workspace 真实交互闭环回归修复
- **里程碑**: M-adhoc-20260530-web-workspace-ux（Ralph session `ralph-20260530-174107`）
- **日期**: 2026-05-30
- **计划/产物目录**: `.workflow/scratch/20260530-plan-web-workspace-ux/`（已归档至 `.workflow/milestones/M-adhoc-20260530-web-workspace-ux/artifacts/`）
- **缺陷台账**: `research/regression-ledger.md#reg-20260530-001`

## 1. 交付范围

| 子目标 | 内容 | 状态 |
|--------|------|------|
| G1 | `/workspace/[id]` 读 URL workspace id 选中正确 workspace + Sidebar 不覆盖 + 点击已有 session 触发 fetchMessages | ✅ MET |
| G2 | Playwright E2E：open `/workspace/:id` → 选中 workspace → 点击 session 拉消息 → @架构师走 `/api/chat` → reload 保留 | ✅ MET |
| G3 | 质量评审非 BLOCK + tracker/regression-ledger 更新 | ✅ MET |

## 2. 关键实现（仅 3 个目标文件 + 1 个 E2E，scope-freeze）

- `apps/web/app/(workspace)/workspace/[id]/page.tsx`：`useParams().id` → `WorkspaceShell workspaceId`，将 URL workspace id 透传给壳层。
- `apps/web/components/workspace/WorkspaceShell.tsx`：新增 `workspaceId?` prop 并传给 `Sidebar`。
- `apps/web/components/workspace/Sidebar.tsx`：URL 指定 workspace 权威选中——`fromUrl`（命中列表）优先；仅当无 URL id 且无现选中时才回退第一个，不再默认覆盖。新增 `data-testid="workspace-switcher"` 作为权威选中指示器。
- `apps/web/store/session-store.ts`：`setActiveSession(id)` 在设置 id 后调用 `get().fetchMessages(id)`，点击已有 session 真实拉消息（`fetchMessages` 已含 non-ok + catch 完整错误处理，调用安全）。
- `e2e/tests/web/web-workspace-ux.spec.ts`（新增）：真实 DB、无主链路 mock，覆盖 ROLE-CHAT-CORE-001 未触及的 deep-link 交互回归。

> `sendMessage→/api/chat`（不退回 `/api/messages`）与“新建会话” onClick 已由前序 ROLE-CHAT-CORE-001 修复，本任务边界显式排除角色链路重做。

## 3. 测试与验证证据

- **type-check**: `apps/web` `tsc --noEmit` → EXIT 0，干净。
- **结构验证**: `verification.json` verdict=**PASS**，`G1_url_workspace_selection` / `G1_sidebar_no_override` / `G1_setActiveSession_fetch` / `G2_e2e_coverage` 全 VERIFIED，anti-pattern 扫描 CLEAN（无 TODO/@ts-ignore/as any/stub），gaps 空。
- **代码评审**: `review.json` verdict=**PASS**，blocking_count=0，无 critical/high；1 条 info（点击已激活 session 重复 GET，属无害冗余，符合刷新语义，不修复）。
- **E2E**: `e2e/tests/web/web-workspace-ux.spec.ts` → **2 passed**（web-desktop + web-tablet，7.0s）。网络证据：`GET /workspace/{ws2Id}` → `GET /api/workspaces` → `GET /api/sessions?workspace_id={ws2Id}`（deep-link 目标，非默认第一个）→ `GET /api/messages?session_id=...`（setActiveSession 拉消息）→ `POST /api/chat 200`（@架构师 routing）→ reload re-fetch 持久化。视觉断言 `assertNoHorizontalScroll` + `assertNoElementOverlap` 通过。
- **回归守护**: `role-chat-core.spec.ts` 单跑单 project → PASS，本次改动未触及 ROLE-CHAT 链路。

## 4. 决策门

post-verify(92%) → post-review(95%) → post-test → post-goal-audit（G1/G2/G3 全 done，`task_decomposition_all_done=true`）→ post-milestone（adhoc 自包含）全部通过。test-gen / quality-test 两个测试阶段按标准 bug-fix 跳过并记录理由（无 spec/`.tests/`/blueprint、verification 无 gaps，真实行为已由 E2E 覆盖，避免生成不成比例测试脚手架）。

## 5. 范围边界与残留（显式登记，非静默跳过）

- P0 harness 无 Redis / 无 runtime worker，`public_cloud` chat 仅断言 user message 持久化与 deep-link 选中，agent 回复流断言 deferred（同 role-chat-core 边界）。
- **REG-20260530-002**（P1 test-infra）：既有 web E2E 共享单一 P0 测试用户，多 worker 并行下 workspace 列表累积污染。属测试隔离设计问题，跨多个既有 spec，超出本任务边界，单列 test-infra 任务处理；CI `workers:1` 可规避。

## 6. 结论

WEB-WORKSPACE-UX-001 三项真实交互缺口全部修复并经真实 DB E2E 验证。G1-G3 全 MET，验证/评审通过，里程碑 `M-adhoc-20260530-web-workspace-ux` 归档完成。REG-20260530-001 待治理门禁通过后转入关闭记录。
