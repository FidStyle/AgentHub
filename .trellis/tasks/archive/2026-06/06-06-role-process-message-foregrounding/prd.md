# 角色过程消息完整前台化

## Goal

用户发送固定开发需求后，中央 IM 必须显示完整、多角色、可审计的真实开发过程，而不是只在右侧 timeline 或后台 runtime 中保留证据。Orchestrator、后端工程师、前端工程师各自的接收、执行、工具/权限、handoff、完成、失败或等待状态都必须作为同 session 消息可见并可刷新读回。

## Source of Truth

- `bytedance_init_prd.md`
- `bytedance_init_video_txt.txt`
- `.trellis/spec/cross-layer/real-flow-acceptance.md`
- 用户 2026-06-06 反馈：前端和后端工程师这些角色应在聊天记录中像架构师一样显示完整流程，不能把后台执行输出隐藏。

## Requirements

- 中央 IM 是主证据面板；右侧过程/Git/文件/产物面板只能作为辅助证据。
- 每个执行角色必须有自己的可见消息：
  - Orchestrator 分工与后续验收。
  - 后端工程师接收任务、执行过程、权限/工具状态、完成或等待。
  - 前端工程师接收任务、执行过程、权限/工具状态、完成或等待。
- 工具与权限过程必须挂在触发它的角色消息下，审批状态只表达授权状态：待确认、已允许、已拒绝、已执行、执行失败。
- 授权允许后必须出现同角色的继续执行可见消息；拒绝后必须显示停止并等待下一次用户输入。
- 流式临时消息与数据库持久消息刷新后应保持同等语义。
- 严格验收脚本必须失败检测：如果 `/api/messages` 中缺少后端/前端角色过程消息、权限继续消息、handoff 或最终 Orchestrator 验收，则不能通过。

## Acceptance Criteria

- [ ] `/api/chat` 为角色过程生成可见、持久的 `messages` 行，带 `role_agent_id`、`message_type`、`metadata.visibleStatus`、`planId`、`planNodeId` 等引用。
- [ ] SSE 消费端能即时显示 role process / handoff / tool / permission / continuation 过程消息。
- [ ] Web 中央 IM 刷新后仍显示完整角色流程。
- [ ] Mobile/PWA 同 session 读回核心角色过程和权限状态。
- [ ] `verify-strict-single-prompt-product-delivery.ts` 增加中央 IM 完整流程断言。
- [ ] API/store/UI 单测覆盖新增消息事件和权限继续路径。
- [ ] Web type-check、相关 Vitest、strict gate 或 focused strict validator 通过。

## Out of Scope

- 不改变生成 calculator + SQLite 产物本身。
- 不实现新的 Electron OpenCLI adapter；无 adapter 时继续使用已接受的 Playwright fallback。
- 不启动最终 Demo 包或 3 分钟素材。

## Technical Notes

- 后端主路径：`apps/web/app/api/chat/route.ts`
- 前端 store：`apps/web/store/session-store.ts`
- 消息渲染：`apps/web/components/workspace/ChatPanel.tsx`、`apps/web/components/workspace/MessageContent.tsx`
- 验收脚本：`apps/web/scripts/verify-strict-single-prompt-product-delivery.ts`
