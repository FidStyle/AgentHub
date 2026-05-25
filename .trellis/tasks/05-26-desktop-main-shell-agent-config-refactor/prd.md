# Desktop 主界面与 Agent 配置中心返工

## 1. 目标

当前 Electron Desktop 不能继续停留在单页 Connector 检测面板。P0 要求 Desktop 是一个可持续操作的桌面主界面：左侧导航/Session，中间本地 Agent 轻量会话，右侧 Agent 配置中心与 Runtime 状态。

本任务先补 Electron E2E，再返工 Desktop UI 和必要的打开 Web 工作台状态逻辑。

## 2. 绑定需求

- `FR-DESK-001`
- `FR-RUNTIME-001`
- `FR-CHAT-001`
- `FR-UI-001`

## 3. 上游依据

- `research/prd.md`
- `research/prd-amendments/desktop-main-shell-agent-config.md`
- `research/product-design.md`
- `research/ui-design-system.md`
- `research/technical-design.md`
- `.trellis/spec/frontend/ui-style-guidelines.md`
- `.trellis/tasks/05-25-desktop-connector-console-ui/prd.md`

## 4. UI 参考

- codeg：`Sidebar`、`ConversationShell`、`MessageInput`、`PermissionDialog`，用于 shadcn 工作台母版和会话交互。
- AionUi：`Layout`、`Sider`、`Router`、`LocalAgents`、`AgentCard`、Desktop `ChatLayout`，用于桌面主壳、Agent 配置中心和本地轻量会话结构。
- cherry-studio：只参考桌面密度和设置分组，不采用 Provider/API Key 设置页视觉。

## 5. 必须做

- Desktop 启动默认进入完整主壳，不是单页检测面板。
- 左侧导航包含：本地 Workspace、最近 Session、本地 Agent、待审批、设置、登录/账号入口。
- 中间主区包含：本地 Agent 轻量会话、运行流、最近消息、执行状态、失败原因、轻量输入框。
- 右侧面板包含：Agent 配置中心、Runtime 状态、能力声明、最近诊断、待接入 Runtime。
- Agent 配置中心展示 Codex、Claude Code、OpenCode 和其他预留 Runtime。
- Codex、Claude Code 是 P0 已接入，可检测、可展示状态、可在 ready 时进入轻量会话。
- OpenCode 和其他 Runtime 是 P0 待接入，只能展示“待接入”，不可进入会话，不出现密钥表单。
- 打开 Web 工作台入口必须有有效目标；目标不可用时在 Desktop 内展示中文错误和下一步，不允许打开空白页。
- 所有新增界面必须复用统一 codeg/shadcn 视觉母版和 `@agenthub/ui` 组件语言。

## 6. 不做

- 不把 Desktop 做成完整 Web 三栏 Artifact/Context/Agents/Preview 工作台。
- 不新增 API Key、Base URL、`ANTHROPIC_API_KEY`、`OPENAI_API_KEY` 或环境变量保存表单。
- 不让 Electron renderer 直接拼 shell 命令或直接执行轻量会话指令。
- 不把待接入 Runtime 渲染成可执行。

## 7. TDD 与测试计划

### 先写测试

- Electron 启动后显示 `desktop-main-shell`、`desktop-session-sidebar`、`desktop-agent-session`、`desktop-agent-config`。
- 启动后不再只显示一个纵向卡片检测面板。
- Agent 配置中心显示 Codex、Claude Code、OpenCode；Codex/Claude Code 为已接入，OpenCode 为待接入且不可执行。
- Runtime ready 时，Codex/Claude Code 卡片有进入轻量会话动作。
- 打开 Web 工作台目标不可用时显示中文错误和下一步，不出现空白页。
- 敏感字段断言：Desktop 页面不存在 `API Key`、`ANTHROPIC_API_KEY`、`OPENAI_API_KEY`、`Base URL`。
- 视觉断言：1200x800 下主壳无横向滚动，左/中/右三区不重叠。

### 再改实现

- 重构 `apps/desktop/src/renderer/App.tsx` 和 console 组件为桌面主壳。
- 增加 Agent 配置中心、Session 侧栏、本地轻量会话组件。
- 修正打开 Web 工作台入口的状态反馈。
- 保持底层执行仍走后端、DeviceChannel 和 Desktop main，不绕过权限策略。

## 8. Definition of Done

- [ ] Electron Desktop 默认界面是完整主壳。
- [ ] 左侧导航/Session、中间本地 Agent 轻量会话、右侧 Agent 配置中心都可访问。
- [ ] Codex/Claude Code 已接入，OpenCode 等待接入状态清晰。
- [ ] 打开 Web 工作台不会出现空白页。
- [ ] Electron E2E、截图、布局断言、敏感字段断言通过。
- [ ] 通过后才能继续三端视觉统一返工和最终 Phase 4。
