# Roadmap: AgentHub UI Phase 3

## Roadmap Decisions

| # | Decision | Choice | Source |
|---|----------|--------|--------|
| 1 | Scope | UI Phase 3 全量（三端 UI 重构 + 视觉门禁） | research/ui-phase3-task-plan.md |
| 2 | Strategy | Progressive (渐进式交付) | 任务依赖链 |
| 3 | Milestone 数量 | 5 个 milestone (M11-M15) | ui-phase3-task-plan.md 任务树 |
| 4 | Tech stack | shadcn/ui + Tailwind CSS 4 + lucide-react + Playwright | research/ui-design-system.md |
| 5 | UI 语言 | 全局中文，禁止英文用户文案 | 用户强制约束 |
| 6 | 设计参考 | AionUi + codeg 主参考，lobehub + cherry-studio 辅参考 | research/ui-design-system.md |
| 7 | 验收标准 | 每个 Milestone 必须通过截图、布局断言和敏感信息断言 | research/ui-design-system.md §8 |
| 8 | 基础复用 | 复用 M5-M10 已完成的功能逻辑，仅重构 UI 层 | state.json M5-M10 completed |

## Overview

UI Phase 3 基于已完成的 M5-M10 功能基础，按照 `research/ui-design-system.md` 设计系统契约，对三端 UI 进行系统性重构。目标是将所有 P0 页面从毛坯/营销式界面升级为符合设计系统的产品级界面，并建立视觉 E2E 门禁确保质量。

已有基础：M5-M10 全部功能逻辑已完成（Auth、IM 消息流、Agent、Desktop Connector、Runtime、Orchestrator、Mobile PWA、E2E 基础）。

执行顺序：UI 基础设施 → Web 工作台 → Desktop Console → Mobile/PWA → 三端视觉 E2E 门禁。

## Milestones

### Milestone 11: UI 基础设施与设计系统 (v0.11)
**Target**: 落地三端共享设计变量、基础组件、状态组件和 E2E 定位点约定
**Status**: planned

#### Phases

- [ ] **Phase 1: 设计系统基础设施** — Tailwind CSS 4 设计变量、shadcn/ui 基础组件、lucide 图标按钮、状态组件、E2E 定位点

#### Phase Details

##### Phase 1: 设计系统基础设施
**Goal**: 三端共享的设计变量、基础组件库和状态组件就绪，后续三端 UI 重构可直接引用
**Depends on**: M5-M10 已完成的功能基础
**Requirements**: FR-UI-001, FR-DEVICE-001
**Success Criteria** (what must be TRUE):
  1. Tailwind CSS 4 设计变量（颜色、间距、圆角）在三端主题中生效
  2. shadcn/ui 风格基础组件（Button、Card、Input、Dialog、Badge）可在三端复用
  3. lucide 图标按钮规范落地，所有图标按钮有中文 `aria-label` 或 tooltip
  4. 基础状态组件就绪：空、加载、失败、执行中、待审批、成功、Runtime 未安装、Runtime 未登录
  5. 状态组件渲染中文文案，不出现英文占位
  6. Runtime 状态卡不出现 `API Key`、`ANTHROPIC_API_KEY`、`OPENAI_API_KEY`、`Base URL`
  7. E2E 定位点约定文档化：`workspace-shell`、`chat-panel`、`message-composer`、`artifact-panel`、`connector-console`、`runtime-status-card`、`mobile-session`

---

### Milestone 12: Web 三栏 IM 工作台重构 (v0.12)
**Target**: 重构 Web 三栏 IM 工作台，替代营销式首页或毛坯工作台
**Status**: planned

#### Phases

- [ ] **Phase 1: Web 三栏工作台 UI** — 左栏导航、中栏消息流、右栏 Artifact、顶部工具条、响应式收起

#### Phase Details

