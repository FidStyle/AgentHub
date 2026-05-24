# TASK-005 Summary: Pin 消息 + Result Card / Plan Card 渲染 + Artifact 详情

**Task**: TASK-005 | **Wave**: wave-4 | **Status**: completed
**Executor**: workflow-executor agent | **Duration**: ~204s
**Commit**: a9bbd7f

## Changes

### apps/web/components/chat/ChatPanel.tsx
- 新增 `selectedMessageId`, `onSelectMessage`, `onPinMessage` props
- 新增 `hoveredId` state 控制 Pin 按钮显示
- 新增 `renderMessageContent()` 辅助函数：
  - `plan_card` → 蓝色背景计划卡片（标题 + 步骤列表）
  - `result_card` → 绿色背景结果卡片（标题 + 状态）
  - `approval` → 黄色待审批卡片
  - `system_event` → 灰色系统事件条
  - `text` → ReactMarkdown 渲染
- Pin 按钮：hover 显示，点击调用 `onPinMessage`
- 消息点击选中，添加 ring 样式

### apps/web/components/layout/DetailPanel.tsx
- 新增 `selectedMessage` 和 `onCloseMessage` props
- 新增 `SelectedMessageDetail` 接口
- Artifact 详情视图：显示类型/发送者/时间/内容/Metadata

### apps/web/app/(workspace)/workspace/[id]/page.tsx
- 新增 `selectedMessageId` state
- 新增 `handlePinMessage` → PATCH `/api/messages/${id}` 更新 is_pinned
- 新增 `handleCloseMessage` → 清除选中
- 传递新 props 给 ChatPanel 和 DetailPanel

## Verification
- [x] is_pinned grep
- [x] Pin 消息/取消 Pin grep
- [x] plan_card/result_card/approval/system_event grep
- [x] selectedMessage/Artifact 详情 grep
- [x] setSelectedMessageId/onSelectMessage/onPinMessage grep
- [x] PATCH api/messages grep
- [x] tsc --noEmit pass
