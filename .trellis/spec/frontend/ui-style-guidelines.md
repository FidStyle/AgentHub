# 三端 UI 样式与视觉测试规范

> 本规范是 `FR-UI-001` 的实现层合同。任何 Web、Desktop、Mobile/PWA UI 任务开始前都必须读取本文件和 `research/product/ui-design-system.md`。

---

## 1. 适用范围

- Web：`apps/web` 的 Next.js 页面、布局、组件、移动 PWA 视图。
- Desktop：`apps/desktop/src/renderer` 的 Electron 渲染层页面和组件。
- E2E：`e2e/` 下覆盖 Web、Mobile/PWA、Electron 的 Playwright 测试。

绑定需求：`FR-UI-001`, `FR-WEB-001`, `FR-DESK-001`, `FR-MOB-001`, `FR-CHAT-001`, `FR-RESULT-001`, `FR-PERM-001`。

---

## 2. 组件与样式基线

| 项 | 必须遵守 |
| --- | --- |
| 组件模式 | 使用 shadcn/ui 风格的组合式组件；优先复用已有 Button、Card、Dialog、Tabs、Badge、Input、Textarea、Tooltip、Dropdown、ScrollArea。 |
| 样式 | 使用 Tailwind CSS 4 语义 class 和主题变量；禁止用大段内联样式拼页面。 |
| 图标 | 使用 `lucide-react`。工具按钮优先使用图标，复杂或不熟悉图标必须提供 tooltip 或可访问名称。 |
| 文案 | 用户可见文案必须是简体中文。技术产品名、库名、命令名可以保留英文。 |
| 参考 | codeg/shadcn 工作台风格是三端统一视觉母版；AionUi、lobehub、cherry-studio 只吸收布局、密度和组件行为，不复制不符合 PRD 的凭证或 Provider 流程。 |

### 2.1 统一视觉母版硬规则

- Web、Desktop、Mobile/PWA 必须像同一个 AgentHub 产品。端侧布局可以不同，视觉语言不能分裂。
- Button、IconButton、Card、Panel、Badge、MessageBubble、Composer、Approval、RuntimeStatusCard 必须复用同一套 token、variant 和状态色。
- AionUi 只能作为聊天分栏、Agent 卡片、LocalAgents 和 Desktop 轻量会话结构参考；不得把 Arco 默认视觉引入主 UI。
- lobehub 只能作为移动信息架构参考；不得把移动端做成另一套模型配置产品视觉。
- cherry-studio 只能作为桌面密度和设置分组参考；不得把 Desktop 做成 Provider/API Key 设置页。
- 页面不得绕过共享组件，用大段临时 class 拼出只在单端成立的视觉皮肤。

---

## 3. 三端布局规则

### Web

- 主体验必须是三栏 IM 工作台或其登录/空状态：左栏 Workspace/Session，中栏消息，右栏 Artifact/Context/Agents/Preview。
- 1280px 以上显示完整三栏；1024-1279px 可收起右栏；低于 640px 使用移动单栏。
- 首屏不能是营销页；用户登录后必须能进入工作台主流程。
- 消息区、右侧产物区和输入框必须有稳定高度和滚动边界，不能互相覆盖。

### Desktop

- Desktop 是 Connector Console 和本地 Agent 轻量工作台，不是 Web 工作台复制品，也不是单页检测面板。
- 启动后默认界面必须是桌面主壳：左侧导航/Session，中间本地 Agent 轻量会话，右侧 Agent 配置中心与 Runtime 状态。
- 必须突出设备在线状态、Workspace 绑定、Runtime 检测、Agent 配置中心、本地 Agent 轻量会话、执行活动和待审批。
- 本地 Claude Code / Codex 只展示安装、版本、CLI path、认证状态、能力声明、最近诊断、进入轻量会话动作和本机修复引导。
- Agent 配置中心必须展示 Codex、Claude Code、OpenCode 和其他预留 Runtime；Codex/Claude Code 为 P0 已接入，OpenCode 等为“待接入”且不可进入会话。
- 本地 Agent 轻量会话只服务当前 Local Desktop Workspace：最近消息、Runtime 流式输出、执行活动、待审批和诊断。复杂 Artifact/Context/Agents/Preview 仍跳转 Web 工作台。
- 打开 Web 工作台入口必须有有效目标；目标不可用时在 Desktop 内展示中文错误和下一步，不得打开空白页。
- 禁止在本地 Runtime 绑定 UI 中展示 API Key、Base URL、`ANTHROPIC_API_KEY`、`OPENAI_API_KEY` 输入框。

### Mobile/PWA

- Mobile/PWA 是轻量 IM、审批和预览端，不承担本地 Runtime 接入和复杂代码编辑。
- 390x844 视口必须无横向滚动。
- 审批按钮、输入框和底部导航不能遮挡消息内容。
- Diff、大输出和长文件名默认折叠或截断。

---

## 4. 核心组件要求

