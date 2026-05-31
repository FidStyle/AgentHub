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
- `research/product/desktop-p0-ui-ux-contract.md`
- `research/product/product-design.md`
- `research/product/ui-design-system.md`
- `research/architecture/technical-design.md`
- `.trellis/spec/frontend/ui-style-guidelines.md`
- `.trellis/tasks/05-25-desktop-connector-console-ui/prd.md`

## 4. UI 参考

- codeg：`Sidebar`、`ConversationShell`、`MessageInput`、`PermissionDialog`，用于 shadcn 工作台母版和会话交互。
- AionUi：`Layout`、`Sider`、`Router`、`LocalAgents`、`AgentCard`、Desktop `ChatLayout`，用于桌面主壳、Agent 配置中心和本地轻量会话结构。
- cherry-studio：只参考桌面密度和设置分组，不采用 Provider/API Key 设置页视觉。

## 5. 必须做

- Desktop 启动默认进入完整主壳，不是单页检测面板。
- 左侧导航包含：本地 Workspace、最近 Session、本地 Agent、待审批、设置、登录/账号入口。
- 左侧导航必须是可点击导航，不是静态装饰。点击后必须切换中间主内容，并维护当前 active 状态。
- 中间主区包含：本地 Agent 轻量会话、运行流、最近消息、执行状态、失败原因、轻量输入框。
- 右侧面板包含：Agent/Runtime 摘要、状态、最近诊断和管理入口；完整 Agent 配置中心必须也能通过左侧“本地 Agent”进入独立配置页。
- Agent 配置中心展示 Codex、Claude Code、OpenCode 和其他预留 Runtime。
- Codex、Claude Code 是 P0 已接入，可检测、可展示状态、可在 ready 时进入轻量会话。
- OpenCode 和其他 Runtime 是 P0 待接入，只能展示“待接入”，不可进入会话，不出现密钥表单。
- 打开 Web 工作台入口必须有有效目标；目标不可用时在 Desktop 内展示中文错误和下一步，不允许打开空白页。
- Desktop 普通展示文本、Workspace/项目路径、导航文字和状态文案默认禁止鼠标选中/复制；输入框、文本域、日志详情和明确复制动作可例外。
- Desktop 所有登录/账号入口必须统一到同一个 GitHub OAuth 登录动作或登录状态控制器，不允许顶部、侧栏、设置页各自分叉实现。
- 所有可见按钮必须有明确交互反馈：页面切换、状态变化、loading/disabled、错误提示或中文不可用原因。禁止按钮点击后静默无响应。
- 入口、项目、会话、Agent 卡、Runtime 卡、设置项、待审批卡必须可点击或明确 disabled；只有纯状态文本允许不可点击。
- 默认 Workspace 页、Agent 配置页、设置页、待审批页必须像同一个 Desktop 产品，采用 AionUi 的结构密度和 codeg/shadcn 的视觉母版。
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
- 点击左侧“本地 Agent”后显示 `desktop-agent-config-page`，点击“待审批”后显示 `desktop-approvals-page`，点击“设置”后显示 `desktop-settings-page`。
- 左侧 active 状态必须随页面切换更新，不允许只有 hover 外观。
- 在独立 Agent 配置页点击 Codex/Claude Code 的“进入会话”后切回 `desktop-agent-session`，并显示当前选中的 Agent。
- Agent 配置中心显示 Codex、Claude Code、OpenCode；Codex/Claude Code 为已接入，OpenCode 为待接入且不可执行。
- Runtime ready 时，Codex/Claude Code 卡片有进入轻量会话动作。
- 打开 Web 工作台目标不可用时显示中文错误和下一步，不出现空白页。
- 敏感字段断言：Desktop 页面不存在 `API Key`、`ANTHROPIC_API_KEY`、`OPENAI_API_KEY`、`Base URL`。
- 复制禁止断言：拖选 Desktop 普通展示区域后，`window.getSelection().toString()` 必须为空；输入框和日志详情等白名单区域不受此限制。
- 登录统一断言：所有登录/账号按钮必须共享同一个 `data-auth-action="github-login"` 或等价统一定位点；点击任一入口都进入同一个 GitHub 登录状态或弹出同一个登录提示。
- 按钮交互审计：主要按钮必须被 E2E 点击一次，断言产生页面切换、状态变化、错误提示或 disabled/loading 状态；待接入按钮必须 disabled 且不可执行。
- 点击语义断言：Workspace 项、最近会话项、Agent 卡、Runtime 卡、设置项、待审批卡必须可点击或明确 disabled，并有中文不可用原因。
- 视觉断言：1200x800 下主壳无横向滚动，左/中/右三区不重叠；默认 Workspace 页、Agent 配置页、设置页、待审批页都必须截图留存。

### 再改实现

- 重构 `apps/desktop/src/renderer/App.tsx` 和 console 组件为桌面主壳。
- 增加 Agent 配置中心、Session 侧栏、本地轻量会话组件。
- 修正打开 Web 工作台入口的状态反馈。
- 保持底层执行仍走后端、DeviceChannel 和 Desktop main，不绕过权限策略。

## 8. Definition of Done

- [ ] Electron Desktop 默认界面是完整主壳。
- [ ] 左侧导航/Session、中间本地 Agent 轻量会话、右侧 Agent/Runtime 摘要和独立 Agent 配置页都可访问。
- [ ] 左侧导航点击能切换本地工作区、最近会话、本地 Agent、待审批、设置页面。
- [ ] Codex/Claude Code 已接入，OpenCode 等待接入状态清晰。
- [ ] Codex/Claude Code 可从独立 Agent 配置页进入轻量会话。
- [ ] 打开 Web 工作台不会出现空白页。
- [ ] Desktop 普通文本不可选中/复制，登录入口统一为 GitHub OAuth，按钮交互审计通过。
- [ ] 入口、项目、会话、Agent 卡、Runtime 卡、设置项、待审批卡符合“可点击或明确 disabled”的点击语义。
- [ ] 默认 Workspace 页、Agent 配置页、设置页、待审批页均完成 P0 视觉设计和截图门禁。
- [ ] Electron E2E、截图、布局断言、敏感字段断言通过。
- [ ] 通过后才能继续三端视觉统一返工和最终 Phase 4。
