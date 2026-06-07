# 修复 Bytedance 全真实逐步 UAT 阻断

## Goal

修复当前 Bytedance P0/P1 全真实逐步 UAT 暴露的 P0 blocker，直到最新 fresh run 按 `.trellis/spec/cross-layer/real-flow-acceptance.md` 的 `Bytedance P0/P1 Real-Step UAT` 场景全部通过。

核心用户流程必须满足：

1. 用户发送：`做一个加减乘除的简单网站，使用sqlite存储历史记录`
2. Orchestrator/架构师在中央 IM 对话记录中回复任务分工，说明后端、前端、验收和产物推荐怎么执行。
3. 被分配的真实角色（Claude Code / Codex 对应角色）在中央 IM 中回复 Orchestrator 或用户，带有收到/引用/handoff 语义，然后开始实现。
4. 角色实现过程可以多条或单条消息，但必须是可审计的真实角色会话/运行结果转发，不接受仅由程序生成的隐藏状态代替。
5. 角色完成后状态交回 Orchestrator；Orchestrator 判断通过、失败或重新派发。重新派发时继续循环。
6. Orchestrator 通过验收后进入产物阶段，推荐具体产物和交付方式；结束后才对接发布/部署。

## Current Failure Evidence

最新失败报告：`research/execution-reports/bytedance-p0-p1-real-step-uat-2026-06-07.md`

当前 blocker：

- Web 根入口 `http://localhost:3000/` 出 Next.js runtime overlay：`Cannot read properties of undefined (reading 'call')`。
- Fresh full-control run `REAL-STEP-UAT-1780819586-FULL` 失败：35 passed / 23 failed。
- `/api/chat` SSE 出 `endpoint_unavailable` / `Runtime 执行器未就绪，节点未投递。`。
- plan `36f17ce6-ddfb-4484-b533-4535a5aa5b7e` 为 `failed`，4 个节点全 failed，`runtime_sessions = 0`。
- 工作区未生成 calculator 产品文件和 artifact。
- Web workspace UI 读不到 API 可见的 session/messages。
- Mobile/PWA 同 session 显示 `暂无消息`，但 API 有消息和 timeline。
- Desktop/Electron fresh evidence 未形成。
- 本轮 manual allow / reject 分支未覆盖。

## Requirements

- 修复根 Web 入口，使真实用户入口可打开 AgentHub，而不是 runtime overlay。
- 修复 public cloud runtime readiness，使 canonical prompt 能创建 runtime sessions 并执行 Orchestrator/backend/frontend/final validation 节点。
- 中央 IM 必须显示 Orchestrator 分工、真实角色回复/handoff、角色结果、Orchestrator 验收和 artifact 推荐/确认。
- Web workspace session list/chat panel 必须能刷新读回同一 fresh session 的 messages/timeline/status。
- Mobile/PWA `/m/sessions/:sessionId` 必须能刷新读回同一 session 的 messages/status/action/artifact 摘要。
- full-control、manual allow、manual reject 三条权限分支都必须按规范通过。
- Workbench 必须验证 Git、文件树、代码引用、artifact、deploy/runtime 启动脚本和右侧栏宽度持久化。
- 生成的 calculator 产物必须能启动，并通过加减乘除、除零、非法输入/操作符、SQLite history 持久化和刷新读回。
- Web、Mobile/PWA、Desktop/Electron 必须有本轮 fresh evidence；Electron 可以使用明确记录的 Playwright fallback。

## Acceptance Criteria

- [ ] Fresh canonical prompt run 全部 P0/P1 行为为 `pass`，无 `partial`、`blocked`、`not-run`、`failed`。
- [ ] 报告包含 `sessionId`、`workspaceId`、`planId`、fresh marker、`GET /api/messages?session_id=...`、`GET /api/sessions/:sessionId/timeline`。
- [ ] DB/readback 覆盖 messages、plans、plan_nodes、plan_node_attempts、agent_mailbox_items、actions、runtime_sessions、artifacts、role handoffs。
- [ ] Web/Mobile/Desktop evidence 路径齐全。
- [ ] 权限 full-control/manual allow/manual reject 分支齐全。
- [ ] Workbench Git/file/code/artifact/deploy/runtime startup evidence 齐全。
- [ ] Calculator + SQLite 产物行为齐全。
- [ ] 更新 execution report、regression ledger、project tracker、sequential progress。
- [ ] 通过 impacted tests、type-check、lint、build、`git diff --check`、Trellis validate、governance/evidence audit。

## Out of Scope

- 最终 Demo 包、3 分钟视频素材、未开始纯 P2。
- 用历史 pass、旧截图、timeline-only、unit-only 或 fake/script runtime 代替本轮 fresh full real UAT。
