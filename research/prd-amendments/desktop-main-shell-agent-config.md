# PRD 修订：Desktop 主界面与 Agent 配置中心

**日期：** 2026-05-26
**状态：** 已采纳，需同步到 `research/prd.md`、`research/product/product-design.md`、`research/product/ui-design-system.md` 和 Desktop Trellis 任务
**绑定需求：** `FR-DESK-001`, `FR-RUNTIME-001`, `FR-CHAT-001`, `FR-UI-001`

---

## 1. 修订背景

当前 Electron Desktop 实现被执行成单页 Connector 状态面板：主界面只有运行时检测、工作区绑定、活动和审批卡片；“打开 Web 工作台”只打开 `http://localhost:3000/workspace`，在本地没有有效工作台时会变成空白。

这不符合 P0 UI 质量底线。Desktop P0 不能只是粗浅检测页，而应该是可持续操作的桌面主界面：左侧导航/Session，中间本地 Agent 轻量会话，右侧 Agent 配置与 Runtime 状态面板。

---

## 2. 修订结论

Desktop P0 仍不是完整 Web 三栏工作台，但必须提供一个完整桌面主壳：

| 区域 | P0 要求 |
| --- | --- |
| 左侧导航 | 本地 Workspace、最近 Session、本地 Agent、待审批、设置入口、登录/账号入口 |
| 中间主区 | 本地 Agent 轻量会话，展示消息、运行流、执行状态、失败原因、待审批提示和轻量输入框 |
| 右侧面板 | Agent 配置中心与 Runtime 状态，展示 Codex、Claude Code、OpenCode 等卡片 |
| 底部/顶部状态 | Connector 在线状态、当前 Workspace、设备名、最近心跳、打开 Web 工作台入口 |

Agent 配置中心必须区分：

- `Codex`：P0 已接入，检测安装、版本、认证状态、CLI path、能力声明、进入会话。
- `Claude Code`：P0 已接入，检测安装、版本、认证状态、CLI path、能力声明、进入会话。
- `OpenCode`：P0 展示为“待接入”，不可进入会话。
- 其他 CLI/Agent：P0 可展示为“待接入”或“即将支持”，不可渲染可编辑密钥表单。

---

## 3. 参考项目使用方式

- AionUi：参考 Desktop `Layout + Sider + Router` 主壳、`LocalAgents` 检测列表、`AgentCard` 信息层级、`ChatLayout` 轻量会话结构。
- codeg：参考 `Sidebar`、`ConversationShell`、`MessageInput`、`PermissionDialog` 的 shadcn 工作台视觉与交互结构。
- cherry-studio：只参考桌面密度和设置分组，不采用 Provider/API Key 配置视觉。

允许阅读参考项目代码并迁移结构思想，但不能照搬不符合 AgentHub PRD 的 Provider/API Key 流程。

---

## 4. 禁止项

- 禁止 Desktop 继续只有一个纵向卡片检测页。
- 禁止“打开 Web 工作台”打开空白或无效路径；若 Web 未运行或 Workspace 不存在，必须展示明确状态和修复动作。
- 禁止把 Codex/Claude Code 配置成 API Key、Base URL 或环境变量保存表单。
- 禁止 Electron renderer 直接拼 shell 命令。
- 禁止 OpenCode 等未实现 Runtime 被展示成可执行。

---

## 5. 验收标准

- [ ] Electron 启动后默认进入 Desktop 主壳，而不是单页检测面板。
- [ ] 左侧导航、中央本地 Agent 会话、右侧 Agent 配置/Runtime 状态同时存在或可折叠访问。
- [ ] Codex 和 Claude Code 显示为 P0 已接入 Runtime；OpenCode 和其他 Runtime 显示为待接入。
- [ ] 已接入 Runtime 可从 Agent 卡片进入本地轻量会话；待接入 Runtime 不可进入会话。
- [ ] 打开 Web 工作台入口必须指向有效 Workspace 路径；Web 不可用时展示中文错误和下一步。
- [ ] Playwright Electron 覆盖主壳、Agent 配置中心、Runtime 卡片、轻量会话、打开 Web 失败/成功状态、敏感字段禁止项和截图。
