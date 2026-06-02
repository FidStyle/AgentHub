# ORCHESTRATOR-IM-MARKDOWN-GIT-DIFF-2026-06-03 执行报告

## 范围

本轮按 `research/contracts/ORCHESTRATOR-IM-MARKDOWN-GIT-DIFF-2026-06-03.md` 完成 P0 第一批落地：

- 新增共享合同并登记 `research/index.md`。
- 直接复用/改造 AionUi Markdown renderer 的组件拆分思路，新增 `MessageMarkdown`，统一用户和 Agent 消息渲染。
- 被 `@` 的自定义 Role Agent 在 IM 流中产生任务相关确认消息，并持久化为 `role_acknowledgement`。
- mailbox ready selection 改为同一 session 串行：任意时刻只选择一个 queued inbound work item。
- Git Changes 面板增加 staged/unstaged 分组、per-file diff、stage、unstage、discard 操作。
- discard 走显式确认 UI、pending `actions` 审批记录、`/api/actions/:id/approve` 授权和 Git API 确认执行；拒绝时不修改真实工作区。
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
| Action dispatch | `apps/web/lib/orchestrator/action-dispatcher.ts` | Git action 审批后短路为等待 Git API 执行，避免误投递 runtime worker |
| Schema/types | `docker/postgres/acceptance-schema.sql`, `packages/shared/src/database.types.ts`, `packages/shared/src/orchestrator/action.ts` | 同步 role acknowledgement message type 与 Git action 类型 |

## 验证命令

- `pnpm --filter @agenthub/web type-check`：PASS。
- `pnpm --filter @agenthub/web test -- __tests__/api/chat.test.ts __tests__/workspace-files-artifacts.test.ts __tests__/api/plans-actions-owner.test.ts __tests__/api/workspace-git-discard-approval.test.ts __tests__/orchestrator/action-dispatcher.test.ts`：PASS，5 files / 25 tests。
- `pnpm --filter @agenthub/shared test`：PASS，5 files / 32 tests。
- 追加旧 action/plan 回归：`pnpm --filter @agenthub/web test -- __tests__/api/chat.test.ts __tests__/api/plans-actions-owner.test.ts`：PASS，2 files / 17 tests。
- opencli Web UAT：`opencli doctor` PASS；`opencli browser agenthub open http://localhost:3000/workspace/84a353ae-80c6-40c7-87ad-6114fe1592f6` 后工作区可渲染；`message-markdown` 7 个实例；页面无横向溢出；Changes 面板显示未暂存 `README.md`，`GET /git/status` 200；点击“查看 diff”后 `GET /git/diff?path=README.md&staged=false` 200，`git-diff-preview` 1 个实例；点击“丢弃”后出现“确认丢弃未暂存改动 / 允许单次执行 / 拒绝”，点击“拒绝”后显示“已拒绝丢弃改动”且文件仍在未暂存列表。
- 2026-06-03 用户复核回归修复：`pnpm --filter @agenthub/web test -- __tests__/message-markdown.test.ts __tests__/session-store.test.ts` PASS（2 files / 7 tests）；`pnpm --filter @agenthub/web type-check` PASS。新增覆盖被压平的 `-` 列表、`1.` 编号列表、代码块不改写、普通 `+` 文本不误判。
- 2026-06-03 opencli 回归 UAT：启动最新 Web dev server 后打开 `http://localhost:3000/workspace/84a353ae-80c6-40c7-87ad-6114fe1592f6?uat=markdown-permission-final-20260603`；页面断言 `ul=7`、`ol=1`、`li=21`、消息流 `permissionCards=1`、按钮文本为 `允许单次执行` / `拒绝`、`plusPhrasePreserved=true`、`overflow=false`。权限卡样本通过真实 `/api/actions` 创建 pending action，再通过真实 `/api/messages` 写入 `metadata.runtimeParts.permission` 后刷新验证。
- 2026-06-03 治理复跑说明：用户复核回归修复提交后，工作区删除入口另有独立提交占用了 latest commit；本报告追加该说明后重新运行 `verify-governance-gate`，确保本合同的最新提交仍覆盖公开报告。

## opencli 截图

- `e2e/artifacts/opencli-uat/web-home-2026-06-03.png`
- `e2e/artifacts/opencli-uat/web-workspace-error-2026-06-03.png`：修复前捕获到工作区 client-side exception。
- `e2e/artifacts/opencli-uat/web-workspace-fixed-2026-06-03.png`：修复后工作区可渲染。
- `e2e/artifacts/opencli-uat/web-changes-panel-2026-06-03.png`
- `e2e/artifacts/opencli-uat/web-changes-diff-2026-06-03.png`
- `e2e/artifacts/opencli-uat/web-git-discard-approval-2026-06-03.png`
- `e2e/artifacts/opencli-uat/web-markdown-list-regression-2026-06-03.png`
- `e2e/artifacts/opencli-uat/web-message-permission-card-live-2026-06-03.png`

## 测试覆盖

- Chat API：多角色请求会产生 `role_acknowledgement` SSE 事件，并为每个角色落 durable message。
- Mailbox：同一 session 只选择最早一条 queued inbound；已有 running 时不选择新 work；不同 session 可各选择一条。
- Git helper：真实临时 Git repo 中覆盖 modified -> stage -> staged diff -> unstage -> discard -> clean。
- Git discard approval API：覆盖未确认创建 pending action + notification、approve endpoint 授权、Git API 确认执行、action completed 回写。
- Type-check：Web 类型通过。
- opencli：真实已登录浏览器状态下覆盖 workspace 进入、Markdown 渲染、Changes 面板、diff preview、discard 审批卡和无横向溢出。
- 回归补充：显示层对上游压平的常见 Markdown 列表/编号文本做保守恢复；消息流 `runtimeParts.permission` 不再只是说明文本，而是提供结构化确认按钮并调用真实 action approve API。

## 结论

- 本合同 P0 范围经用户复核回归后重新收口：IM Markdown、角色确认、同 session 串行调度、cloud Git Changes/Get Diff、stage/unstage/discard、discard 结构化审批、消息流 permission approval 卡均已落地并验证。
- local desktop Git bridge、latest commit revert、stash、复杂 conflict resolution、Mobile/PWA 专项审批视图属于后续增强范围，不作为本次 P0 完成阻塞。
