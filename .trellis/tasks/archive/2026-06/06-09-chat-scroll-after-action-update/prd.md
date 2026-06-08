# 修复命令状态更新后聊天滚动位置

## Goal

用户在聊天里执行命令或审批操作后，系统会刷新会话消息记录以读回最新执行状态和后续消息；刷新后 Web 聊天记录应自动回到底部，让用户继续实时查看最新状态，不需要手动反复滚到底部。

## What I Already Know

- 用户反馈：执行命令后历史会话记录会刷新一遍，当前位置不在底部，需要手动回到底部看实时状态。
- Web 权限卡在 `apps/web/components/workspace/MessageContent.tsx` 中审批后会调用 `fetchMessages(activeSessionId)`，并按多个延迟继续轮询刷新。
- Web `MessageList` 当前没有类似 Mobile 的底部锚点滚动逻辑。
- Mobile/PWA `apps/web/app/m/sessions/[sessionId]/page.tsx` 已在 `messages` 变化时调用 `bottomRef.current?.scrollIntoView({ behavior: 'smooth' })`。

## Requirements

- Web 聊天消息列表在消息数量、消息 ID、消息内容或消息可见状态变化后，自动滚动到底部。
- 刷新消息仍允许全量读回，避免漏掉审批后的 runtime 后续消息、权限卡状态和执行结果。
- 空态、加载态和没有 active session 时不应报错。
- 逻辑应尽量局部，不改 API/DB/message schema；允许在 Web store 增加本地刷新计数，用于同内容读回时触发置底。

## Acceptance Criteria

- [ ] 审批或命令状态导致 `fetchMessages` 刷新后，Web 消息列表会置底。
- [ ] 新消息追加、消息状态变更和消息内容流式增长都能触发置底。
- [ ] 不影响固定上下文跳转到指定消息的行为。
- [ ] 有单元测试覆盖滚动触发签名变化和无 DOM 时的安全行为。
- [ ] Web type-check、lint、相关测试通过。

## Out Of Scope

- 不做 WebSocket/SSE 局部 patch 单条 message/action 状态。
- 不改 `fetchMessages` 的 API、数据库模型或消息 schema。
- 不处理 Mobile/PWA，因为 Mobile 已有底部滚动逻辑。

## Technical Notes

- 相关文件：
  - `apps/web/components/workspace/ChatPanel.tsx`
  - `apps/web/components/workspace/MessageContent.tsx`
  - `apps/web/store/session-store.ts`
  - `apps/web/app/m/sessions/[sessionId]/page.tsx`