##### Phase 1: Web 三栏工作台 UI
**Goal**: Web 端呈现符合设计系统的高密度三栏 IM 工作台，所有核心交互组件就位
**Depends on**: M11 Phase 1
**Requirements**: FR-WEB-001, FR-CHAT-001, FR-ARTIFACT-001, FR-RESULT-001, FR-ORCH-001, FR-PERM-001, FR-UI-001
**Success Criteria** (what must be TRUE):
  1. 左栏：Workspace 切换、Session 列表、待审批入口、Connector 状态摘要
  2. 中栏：消息流、用户消息、Role Agent 状态、计划卡、审批卡、任务结果卡、输入框
  3. 右栏：Artifacts、Context、Agents、Preview tabs，可折叠
  4. 顶部工具条：当前 Workspace、Session 状态、Role Agent 参与状态
  5. 1440x900 下三栏不重叠
  6. 1024x768 下右栏可收起，无横向滚动
  7. 输入中文任务后能看到用户消息和 Agent 状态
  8. 计划卡、审批卡、任务结果卡均有截图和布局断言
  9. 所有 UI 文字为简体中文

---

### Milestone 13: Desktop Connector Console 重构 (v0.13)
**Target**: 重构 Electron Connector Console，聚焦本地连接、检测、执行和审批
**Status**: planned

#### Phases

- [ ] **Phase 1: Desktop Console UI** — 状态条、Workspace 绑定、Runtime 检测、执行活动、待审批

#### Phase Details

##### Phase 1: Desktop Console UI
**Goal**: Desktop Connector Console 呈现符合设计系统的中密度管理界面，聚焦本地 Runtime 状态和执行管理
**Depends on**: M11 Phase 1
**Requirements**: FR-DESK-001, FR-RUNTIME-001, FR-ACTION-001, FR-NOTIFY-001, FR-UI-001
**Success Criteria** (what must be TRUE):
  1. 顶部状态条：登录用户、设备名、在线状态、最后心跳
  2. Workspace 绑定：授权目录、目录健康状态、打开 Web 工作台入口
  3. Runtime 检测：Claude Code/Codex 安装、版本、原生认证状态、能力声明
  4. 执行活动：最近 Runtime/Action 请求、状态、失败原因
  5. 待审批：设备相关审批和高风险动作确认
  6. Electron 启动后显示 `connector-console` 定位点
  7. 本地 Runtime 页面不存在 API Key、Base URL 和敏感环境变量输入框
  8. 1200x800 下状态卡不重叠、无横向滚动
  9. 所有 Desktop UI 文字为简体中文

---

### Milestone 14: Mobile/PWA 轻量 IM、审批、预览 (v0.14)
**Target**: 实现移动轻量 IM、审批和预览，不做小号 Web IDE
**Status**: planned

#### Phases

- [ ] **Phase 1: Mobile/PWA UI** — Workspace 列表、Session 列表、轻量会话、审批详情、预览页

#### Phase Details

##### Phase 1: Mobile/PWA UI
**Goal**: Mobile/PWA 端呈现符合设计系统的单列轻量界面，覆盖 IM、审批和预览核心场景
**Depends on**: M11 Phase 1
**Requirements**: FR-MOB-001, FR-NOTIFY-001, FR-CHAT-001, FR-RESULT-001, FR-UI-001
**Success Criteria** (what must be TRUE):
  1. Workspace 列表：最近工作区、执行域、Connector 状态、待审批数量
  2. Session 列表：会话标题、最后消息、Agent 状态、待确认标记
  3. 轻量会话：消息流、任务状态、结果摘要、输入框、@ Role Agent
  4. 审批详情：风险说明、影响范围、批准/拒绝
  5. 预览页：预览链接、结果摘要、只读 Diff 或文件摘要
  6. 390x844 下无横向滚动
  7. 输入框、底部/顶部导航不遮挡消息内容
  8. 审批详情页能完成批准/拒绝流转
  9. 长标题、长文件名、长路径摘要不溢出
  10. 所有 Mobile UI 文字为简体中文

---

### Milestone 15: 三端视觉 E2E 门禁 (v0.15)
**Target**: 建立三端截图、布局、文本溢出和敏感信息断言的自动化门禁
**Status**: planned

