# 修复非完全权限缺少授权卡导致超时失败

## Goal

标准权限、沙箱权限、自动执行等所有非完全控制模式下，Runtime 工具请求不能默认超时失败。系统必须把需要用户确认的 native CLI 工具请求转换为聊天流内联授权卡，并让计划节点进入等待授权状态；用户允许后从同一计划节点续跑，拒绝后保留等待/拒绝状态，不伪装完成。完全控制/危险绕过是唯一可自动继续执行的模式，并且仍必须保留 action 审计。

## What I already know

- 用户实测：标准权限下 Runtime 已连接并进入 running，但没有出现授权卡，最终 `Runtime 输出空闲超时，已终止。`，聊天显示执行失败。
- 用户实测：完全权限下同一需求可以继续输出、完成架构师规划并 handoff 到后端工程师。
- 现有代码已有 `approval_requested`、`message-permission-card`、`/api/actions/:id/approve` 和 waiting plan node 逻辑，但权限等待边界仍可能发 `runtime_failed`，前端会显示“运行时执行失败”。
- 现有 `runtime-worker` 会在 native tool request 时创建 pending action 和 approval message；但真实 Claude Code 标准权限可能在 CLI 内部等待，导致 worker 只能看到 idle timeout。

## Requirements

- 标准权限下需要工具授权时，聊天流必须出现 `message-permission-card`，包含风险、命令/路径、允许本次操作和拒绝按钮。
- 进入授权等待时，不得向用户显示“运行时执行失败，未收到回复”。
- 计划节点、attempt、mailbox 应进入 `waiting`，而不是终态 failed。
- 用户点击允许后，必须走 `/api/actions/:id/approve` 并投递续跑；聊天流能通过刷新/轮询读回审批状态和后续执行结果。
- 完全控制/危险绕过保持现有自动执行行为，不要求用户确认；`standard`、`sandbox`、`auto` 和未知模式都必须走授权卡。
- 如果 Runtime CLI 根本不产生可解析工具请求而只空闲，系统至少要把该状态作为“等待授权/需要用户确认”暴露，而不是默认失败；后续应优先使用可解析权限事件。
- 完整产物生成主流程必须重新验证：非完全权限模式下先等待授权，允许后继续生成，拒绝后不产生副作用；完全控制模式继续覆盖一条从 prompt 到最终 artifact 的完整交付链路。

## Acceptance Criteria

- [ ] 标准、沙箱、自动执行和未知权限模式触发 native tool request 时，SSE 包含 `approval_requested` 和等待终止事件，不包含误导性的 `runtime_failed` 失败提示。
- [ ] Web 聊天流显示 `message-permission-card`，按钮可点击。
- [ ] DB 中对应 `actions.status=pending`、`plan_nodes.status=waiting`、attempt/mailbox 为 waiting。
- [ ] 批准后 permission part 变为 running/completed，并调度续跑。
- [ ] 拒绝后 permission part 变为 rejected，节点保持 waiting，不显示完成。
- [ ] 单测覆盖 worker 权限边界不再发失败终端、Redis 订阅不会超时转失败、前端 store 不显示失败提示、API chat 等待授权状态。
- [ ] 完全控制仍可自动授权并继续完整产物生成，非完全权限必须通过 manual allow/reject 分支才能验收。
- [ ] Web type-check、lint、相关测试通过。

## Out of Scope

- 不改变完全权限的 bypass/auto 行为。
- 不放宽 workspace 外路径安全边界。
- 不把所有 Runtime 空闲超时都当成授权；只针对标准权限/沙箱权限下可能的权限等待边界，必须保留真实故障的失败提示。

## Technical Notes

- 主要文件：
  - `apps/web/server/runtime-worker.ts`
  - `apps/web/lib/runtime/executor.ts`
  - `apps/web/app/api/chat/route.ts`
  - `apps/web/store/session-store.ts`
  - `apps/web/components/workspace/MessageContent.tsx`
  - `apps/web/app/api/actions/[actionId]/approve/route.ts`
  - `apps/web/__tests__/runtime/executor.test.ts`
  - `apps/web/__tests__/api/chat.test.ts`
  - `apps/web/__tests__/session-store.test.ts`
- 相关规范：
  - `.trellis/spec/frontend/component-guidelines.md`：Permission pending 必须显示风险/详情和允许/拒绝按钮。
  - `.trellis/spec/cross-layer/real-flow-queue-consistency.md`：waiting/terminal 队列状态必须一致。
  - `.trellis/spec/cross-layer/real-flow-chat-runtime.md`：Runtime 失败必须可见；等待授权不应伪造成成功或普通失败。
