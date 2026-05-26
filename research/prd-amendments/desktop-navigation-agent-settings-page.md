# PRD 修订：Desktop 可点击导航与独立 Agent 配置页

**日期：** 2026-05-26
**状态：** 已采纳，作为 `FR-DESK-001`, `FR-RUNTIME-001`, `FR-CHAT-001`, `FR-UI-001` 的补充验收契约

---

## 1. 修订背景

Desktop 主壳已经从单页检测面板改为三栏布局，但实现仍停留在静态摆放：左侧导航项没有真实页面切换，Agent 配置只挤在右侧摘要栏，用户无法像 AionUi 的 `Sider + Router + LocalAgents` 那样进入独立配置/检测页，也无法从已检测 Agent 卡片稳定进入会话。

这说明上一轮实现只满足“看得见”，没有满足“可操作桌面应用”的 P0 契约。

---

## 2. 修订结论

Desktop P0 必须具备最小可用路由状态机：

| 导航项 | 点击后的主内容 |
| --- | --- |
| 本地工作区 | 本地 Agent 轻量会话首页，展示当前 Workspace、消息流、执行活动和输入框 |
| 最近会话 | 最近会话列表与恢复入口，空状态也必须可解释 |
| 本地 Agent | 独立 Agent 配置/检测页，展示 Codex、Claude Code、OpenCode 和预留 Runtime |
| 待审批 | 待审批列表页，支持批准/拒绝 |
| 设置 | Connector、账号、Web 工作台入口和诊断说明 |

右侧栏只作为运行摘要、Runtime 状态和快捷入口，不再替代独立 Agent 配置页。

Desktop P0 还必须补齐三类全局交互契约：

| 问题 | P0 要求 |
| --- | --- |
| 本地项目文本可复制 | Desktop 普通展示文本、项目路径、Workspace 名称、导航文字和状态文案默认禁止选中/复制；输入框、文本域、日志详情、错误详情和明确的“复制”动作可以例外 |
| 登录入口分裂 | Desktop 内所有登录/账号入口必须指向同一个 GitHub OAuth 登录动作或同一个登录状态控制器，不允许顶部、侧栏、设置页各自实现不同逻辑 |
| 按钮缺少交互 | 所有可见按钮必须有可感知的 hover、active/focus、disabled/loading 或错误反馈；点击无效时必须显示中文原因，不能静默无响应 |

---

## 3. AionUi 参考采用点

- 采用 `Layout + Sider + Router` 的行为：侧栏点击必须改变主内容，而不是只改变 hover/active 外观。
- 采用 `LocalAgents` 的分区方式：检测到的 Agent 与待接入 Agent 分区展示，已接入 Agent 可以进入会话。
- 采用 `AgentCard` 的卡片语义：名称、状态、版本/命令摘要、能力标签、主动作清晰可见。
- 不采用 AionUi 的 Arco 视觉皮肤，不采用模型 Provider/API Key 配置流程。

---

## 4. 验收标准补充

- [ ] Playwright Electron 点击左侧“本地 Agent”后，主内容切换为 `desktop-agent-config-page`。
- [ ] 点击左侧“待审批”后，主内容切换为 `desktop-approvals-page`。
- [ ] 点击左侧“设置”后，主内容切换为 `desktop-settings-page`。
- [ ] 在独立 Agent 配置页点击 Codex 或 Claude Code 的“进入会话”后，主内容切回 `desktop-agent-session`，标题或状态显示当前 Agent。
- [ ] OpenCode 和其他待接入 Runtime 不出现“进入会话”按钮。
- [ ] 右侧摘要栏可以提供“管理 Agent”快捷入口，但不能是唯一配置入口。
- [ ] 所有页面继续满足敏感字段禁止、中文文案、1200x800 无横向滚动和截图留存。
- [ ] Desktop 主壳普通文本不可被鼠标拖选；E2E 通过 `getSelection().toString()` 断言普通项目/Workspace 文案不可复制。
- [ ] Desktop 所有登录按钮共享同一个 `data-auth-action="github-login"` 或等价统一动作；点击任一入口进入同一 GitHub 登录状态。
- [ ] E2E 对主要按钮做交互审计：可点击按钮必须触发页面切换、状态变化、错误提示或 loading/disabled 状态；不可用按钮必须 disabled 并有中文原因。
