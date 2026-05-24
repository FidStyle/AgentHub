# UI Phase 3 任务规划

## 1. 目标

本任务是 UI Phase 3 的父级规划任务，负责把已经确认的 `FR-UI-001`、三端 UI 设计系统和视觉 E2E 门禁拆成可执行 Trellis 任务切片。

本任务不直接改业务代码；真正实现由 5 个子任务完成。

## 2. 上游依据

- `research/prd.md`
- `research/product-design.md`
- `research/ui-design-system.md`
- `research/technical-design.md`
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
| 4 | `05-25-mobile-pwa-im-approval-preview-ui` | 实现 Mobile/PWA 轻量 IM、审批、预览 | `FR-MOB-001`, `FR-NOTIFY-001`, `FR-UI-001` |
| 5 | `05-25-visual-e2e-gate` | 建立三端视觉 E2E 门禁 | `FR-UI-001`, `FR-WEB-001`, `FR-DESK-001`, `FR-MOB-001` |

## 4. 执行原则

- 每个 UI 子任务必须先写测试或测试计划，再实现 UI。
- UI 组件基线统一为 `shadcn/ui + Tailwind CSS 4 + lucide-react`。
- AionUi 和 codeg 为主参考，lobehub 和 cherry-studio 为辅参考。
- Web、Desktop、Mobile/PWA 不做成同一套信息密度。
- 不允许无样式纯 HTML、英文 UI 文案、营销式首页替代工作台。
- 本地 Claude Code / Codex 只做检测、绑定、诊断和本机登录/安装引导，不托管 API Key。

## 5. Definition of Done

- [ ] 5 个子任务都有 `prd.md`、`info.md`、`implement.jsonl`、`check.jsonl`。
- [ ] 每个子任务显式引用 `FR-UI-001` 和对应业务 `FR-ID`。
- [ ] 每个子任务包含 TDD/视觉 E2E 规划。
- [ ] 每个子任务明确引用 `research/ui-design-system.md` 和 `.trellis/spec/frontend/ui-style-guidelines.md`。
- [ ] 任务拆分已提交到 Git。
