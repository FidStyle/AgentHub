# WEB-WORKSPACE-UX-001 回归登记报告

日期：2026-05-30

## 背景

用户反馈登录后的 Web Workspace 页面“看得到 UI，但感觉无法点击/无法测试功能”。未登录请求 `/workspace/:id` 会被鉴权重定向；因此本次先从代码与既有测试证据判断问题性质。

## 代码发现

- `apps/web/app/(workspace)/workspace/[id]/page.tsx` 只渲染 `WorkspaceShell`，没有读取 URL 中的 workspace id。
- `apps/web/components/workspace/Sidebar.tsx` 默认选中 `/api/workspaces` 返回的第一个 workspace，而不是 URL workspace。
- `Sidebar.tsx` 的“新建会话”按钮没有 `onClick`，不会调用 `POST /api/sessions`。
- `apps/web/store/session-store.ts` 的 `setActiveSession` 只设置 id，不调用 `fetchMessages(sessionId)`。
- `sendMessage` 只写 `/api/messages` 用户消息，没有走 `/api/chat` runtime/agent 链路。

## 流程判断

这是已完成功能面的真实可用性回归，不应继续作为零散聊天处理。此前 P0 readiness audit 已指出部分 E2E 偏页面/入口级，无法证明真实登录态、真实数据库创建、Session 创建、消息发送和刷新后持久化。

## 已完成的治理修正

- `research/project-tracker.md` 新增 `WEB-WORKSPACE-UX-001`，标记为 P0 regression。
- `research/ai-workflow-control.md` 新增“已完成功能优先修复原则”。
- `research/maestro-guidance-playbook.md` 补充完成后不得直接推进新功能，必须先检查未关闭 regression / quality debt。

## 下一步

当前 `RT-WORKER-HARDEN-001` Ralph session 正在 review 阶段，且边界排除 UI 层。应先完成或明确暂停该 session，再启动 `WEB-WORKSPACE-UX-001`：

- `/workspace/[id]` 使用 URL workspace id。
- 新建会话按钮真实创建 session 并选中。
- 点击 session 拉取 messages。
- 发送消息走 `/api/chat` 并展示 runtime/agent 状态或明确错误态。
- Playwright E2E 使用 Auth.js 登录态验证真实 API/DB 结果与 reload 持久化。
