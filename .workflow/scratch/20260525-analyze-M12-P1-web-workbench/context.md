# Analysis Context: M12 Phase 1 — Web 三栏 IM 工作台

## Locked Decisions

| ID | Decision | Reason |
|----|----------|--------|
| D1 | CSS Grid 三栏布局 (280px / 1fr / 320px) | 响应式 + 右栏可折叠 |
| D2 | zustand store 管理消息/会话状态 | 已有依赖 |
| D3 | 100% 消费 @agenthub/ui 组件 | M12 红线 |
| D4 | StateCard 处理 loading/empty/error | M12 红线 |
| D5 | 路由入口: (workspace)/workspace/[id]/page.tsx | 已有骨架 |

## Free Decisions

| ID | Decision | Notes |
|----|----------|-------|
| D6 | Mock data 层 | 后端不在范围 |

## Deferred

- 真实 WebSocket 消息推送（后续 milestone）
- 右栏 Artifact 预览渲染引擎

## Architecture Notes

- 现有 workspace/page.tsx 使用行内样式，需重构为 @agenthub/ui 组件
- 现有 workspace/[id]/page.tsx 需要变为三栏工作台入口
- 需新建: Sidebar, SessionList, ChatPanel, MessageComposer, ArtifactPanel 组件
- data-testid 约定: workspace-shell, chat-panel, message-composer, artifact-panel, session-list
