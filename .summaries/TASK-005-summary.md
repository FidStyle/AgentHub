# TASK-005: Pin 消息 + 多类型消息渲染 + Artifact 详情面板

## Changes
- `apps/web/components/chat/ChatPanel.tsx`: 新增 Pin 按钮(hover 显示)、多 message_type 渲染(selectedMessageId/onSelectMessage/onPinMessage props)
- `apps/web/components/layout/DetailPanel.tsx`: 新增 selectedMessage/onCloseMessage props，selectedMessage 存在时渲染 Artifact 详情视图
- `apps/web/app/(workspace)/workspace/[id]/page.tsx`: 新增 selectedMessageId state、handlePinMessage(PATCH /api/messages/${id})、handleCloseMessage，并透传 props

## Verification
- [x] `is_pinned` found in ChatPanel.tsx (lines 16, 137, 140, 142)
- [x] `handlePinMessage|Pin|Unpin` found in ChatPanel.tsx
- [x] `plan_card|result_card|approval|system_event` all rendered in ChatPanel.tsx
- [x] `selectedMessage|Artifact Detail` found in DetailPanel.tsx
- [x] `setSelectedMessageId|onSelectMessage|onPinMessage` found in page.tsx
- [x] `PATCH.*api/messages` with `is_pinned` body found in page.tsx
- [x] `tsc --noEmit` in web app passes (no type errors)

## Tests
- [x] `tsc --noEmit -p apps/web/tsconfig.json`: pass (no output = no errors)

## Deviations
- None

## Notes
- Pin 按钮使用 `hoveredId === msg.id` 状态控制显示，非 user 消息才显示
- message_type 渲染使用 `renderMessageContent()` 辅助函数，区分 plan_card/result_card/approval/system_event 四种类型，其余走 ReactMarkdown
- DetailPanel 中 selectedMessage 优先级高于 Agent config：selectedMessage 非空时渲染 Artifact 详情，否则渲染 Agent 表单
- handlePinMessage 调用 `PATCH /api/messages/${id}` 并乐观更新本地 messages 状态