#### Phases

- [ ] **Phase 1: 视觉 E2E 门禁** — Web/Desktop/Mobile Playwright 项目、统一 helper、截图留存

#### Phase Details

##### Phase 1: 视觉 E2E 门禁
**Goal**: 三端视觉 E2E 测试全部通过，确保 UI Phase 3 交付质量
**Depends on**: M12 Phase 1, M13 Phase 1, M14 Phase 1
**Requirements**: FR-UI-001, FR-WEB-001, FR-DESK-001, FR-MOB-001
**Success Criteria** (what must be TRUE):
  1. Web desktop Playwright project 配置完成（1440x900 + 1024x768）
  2. Mobile/PWA Playwright mobile viewport 配置完成（390x844）
  3. Electron Playwright runner 配置完成（1200x800）
  4. 统一 helper：无横向滚动断言、元素不重叠断言、文本不溢出断言、无敏感字段断言
  5. Web 工作台截图和布局断言通过
  6. Mobile/PWA 会话、审批、预览截图和布局断言通过
  7. Desktop Connector Console 截图和布局断言通过
  8. 本地 Runtime 凭证边界跨端断言通过
  9. 截图保存至 `e2e/artifacts/<端>/<页面>/<状态>.png`

---

## Scope Decisions

- **In scope**: 三端 UI 设计系统落地、Web/Desktop/Mobile 页面重构、视觉 E2E 门禁
- **Deferred**: 功能逻辑变更（已在 M5-M10 完成）、新 FR-ID 功能开发
- **Out of scope**: 部署发布、Agent Marketplace、版本控制增强

## FR-ID → Milestone 映射 (UI Phase 3)

| FR-ID | Milestone | Phase | 验收重点 |
|-------|-----------|-------|----------|
| FR-UI-001 | M11 (基础) + M12-M15 (各端) | P1 | 设计系统合规 |
| FR-DEVICE-001 | M11 | P1 | 状态组件、断点适配 |
| FR-WEB-001 | M12 | P1 | 三栏布局、响应式 |
| FR-CHAT-001 | M12 + M14 | P1 | 消息流 UI |
| FR-ARTIFACT-001 | M12 | P1 | 右栏 Artifact tabs |
| FR-RESULT-001 | M12 + M14 | P1 | 任务结果卡片 |
| FR-ORCH-001 | M12 | P1 | 计划卡 UI |
| FR-PERM-001 | M12 | P1 | 审批卡 UI |
| FR-DESK-001 | M13 | P1 | Connector Console |
| FR-RUNTIME-001 | M13 | P1 | Runtime 检测 UI |
| FR-ACTION-001 | M13 | P1 | 执行活动 UI |
| FR-NOTIFY-001 | M13 + M14 | P1 | 待审批入口 |
| FR-MOB-001 | M14 | P1 | 移动轻量界面 |

## Progress

| Milestone | Status | Phases Done | Notes |
|-----------|--------|-------------|-------|
| M5: Auth + DB + API | completed | 1/1 | 功能基础 |
| M6: Web IM 工作台 | completed | 1/1 | 功能基础 |
| M7: Desktop + Runtime | completed | 1/1 | 功能基础 |
| M8: Orchestrator + Action | completed | 1/1 | 功能基础 |
| M9: Mobile + Demo | completed | 1/1 | 功能基础 |
| M10: E2E Automation Gate | completed | 1/1 | 功能基础 |
| M11: UI 基础设施与设计系统 | Not started | 0/1 | — |
| M12: Web 三栏 IM 工作台重构 | Not started | 0/1 | 依赖 M11 |
| M13: Desktop Connector Console 重构 | Not started | 0/1 | 依赖 M11 |
| M14: Mobile/PWA 轻量 IM、审批、预览 | Not started | 0/1 | 依赖 M11 |
| M15: 三端视觉 E2E 门禁 | Not started | 0/1 | 依赖 M12+M13+M14 |