| 组件 | 实现要求 | 测试点 |
| --- | --- | --- |
| 消息气泡 | 区分用户、Role Agent、系统状态；支持 pending、streaming、completed、failed。 | 长中文、长代码、失败状态不溢出。 |
| 输入框工具条 | 包含 @ Role Agent、上下文/附件入口、发送动作；发送中禁用重复提交。 | 移动端按钮不挤压，发送中尺寸不跳变。 |
| 计划卡 | 从结构化计划渲染步骤、角色、依赖、风险和确认动作。 | 卡片截图、审批按钮可点击、风险文案中文。 |
| 任务结果卡 | 展示状态、摘要、文件变更、Diff、预览和输出摘要。 | 成功/失败/重试状态截图，文件列表不溢出。 |
| Action 状态卡 | 展示动作类型、执行域、风险等级、输出摘要。 | running 到 succeeded/failed 状态更新。 |
| 审批卡/弹窗 | 展示审批类型、风险、影响范围、批准/拒绝。 | 批准/拒绝按钮语义清晰，Diff 不作为审批对象。 |
| Agent 卡 | 展示角色、能力标签、调度状态和 Runtime 绑定摘要。 | Runtime 名称只在配置摘要出现，不作为聊天对象。 |
| Runtime 状态卡 | 展示 installed、version、CLI path、authStatus、capability snapshot、最近诊断。 | 不出现本地 CLI API Key 表单。 |
| Desktop Agent 配置中心 | Codex、Claude Code、OpenCode 和其他 Runtime 卡片；P0 已接入与待接入状态清晰。 | OpenCode 等待接入项不可执行，不出现密钥表单。 |
| Desktop 本地 Agent 会话 | 展示本地 Runtime/Role Agent 身份、最近消息、流式输出、执行活动、待审批和轻量输入框。 | 不复制 Web 三栏，不绕过 DeviceChannel 执行 shell。 |
| Artifact/Preview 面板 | 支持 loading、empty、ready、failed。 | 右栏滚动正常，移动端独立视图不遮挡。 |

---

## 5. 禁止模式

- 禁止无样式纯 HTML 页面。
- 禁止用营销首页替代 Web 工作台主体验。
- 禁止 Desktop 只有一个纵向卡片检测页，没有主壳、导航、会话和配置中心。
- 禁止用户可见 UI 文案使用英文，除非是明确技术名词。
- 禁止本地 Runtime 配置页渲染 API Key、Base URL 或敏感环境变量保存表单。
- 禁止 Web、Desktop、Mobile/PWA 分别复刻不同参考项目的视觉皮肤。
- 禁止卡片套卡片、装饰性渐变球、超大圆角胶囊、模板化大面积渐变背景。
- 禁止通过内联样式堆 UI；确需动态样式时只能用于少量变量或定位计算。
- 禁止文本溢出、按钮文字截断、固定格式卡片被内容撑变形。
- 禁止截图或 UI 输出暴露密钥、完整敏感环境变量、未授权本地路径。

---

## 6. 视觉 E2E 要求

### 6.1 覆盖矩阵

| 端 | Playwright 项目 | 必测视口 | 必测内容 |
| --- | --- | --- | --- |
| Web 桌面 | chromium desktop | 1440x900、1024x768 | 工作台、消息、计划卡、结果卡、Artifact 面板、审批队列 |
| Mobile/PWA | chromium mobile | 390x844 | Workspace、Session、轻量消息、审批详情、预览页 |
| Desktop | electron | 1200x800 | Connector 首页、Runtime 检测、本地 Agent 轻量会话、执行活动、待审批 |

### 6.2 必须断言

- `document.body.scrollWidth <= window.innerWidth + 1`。
- 关键容器 bounding box 不重叠：侧栏、消息区、右栏、输入框、审批卡。
- 长标题、长文件名、长路径摘要不超出父容器。
- loading、disabled、hover、running 状态不改变固定格式组件尺寸。
- 关键页面调用 `page.screenshot()` 或 Playwright 快照能力留存。
- 本地 Runtime UI 不存在 `API Key`、`ANTHROPIC_API_KEY`、`OPENAI_API_KEY`、`Base URL` 等敏感配置入口。
- 三端同状态截图必须能看出共享色板、圆角、按钮、Badge、消息气泡、输入框和状态卡来自同一视觉母版。
- 关键页面必须断言共享组件或共享 token 生效；绕开共享组件临时堆样式时门禁失败。

### 6.3 推荐定位点

组件实现时为关键容器提供稳定定位：

- `data-testid="workspace-shell"`
- `data-testid="session-sidebar"`
- `data-testid="chat-panel"`
- `data-testid="message-composer"`
- `data-testid="artifact-panel"`
- `data-testid="approval-card"`
- `data-testid="connector-console"`
- `data-testid="runtime-status-card"`
- `data-testid="desktop-agent-session"`
- `data-testid="desktop-agent-composer"`
- `data-testid="mobile-session"`

---

## 7. 正误示例

### 错误

```tsx
export function RuntimeConfigPage() {
  return (
    <div>
      <h1>Runtime Config</h1>
      <input placeholder="OPENAI_API_KEY" />
      <input placeholder="Base URL" />
      <button>Save</button>
    </div>
  )
}
```

问题：英文 UI、无样式 HTML、本地 Runtime 密钥表单违反 `FR-UI-001` 与本地 Runtime 凭证边界。

### 正确

```tsx
export function RuntimeStatusCard() {
  return (
    <section data-testid="runtime-status-card" className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium">Codex 本地运行时</h3>
        <span className="rounded-md border px-2 py-1 text-xs">需要登录</span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        已检测到 Codex CLI，请在本机终端完成原生登录后重新检测。
      </p>
    </section>
  )
}
```

要点：中文文案、Tailwind 设计变量、稳定定位点、只做检测和引导，不托管密钥。

---

## 8. 任务切片检查清单

涉及 UI 的 `.trellis/tasks/*/` 必须包含：

- [ ] 绑定业务 `FR-ID` 和 `FR-UI-001`。
- [ ] 引用 `research/product/ui-design-system.md` 和本文件。
- [ ] 写明参考项目来源，例如 AionUi 聊天分栏或 codeg 权限弹窗。
- [ ] 写明 codeg/shadcn 是统一视觉母版，其他参考项目只是结构或端侧行为参考。
- [ ] 测试先行：功能断言、截图断言、布局断言、敏感信息断言。
- [ ] 明确 Web、Desktop、Mobile/PWA 中受影响的端，不把三端做成同一密度。
