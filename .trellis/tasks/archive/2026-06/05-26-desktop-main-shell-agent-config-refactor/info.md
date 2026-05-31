# 实现说明：Desktop 主界面与 Agent 配置中心返工

## 重点文件候选

- `apps/desktop/src/renderer/App.tsx`
- `apps/desktop/src/renderer/components/console/*`
- `apps/desktop/src/renderer/store/console-store.ts`
- `apps/desktop/src/main/index.ts`
- `apps/desktop/src/preload/index.ts`
- `e2e/tests/desktop/*.spec.ts`
- `e2e/helpers/visual-assertions.ts`

## 当前问题

当前 `App.tsx` 直接返回 `ConnectorConsole`，`ConnectorConsole` 是一个 `max-w-[720px]` 的纵向卡片流。`WorkspaceBinding` 中“打开 Web 工作台”直接 `window.open('http://localhost:3000/workspace')`，目标不可用时会打开空白。

## 推荐实现顺序

1. 先补 Electron E2E，锁定主壳、Agent 配置中心、轻量会话和打开 Web 工作台状态。
2. 抽出 `DesktopMainShell`，包含左/中/右三区。
3. 把现有 `WorkspaceBinding`、`RuntimeDetection`、`ActivityPanel`、`ApprovalPanel` 移入右侧/状态面板，而不是堆在单页中间。
4. 新增 `DesktopSessionSidebar`、`DesktopAgentConfigPanel`、`DesktopAgentSession`。
5. 扩展 store mock 数据：Codex、Claude Code、OpenCode 和其他 Runtime 的接入状态。
6. 修复打开 Web 工作台状态：有效目标才打开，否则在 Desktop 内显示错误。
7. 跑 `pnpm test:e2e:desktop`，再跑全量门禁。

## 参考代码

- `refer_proj/codeg/src/components/layout/sidebar.tsx`
- `refer_proj/codeg/src/components/chat/conversation-shell.tsx`
- `refer_proj/codeg/src/components/chat/message-input.tsx`
- `refer_proj/AionUi/packages/desktop/src/renderer/components/layout/Layout.tsx`
- `refer_proj/AionUi/packages/desktop/src/renderer/components/layout/Sider/index.tsx`
- `refer_proj/AionUi/packages/desktop/src/renderer/pages/settings/AgentSettings/LocalAgents.tsx`
- `refer_proj/AionUi/packages/desktop/src/renderer/pages/settings/AgentSettings/AgentCard.tsx`

## 风险

- 不能复制 AionUi 的 Arco 视觉或 Provider 设置流程。
- 不能引入本地 Runtime 密钥表单。
- 不能让 renderer 直接执行 shell。
- 不能为了做主壳而把 Desktop 变成完整 Web 工作台。
