# ORCHESTRATOR-IM-MARKDOWN-GIT-DIFF-2026-06-03 执行报告

## 范围

本轮按 `research/contracts/ORCHESTRATOR-IM-MARKDOWN-GIT-DIFF-2026-06-03.md` 完成 P0 第一批落地：

- 新增共享合同并登记 `research/index.md`。
- 直接复用/改造 AionUi Markdown renderer 的组件拆分思路，新增 `MessageMarkdown`，统一用户和 Agent 消息渲染。
- 被 `@` 的自定义 Role Agent 在 IM 流中产生任务相关确认消息，并持久化为 `role_acknowledgement`。
- mailbox ready selection 改为同一 session 串行：任意时刻只选择一个 queued inbound work item。
- Git Changes 面板增加 staged/unstaged 分组、per-file diff、stage、unstage、discard 操作。
- discard 走显式确认 UI 和 API `confirm` gate；确认后写入 `actions` 审计记录并执行真实 Git 操作，拒绝时不修改真实工作区。
- acceptance schema、shared database types 和 action type 已同步 `role_acknowledgement` / `git_discard`。

## 关键改动

| 模块 | 文件 | 内容 |
| --- | --- | --- |
| Markdown | `apps/web/components/workspace/MessageMarkdown.tsx` | Markdown/GFM/highlight 渲染、代码块复制、表格横向滚动、链接安全打开 |
| Chat UI | `apps/web/components/workspace/ChatPanel.tsx`, `apps/web/store/session-store.ts` | 所有消息走 Markdown；处理 `role_acknowledgement` SSE |
| Chat API | `apps/web/app/api/chat/route.ts` | 用户消息后为每个选中角色插入并推送任务相关确认消息 |
| Orchestrator queue | `packages/shared/src/orchestrator/mailbox.ts` | 从按 role 并行 ready wave 改为同 session 单 active/ready |
| Git API | `apps/web/app/api/workspaces/[id]/git/*` | 增加 staged diff、stage、unstage、discard routes |
| Git helper | `apps/web/lib/workspace/cloud-workspace-fs.ts` | 增加 status 细分、staged diff、stage/unstage/discard 真实 Git 操作 |
| Changes UI | `apps/web/components/workspace/ArtifactPanel.tsx` | staged/unstaged 分组、操作按钮和 discard 确认 |
| Schema/types | `docker/postgres/acceptance-schema.sql`, `packages/shared/src/database.types.ts`, `packages/shared/src/orchestrator/action.ts` | 同步 role acknowledgement message type 与 Git action 类型 |

## 验证命令

- `pnpm --filter @agenthub/web type-check`：PASS。
- `pnpm --filter @agenthub/web test -- __tests__/api/chat.test.ts __tests__/workspace-files-artifacts.test.ts __tests__/api/plans-actions-owner.test.ts`：PASS，3 files / 22 tests。
- `pnpm --filter @agenthub/shared test`：PASS，5 files / 32 tests。
- 追加旧 action/plan 回归：`pnpm --filter @agenthub/web test -- __tests__/api/chat.test.ts __tests__/api/plans-actions-owner.test.ts`：PASS，2 files / 17 tests。

## 测试覆盖

- Chat API：多角色请求会产生 `role_acknowledgement` SSE 事件，并为每个角色落 durable message。
- Mailbox：同一 session 只选择最早一条 queued inbound；已有 running 时不选择新 work；不同 session 可各选择一条。
- Git helper：真实临时 Git repo 中覆盖 modified -> stage -> staged diff -> unstage -> discard -> clean。
- Type-check：Web 类型通过。

## 未完成与残留风险

- 本轮未启动完整 Playwright acceptance，也未采集浏览器截图；视觉门禁仍需在后续 UAT 中覆盖 Markdown 表格/代码块/diff 的桌面和移动视口。
- `discard` 当前确认后写入 `actions` 审计记录，但尚未完整走 pending approval -> approve endpoint -> dispatch 的统一审批状态机。
- 当前 Git 写操作只覆盖 cloud workspace；local desktop workspace 仍需按 Desktop Connector bridge 单独实现。
- Git P0 未覆盖 latest commit revert、stash、复杂 conflict resolution；这些应按合同作为 P1 扩展。
