# AgentHub UI Phase 3 任务规划

**作者：** joytion, Codex
**日期：** 2026-05-25
**状态：** Phase 3 任务规划已生成
**上游文档：** `research/prd.md`, `research/product-design.md`, `research/ui-design-system.md`, `research/technical-design.md`, `research/modules/ui-and-visual-testing.md`
**任务切片位置：** `.trellis/tasks/05-25-ui-phase3-task-plan/` 及其子任务

---

## 1. 文档定位

本文是 UI Phase 3 的项目级任务规划索引，放在 `research/` 下，供产品评审、技术评审和后续实现 Agent 统一理解“为什么这样拆任务、按什么顺序做、每个 UI 模块如何验收”。

具体可执行任务切片放在 `.trellis/tasks/*/` 下。两者职责不同：

| 层级 | 位置 | 作用 |
| --- | --- | --- |
| 项目级规划 | `research/ui-phase3-task-plan.md` | 说明 UI Phase 3 的模块边界、执行顺序、FR-ID 追踪和测试门禁 |
| 执行切片 | `.trellis/tasks/05-25-*` | 承载每个任务的 `prd.md`、`info.md`、`implement.jsonl`、`check.jsonl`、`task.json` |

如果两者冲突，以本文和上游 `research/*.md` 为方向源，再同步修正 `.trellis/tasks/*/`。

---

## 2. UI Phase 3 总目标

UI Phase 3 的目标不是“补一点样式”，而是把 `FR-UI-001` 落成可执行开发闭环：

1. Web、Desktop、Mobile/PWA 三端都遵循 `shadcn/ui + Tailwind CSS 4 + lucide-react` 基线。
2. AionUi 与 codeg 作为主参考，lobehub 与 cherry-studio 作为辅参考。
3. 每个 UI 模块都有 TDD/视觉 E2E 规划，包含截图、布局不重叠、文本不溢出和敏感信息断言。
4. P0 交付不得出现无样式纯 HTML、英文用户文案、营销首页替代工作台、本地 Runtime API Key 表单。

---

## 3. 任务树

父任务：

- `.trellis/tasks/05-25-ui-phase3-task-plan/`

子任务：

| 顺序 | 任务 | 端/模块 | 绑定 FR-ID | 作用 |
| --- | --- | --- | --- | --- |
| 1 | `.trellis/tasks/05-25-ui-foundation-design-system/` | 三端基础设施 | `FR-UI-001`, `FR-DEVICE-001` | 先落设计变量、基础组件、lucide 图标按钮、状态组件和 E2E 定位点 |
| 2 | `.trellis/tasks/05-25-web-three-column-workbench-ui/` | Web | `FR-WEB-001`, `FR-CHAT-001`, `FR-ARTIFACT-001`, `FR-RESULT-001`, `FR-ORCH-001`, `FR-PERM-001`, `FR-UI-001` | 重构 Web 三栏 IM 工作台，替代营销式首页或毛坯工作台 |
| 3 | `.trellis/tasks/05-25-desktop-connector-console-ui/` | Desktop | `FR-DESK-001`, `FR-RUNTIME-001`, `FR-ACTION-001`, `FR-NOTIFY-001`, `FR-UI-001` | 重构 Electron Connector Console，聚焦本地连接、检测、执行和审批 |
| 4 | `.trellis/tasks/05-25-mobile-pwa-im-approval-preview-ui/` | Mobile/PWA | `FR-MOB-001`, `FR-NOTIFY-001`, `FR-CHAT-001`, `FR-RESULT-001`, `FR-UI-001` | 实现移动轻量 IM、审批和预览，不做小号 Web IDE |
| 5 | `.trellis/tasks/05-25-visual-e2e-gate/` | E2E 门禁 | `FR-UI-001`, `FR-WEB-001`, `FR-DESK-001`, `FR-MOB-001` | 建立三端截图、布局、文本溢出和敏感信息断言 |

---

## 4. 执行顺序

```text
UI 基础设施与设计系统
  -> Web 三栏 IM 工作台
  -> Desktop Connector Console
  -> Mobile/PWA 轻量 IM、审批、预览
  -> 三端视觉 E2E 门禁
```

Web、Desktop、Mobile/PWA 三个页面任务都依赖 UI 基础设施。视觉 E2E 门禁依赖三端页面任务。

页面任务之间可以按资源情况调整顺序，但不能跳过 UI 基础设施，也不能在视觉门禁前宣称 UI Phase 3 完成。

---

## 5. 各 UI 模块怎么做

### 5.1 UI 基础设施

位置：`.trellis/tasks/05-25-ui-foundation-design-system/`

必须产出：

