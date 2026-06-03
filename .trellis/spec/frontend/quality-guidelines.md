# 前端质量规范

> AgentHub 前端质量、禁止模式和测试门禁。

---

## 概览

前端质量不只包含能否渲染，还包含产品契约、中文文案、三端职责、视觉稳定性和敏感信息边界。涉及 UI 的任务必须同时满足 Bytedance 原始来源、派生业务 `FR-ID` 与 `FR-UI-001`。

---

## 禁止模式

- 本地 Claude Code / Codex 的 Role Agent 或 Runtime 绑定 UI 不得渲染 API Key、Base URL、`ANTHROPIC_API_KEY`、`OPENAI_API_KEY` 等默认输入框。P0 只展示检测、绑定、诊断和本机登录/安装引导。
- 禁止无样式纯 HTML 页面或只靠浏览器默认样式交付功能。
- 禁止用营销式首页替代 Web 工作台主体验。
- 禁止用户可见 UI 文案使用英文，除非是明确技术产品名、库名、命令名或协议名。
- 禁止大量一次性内联样式替代 Tailwind 设计系统。
- 禁止卡片套卡片、装饰性渐变球、超大圆角胶囊和模板化大面积渐变背景。
- 禁止文本溢出、按钮文字被截断、固定格式卡片被内容撑变形、移动断点横向滚动。
- 禁止截图、日志、执行输出或 UI 状态展示密钥、完整敏感环境变量、未授权本地路径。

---

## 必须模式

- Web、Desktop、Mobile/PWA 的用户可见文案必须使用简体中文。
- 三端共享概念术语必须一致：工作区、会话、授权、产物、预览、智能体、桌面连接器。
- 技术产品名可在指代具体技术或命令时保留英文，例如 Vite、Electron、PWA、Codex、Claude Code、Node、`corepack pnpm`。
- UI 组件基线为 `shadcn/ui + Tailwind CSS 4 + lucide-react`。
- 任何 UI 任务必须引用 `research/product/ui-design-system.md` 和 `.trellis/spec/frontend/ui-style-guidelines.md`。
- 本地 Runtime 凭证边界必须遵守 `.trellis/spec/cross-layer/runtime-credential-boundary.md`：本地 CLI 只检测原生认证状态，不托管密钥。
- 关键页面必须有稳定定位点，供 Playwright 功能断言、截图和布局断言使用。
- 需要真实浏览器验证的功能改动，验收证据必须优先使用 OpenCLI；常规 Playwright 只作为确定性回归、组件、布局和截图断言补充，不能替代 `.trellis/spec/cross-layer/real-flow-acceptance.md` 中的 OpenCLI 真实浏览器验收口径。
- 状态 UI 必须覆盖空、加载、失败、未登录、离线、执行中、需要授权、成功、重试。
- 用户可见的交互控件必须二选一：接入真实行为并验证结果，或显式禁用并给出中文原因（`aria-label`/tooltip/title/可见说明至少一种）。禁止按钮可点击但无效果，尤其是附件、授权、运行时连接、本地工作区创建等主链路入口。
- 涉及本地对话、远端对话、`@角色`、附件或 artifact 的 UI，不得仅凭按钮可见、HTTP 200、用户消息落库或截图存在声明通过；必须同时满足 `.trellis/spec/cross-layer/real-flow-acceptance.md` 的真实主链路验收口径。

---

## 测试要求

| 测试类型 | 要求 |
| --- | --- |
| 单元测试 | 状态映射、class 变体、权限/Runtime 状态渲染必须可测。 |
| 组件测试 | 核心卡片和表单必须覆盖 loading、empty、error、success。 |
| Web E2E | 覆盖三栏工作台、消息发送、计划确认、任务结果、Context/Changes/Artifacts。 |
| Mobile/PWA E2E | 覆盖 390x844 视口下 Workspace、Session、消息、授权、预览。 |
| Electron E2E | 覆盖 Connector 首页、Runtime 检测、执行活动、本机策略。 |
| 主链路 E2E | 本地/远端 `@角色`、附件和 artifact 必须从真实入口验证 DB/API/runtime/刷新后状态；mock route 只能作为组件级证据。 |
| 视觉与布局断言 | 必须截图；必须断言无横向滚动、关键卡片不重叠、文本不溢出。 |
| 敏感信息断言 | 本地 Runtime UI 和截图中不得出现 API Key、Base URL、敏感环境变量入口。 |

真实浏览器 UAT 按 `.trellis/spec/cross-layer/real-flow-acceptance.md` 的 OpenCLI 契约执行。Playwright 不能只写 `toBeVisible`；作为回归和布局证据时，核心 UI 至少包含：

- `page.screenshot()` 或快照留存。
- `document.body.scrollWidth <= window.innerWidth + 1`。
- 关键元素 bounding box 不重叠。
- 长中文、长文件名、长路径摘要不溢出父容器。

---

## 代码审查清单

- [ ] 是否绑定了 `bytedance_init_prd.md` 中的原始来源和派生 PRD 业务 `FR-ID`；涉及 UI 时是否绑定 `FR-UI-001`。
- [ ] 是否遵守 `research/product/ui-design-system.md` 的三端职责和组件契约。
- [ ] 是否复用 shadcn/Tailwind/lucide 基线，避免临时内联样式。
- [ ] 是否所有用户可见文案都是中文。
- [ ] 是否所有可见按钮都有真实行为；未实现能力是否显式禁用并说明原因。
- [ ] 是否没有本地 Runtime API Key、Base URL 或敏感环境变量表单。
- [ ] 是否覆盖功能断言、截图断言、布局断言和敏感信息断言。
- [ ] 如果声称本地/远端对话、`@角色`、附件或 artifact 通过，是否列出真实主链路命令、环境、数据证据、刷新后断言和 skip/mock 排除说明。
- [ ] 是否在移动断点下无横向滚动、无遮挡、无文本溢出。
