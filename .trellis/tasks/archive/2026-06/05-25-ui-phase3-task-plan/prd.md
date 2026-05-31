# UI Phase 3 任务规划

## 1. 目标

本任务是 UI Phase 3 的父级规划任务，负责把已经确认的 `FR-UI-001`、三端 UI 设计系统和视觉 E2E 门禁拆成可执行 Trellis 任务切片。

本任务不直接改业务代码；真正实现由 5 个原子子任务完成。若 Desktop 仍是单页检测面板，必须追加执行 Phase 4 前置修正任务 `05-26-desktop-main-shell-agent-config-refactor`；若已有 UI 截图显示三端风格割裂，必须追加执行 `05-26-ui-visual-unification-refactor`。

## 2. 上游依据

- `research/prd.md`
- `research/product/product-design.md`
- `research/product/ui-design-system.md`
- `research/architecture/technical-design.md`
- `research/modules/ui-and-visual-testing.md`
- `.trellis/spec/frontend/ui-style-guidelines.md`
- `.trellis/spec/frontend/component-guidelines.md`
- `.trellis/spec/frontend/quality-guidelines.md`

## 3. 任务拆分

| 顺序 | 子任务 | 作用 | 绑定 FR-ID |
| --- | --- | --- | --- |
| 1 | `05-25-ui-foundation-design-system` | 落地 UI 基础设施、设计变量、基础组件和定位点 | `FR-UI-001`, `FR-DEVICE-001` |
| 2 | `05-25-web-three-column-workbench-ui` | 重构 Web 三栏 IM 工作台 | `FR-WEB-001`, `FR-CHAT-001`, `FR-RESULT-001`, `FR-UI-001` |
| 3 | `05-25-desktop-connector-console-ui` | 重构 Desktop Connector Console | `FR-DESK-001`, `FR-RUNTIME-001`, `FR-UI-001` |
| 4 | `05-26-desktop-main-shell-agent-config-refactor` | 返工 Desktop 主壳、Agent 配置中心和打开 Web 状态 | `FR-DESK-001`, `FR-RUNTIME-001`, `FR-CHAT-001`, `FR-UI-001` |
| 5 | `05-25-mobile-pwa-im-approval-preview-ui` | 实现 Mobile/PWA 轻量 IM、审批、预览 | `FR-MOB-001`, `FR-NOTIFY-001`, `FR-UI-001` |
| 6 | `05-25-visual-e2e-gate` | 建立三端视觉 E2E 门禁 | `FR-UI-001`, `FR-WEB-001`, `FR-DESK-001`, `FR-MOB-001` |

## 4. 执行原则

- 每个 UI 子任务必须先写测试或测试计划，再实现 UI。
- UI 组件基线统一为 `shadcn/ui + Tailwind CSS 4 + lucide-react`。
- codeg/shadcn 工作台风格是三端统一视觉母版；AionUi、lobehub 和 cherry-studio 只作为结构、密度和端侧行为参考。
- 三端只能改变布局密度、栏数和导航方式，不能在按钮、卡片、Badge、消息气泡、输入框、状态卡上形成三套视觉语言。
- Web、Desktop、Mobile/PWA 不做成同一套信息密度。
- 不允许无样式纯 HTML、英文 UI 文案、营销式首页替代工作台。
- 本地 Claude Code / Codex 只做检测、绑定、诊断和本机登录/安装引导，不托管 API Key。

## 4.1 Phase 4 前置修正

如果已有一轮实现截图显示三端 UI 风格割裂、像不同参考项目拼贴，不能直接进入最终 Phase 4。必须先执行：

- `.trellis/tasks/05-26-desktop-main-shell-agent-config-refactor/`，当 Desktop 仍是单页检测面板、没有 Agent 配置中心、没有本地轻量会话主区，或打开 Web 工作台为空白时。
- `.trellis/tasks/05-26-ui-visual-unification-refactor/`

这些任务要求先补 Electron/Desktop 与三端截图对照、共享 token/组件断言和参考项目差距审计，再修正 Web、Desktop、Mobile/PWA 页面。

## 5. Definition of Done

- [ ] 5 个原子子任务都有 `prd.md`、`info.md`、`implement.jsonl`、`check.jsonl`。
- [ ] Phase 4 前置修正任务 `05-26-desktop-main-shell-agent-config-refactor` 已具备 `prd.md`、`info.md`、`implement.jsonl`、`check.jsonl`。
- [ ] Phase 4 前置修正任务 `05-26-ui-visual-unification-refactor` 已具备 `prd.md`、`info.md`、`implement.jsonl`、`check.jsonl`。
- [ ] 每个子任务显式引用 `FR-UI-001` 和对应业务 `FR-ID`。
- [ ] 每个子任务包含 TDD/视觉 E2E 规划。
- [ ] 每个子任务明确引用 `research/product/ui-design-system.md` 和 `.trellis/spec/frontend/ui-style-guidelines.md`。
- [ ] 三端统一视觉母版已写入任务约束，不允许各端分别复刻不同参考项目视觉皮肤。
- [ ] 进入 Phase 4 前已完成 `.trellis/tasks/05-26-desktop-main-shell-agent-config-refactor/` 和 `.trellis/tasks/05-26-ui-visual-unification-refactor/`，或确认当前实现无需对应修正任务。
- [ ] 任务拆分已提交到 Git。