- Tailwind CSS 4 设计变量和语义状态色。
- shadcn/ui 风格基础组件或项目内复用入口。
- lucide 图标按钮规范，包含中文 `aria-label` 或 tooltip。
- 基础状态组件：空、加载、失败、执行中、待审批、成功、Runtime 未安装、Runtime 未登录。
- 关键 E2E 定位点约定，例如 `workspace-shell`、`chat-panel`、`message-composer`、`artifact-panel`、`connector-console`、`runtime-status-card`、`mobile-session`。

测试先行：

- 基础状态组件渲染中文文案。
- Runtime 状态卡不出现 `API Key`、`ANTHROPIC_API_KEY`、`OPENAI_API_KEY`、`Base URL`。
- 图标按钮有中文可访问名称。

### 5.2 Web 三栏 IM 工作台

位置：`.trellis/tasks/05-25-web-three-column-workbench-ui/`

必须产出：

- 左栏：Workspace 切换、Session 列表、待审批入口、Connector 状态摘要。
- 中栏：消息流、用户消息、Role Agent 状态、计划卡、审批卡、任务结果卡、输入框。
- 右栏：Artifacts、Context、Agents、Preview tabs，可折叠。
- 顶部工具条：当前 Workspace、Session 状态、Role Agent 参与状态。

测试先行：

- 1440x900 下三栏不重叠。
- 1024x768 下右栏可收起，无横向滚动。
- 输入中文任务后能看到用户消息和 Agent 状态。
- 计划卡、审批卡、任务结果卡均有截图和布局断言。

### 5.3 Desktop Connector Console

位置：`.trellis/tasks/05-25-desktop-connector-console-ui/`

必须产出：

- 顶部状态条：登录用户、设备名、在线状态、最后心跳。
- Workspace 绑定：授权目录、目录健康状态、打开 Web 工作台入口。
- Runtime 检测：Claude Code/Codex 安装、版本、原生认证状态、能力声明。
- 执行活动：最近 Runtime/Action 请求、状态、失败原因。
- 待审批：设备相关审批和高风险动作确认。

测试先行：

- Electron 启动后显示 `connector-console`。
- 本地 Runtime 页面不存在 API Key、Base URL 和敏感环境变量输入框。
- 1200x800 下状态卡不重叠、无横向滚动。

### 5.4 Mobile/PWA 轻量界面

位置： `.trellis/tasks/05-25-mobile-pwa-im-approval-preview-ui/`

必须产出：

- Workspace 列表：最近工作区、执行域、Connector 状态、待审批数量。
- Session 列表：会话标题、最后消息、Agent 状态、待确认标记。
- 轻量会话：消息流、任务状态、结果摘要、输入框、@ Role Agent。
- 审批详情：风险说明、影响范围、批准/拒绝。
- 预览页：预览链接、结果摘要、只读 Diff 或文件摘要。

测试先行：

- 390x844 下无横向滚动。
- 输入框、底部/顶部导航不遮挡消息内容。
- 审批详情页能完成批准/拒绝流转断言。
- 长标题、长文件名、长路径摘要不会溢出。

### 5.5 三端视觉 E2E 门禁

位置：`.trellis/tasks/05-25-visual-e2e-gate/`

必须产出：

- Web desktop Playwright project。
- Mobile/PWA Playwright mobile viewport。
- Electron Playwright runner。
- 统一 helper：无横向滚动、元素不重叠、文本不溢出、无敏感字段、截图留存。

测试先行：

- Web 工作台截图和布局断言。
- Mobile/PWA 会话、审批、预览截图和布局断言。
- Desktop Connector Console 截图和布局断言。
- 本地 Runtime 凭证边界跨端断言。

---

## 6. 统一 Definition of Done

UI Phase 3 完成必须同时满足：

- [ ] 5 个子任务全部完成。
- [ ] 每个子任务都引用 `FR-UI-001` 和对应业务 FR-ID。
- [ ] 每个 UI 页面没有英文用户文案、毛坯 HTML、临时内联样式堆叠。
- [ ] Web、Desktop、Mobile/PWA 都通过功能 E2E。
- [ ] Web、Desktop、Mobile/PWA 都有关键截图留存。
- [ ] 视觉断言覆盖无横向滚动、关键卡片不重叠、长文本不溢出。
- [ ] 本地 Claude Code/Codex Runtime UI 不出现 API Key、Base URL 或敏感环境变量保存表单。

---

## 7. 后续推进方式

下一步应从 `.trellis/tasks/05-25-ui-foundation-design-system/` 开始执行。

执行前必须读取：

- `research/ui-design-system.md`
- `research/ui-phase3-task-plan.md`
- `.trellis/spec/frontend/ui-style-guidelines.md`
- 当前任务目录下的 `prd.md` 与 `info.md`

每完成一个子任务后，都应执行对应测试并提交。测试未通过或截图/布局断言不符合契约时，不进入下一个任务。
