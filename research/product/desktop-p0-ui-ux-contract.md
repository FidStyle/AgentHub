# Desktop P0 UI/UX 契约：可操作主壳与点击语义

**日期：** 2026-05-26  
**状态：** 已采纳，供 Maestro/Ralph 执行 Desktop UI 返工时强制引用  
**绑定需求：** `FR-DESK-001`, `FR-RUNTIME-001`, `FR-CHAT-001`, `FR-UI-001`

---

## 1. 背景

当前 Desktop UI 的问题不是单纯“不够美化”，而是产品结构和交互语义不完整：有些区域只是纯文字或静态卡片，用户看不出哪些能点、点了会发生什么；有些看起来像入口却没有行为；有些按钮缺少 hover、active、loading、disabled 或错误反馈。

P0 阶段必须把 Desktop UI 设计完，至少达到“可操作桌面应用”的完整程度，而不是静态三栏演示页。

Desktop 的产品边界是：本地 Runtime 可用性检测、Workspace 绑定、本机策略、执行日志、越权授权记录、诊断、Codex / Claude Code 本地轻量对话和运行态查看。主要多 Agent 协作、完整任务对话、跨 Session 管理、Context/Changes/Artifacts、复杂代码编辑和发布部署仍由 Web 工作台承担。授权入口统一在 Web/Mobile 当前 Session，Desktop 不做审批中心和二次确认弹窗。

因此 Desktop 不能做成纯配置页，也不能复制完整 Web 工作台。它应是“本地 Agent 控制台”：用户能判断本地能不能用、当前本地 Runtime 在做什么、是否受本机策略限制、是否可以继续/重试/停止，并能跳转 Web 处理完整任务。

---

## 2. 参考项目核心结论

### 2.1 AionUi 采用点

参考：

- `refer_proj/AionUi/packages/desktop/src/renderer/components/layout/Sider/index.tsx`
- `refer_proj/AionUi/packages/desktop/src/renderer/pages/settings/AgentSettings/LocalAgents.tsx`
- `refer_proj/AionUi/packages/desktop/src/renderer/pages/settings/AgentSettings/AgentCard.tsx`
- `refer_proj/AionUi/packages/desktop/src/renderer/pages/conversation/components/ChatLayout/index.tsx`

采用：

- 侧栏不是装饰列表，而是路由/状态切换入口。
- 顶部工具按钮、搜索入口、设置入口、会话项都要有明确点击动作。
- Agent 配置页按“已检测 Agent / 自定义或待接入 Agent”分区。
- Agent 卡片不只是展示名片，已接入项必须有“进入会话”主动作；待接入项必须明确 disabled 或显示不可用原因。
- 会话页要有标题区、当前 Agent/Workspace 状态、消息/活动区、底部输入区，不能只是空白文本区。

不采用：

- 不采用 Arco 默认视觉皮肤。
- 不复制 AionUi 的完整 Agent 市场和 Provider/API Key 配置流程。

### 2.2 codeg 采用点

参考：

- `refer_proj/codeg/src/components/layout/sidebar.tsx`
- `refer_proj/codeg/src/components/chat/conversation-shell.tsx`
- `refer_proj/codeg/src/components/chat/message-input.tsx`
- `refer_proj/codeg/src/components/chat/permission-dialog.tsx`

采用：

- 视觉母版采用 shadcn 风格：中性底色、细边框、紧凑侧栏、小尺寸图标按钮、清晰 hover/focus。
- 侧栏工具区必须有真实动作：新建、定位、折叠/展开、筛选或设置。
- 会话 Shell 必须由消息区、权限/问题弹窗、输入区、错误/重试状态组合而成。
- 输入区不是一个裸 input，至少要有发送动作、禁用状态、当前 Agent/Workspace 上下文提示。

不采用：

- 不把 Desktop 做成完整 codeg Web IDE。
- 不保留英文 UI 文案。

---

## 3. “该点击的必须点击”交互矩阵

不是所有文字都要点击。规则是：**凡是用户自然会理解为入口、项目、卡片、配置项、会话项、动作区的元素，都必须可点击或明确 disabled；纯状态文本才允许不可点击。**

| 元素类型 | P0 行为 | 不允许 |
| --- | --- | --- |
| 左侧导航项 | 点击切换主内容；有 active 状态；有 hover/focus | 用 `div` 伪装导航、点击无响应 |
| Session/最近会话项 | 点击恢复会话或显示“暂无可恢复会话”的中文状态 | 只显示标题文本 |
| Workspace/本地项目项 | 点击选择当前 Workspace 或打开详情；不可用时 disabled 并显示原因 | 路径只是可复制纯文本 |
| Agent 卡片 | 已接入：卡片或主按钮进入会话；待接入：disabled 并显示“待接入” | 卡片只有名称和状态，没有动作 |
| Runtime 状态卡 | 可重新检测、查看诊断或进入修复引导；ready 时可进入会话 | 状态卡没有任何下一步 |
| 本机策略/执行日志项 | 策略预设、执行状态、失败原因、越权授权记录可查看 | 伪装成旧审批中心或二次确认队列 |
| 设置项 | 可进入对应设置或展示不可用原因 | 设置页只有说明文字 |
| 登录入口 | 统一触发 GitHub OAuth 登录动作 | 顶部、侧栏、设置页各自分叉 |
| 打开 Web 工作台 | 目标可用时打开；不可用时显示中文错误和下一步 | 打开空白页或静默失败 |
| 输入区按钮 | 发送、停止、重试、清空等必须有 disabled/loading 状态 | 点击后无状态反馈 |
| 纯状态文本 | 只展示状态，不需要点击 | 伪装成按钮或入口 |

---

## 4. Desktop P0 页面结构

### 4.1 默认 Workspace 运行态会话页

必须包含：

- 顶部标题区：当前 Workspace、当前 Agent、连接状态、打开 Web 工作台入口。
- 左侧导航：Workspace、最近会话、本地 Agent、本机策略、执行日志、设置、登录。
- 中间运行态会话区：本地 Runtime 输出、最近消息摘要、活动流、失败原因、越权授权记录。
- 底部轻量输入区：诊断、继续、重试、停止、查看状态等本地指令；不承载完整多 Agent 任务流。
- 右侧摘要：Runtime 状态、最近诊断、管理 Agent 快捷入口。

### 4.2 本地 Agent 配置页

必须包含：

- 已接入区域：Codex、Claude Code。
- 待接入区域：OpenCode、其他 Runtime。
- 每张 Agent 卡片包含名称、状态、版本/CLI path、认证状态、能力标签、最近诊断。
- Codex/Claude Code 有进入会话动作。
- OpenCode/其他 Runtime 只有待接入状态和不可用原因，不出现可执行按钮。
- 不出现 API Key、Base URL 或环境变量保存表单。

### 4.3 设置页

必须包含：

- 统一 GitHub 登录入口。
- Desktop Connector 状态。
- 打开 Web 工作台入口。
- 诊断与重新检测入口。
- 所有入口必须共用统一 handler 或统一 `data-auth-action`/`data-action` 语义。

---

## 5. 视觉设计最低标准

- 使用 codeg/shadcn 作为视觉母版：细边框、低饱和背景、紧凑侧栏、统一 Button/Card/Badge/Input。
- 借鉴 AionUi 的结构密度：Agent 卡片有明确头像/图标位、状态、动作区；会话页面有清晰标题区和工作区上下文。
- 禁止大面积无组织纯文字。
- 禁止页面中出现大块空白但没有可操作入口。
- 禁止看起来像按钮的文字没有 hover/focus/active。
- 禁止该点击的区域只有 `cursor-pointer` 但没有键盘可访问语义。
- 禁止每个页面临时写一套颜色、圆角和按钮样式。

---

## 6. E2E 验收要求

必须补充或维护以下断言：

- 点击左侧每个导航项后主内容变化。
- 点击 Workspace/Session/Agent 卡片后有选择、进入会话、详情或中文不可用状态。
- 待接入 Runtime 的按钮 disabled，且不能进入会话。
- 登录入口数量可以多个，但必须共用同一个 GitHub 登录动作。
- 普通展示文本禁止选中复制。
- 每个主要按钮点击后必须产生页面切换、状态变化、loading/disabled、错误提示或中文不可用原因。
- 截图必须覆盖默认 Workspace 页、Agent 配置页、设置页、本机策略页和执行日志页。
- Desktop 轻量输入区不得被验收为完整 Web 聊天替代品；E2E 只验证本地诊断/继续/重试/停止类指令和运行态状态变化，完整任务流必须通过打开 Web 工作台入口进入 Web。
