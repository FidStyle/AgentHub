# Roadmap: AgentHub UI Phase 3 (Revised)

## Roadmap Decisions

| # | Decision | Choice | Source |
|---|----------|--------|--------|
| 1 | Scope | UI Phase 3 全量（三端 UI 重构 + 视觉门禁） | research/ui-phase3-task-plan.md |
| 2 | Strategy | Progressive (渐进式交付) | 任务依赖链 |
| 3 | Milestone 数量 | 7 个 milestone (M11-M15 code-complete + M17 验证 + M18 门禁) | 修订：补充验证里程碑 |
| 4 | Tech stack | shadcn/ui + Tailwind CSS 4 + lucide-react + Playwright | research/ui-design-system.md |
| 5 | UI 语言 | 全局中文，禁止英文用户文案 | 用户强制约束 |
| 6 | 设计参考 | codeg/shadcn 是三端统一视觉母版；AionUi、lobehub、cherry-studio 只作结构、密度和端侧行为参考 | research/ui-design-system.md |
| 7 | 验收标准 | 每个 Milestone 必须通过截图、布局断言、统一视觉母版断言和敏感信息断言 | research/ui-design-system.md §9 |
| 8 | 基础复用 | 复用 M5-M10 已完成的功能逻辑，仅重构 UI 层 | state.json M5-M10 completed |
| 9 | 执行纪律 | TDD 优先 + Phase 4 嵌入每个 wave + 需求不清暂停 | 用户 Maestro 流程约束 |
| 10 | M11-M16 状态 | 代码已产出但未经 Maestro 验证流程，需补验证 | 用户确认 |

## Overview

UI Phase 3 基于已完成的 M5-M10 功能基础，按照 `research/ui-design-system.md` 设计系统契约，对三端 UI 进行系统性重构。

**当前状态**：M11-M16 代码已产出（设计系统组件、Web 三栏工作台、Desktop Console、Mobile/PWA、lint/type-check 修复），但执行过程未遵循 Maestro 纪律：
- 未 TDD 优先（先写代码后补测试）
- 未逐切片跑 E2E 验证
- 未参考 refer_proj 对照实现
- 未在需求不清时暂停生成 prd-amendments

**修订策略**：保留已产出代码，新增 M17（TDD 验证补全）、M17.5（三端视觉统一返工）和 M18（全量视觉门禁），严格按 Maestro 流程执行。

执行顺序：M17 逐端 TDD 验证补全 → M17.5 统一视觉母版返工 → M18 全量三端 E2E 门禁。

## Maestro 执行纪律（所有后续 Milestone 必须遵守）

### 前置检查
每个任务开始前必须：
1. 读取 research/prd.md 确认 FR-ID 验收标准
2. 读取 research/ui-design-system.md 确认设计约束
3. 读取对应 .trellis/tasks/*/prd.md 确认任务范围
4. 确认 refer_proj 参考来源
5. 确认 codeg/shadcn 是三端统一视觉母版，其他参考项目只提供结构或端侧行为

### TDD 优先
1. 先写 Playwright 测试/断言（期望行为）
2. 运行测试确认失败（红）
3. 实现/修复 UI 代码
4. 运行测试确认通过（绿）
5. 截图保存至 e2e/artifacts/

### Phase 4 嵌入
每完成一个 wave：
1. 跑该 wave 对应的 E2E 测试
2. 跑布局断言（无横向滚动、无重叠）
3. 跑敏感信息断言（无 API Key 等）
4. 跑统一视觉母版断言（三端共享色板、圆角、按钮、Badge、消息气泡、输入框和状态卡）
5. 截图留存
6. 全部通过后才进入下一个 wave

### 需求不清暂停
如果实现中发现：
- PRD 没写清
- 验收标准不够
- 参考项目和当前契约冲突

必须：
1. 暂停实现
2. 生成 research/prd-amendments/{topic}.md
3. 回填 Trellis 任务
4. 等待用户确认后继续

---

## Milestones

### Milestone 11: UI 基础设施与设计系统 (v0.11)
**Target**: 落地三端共享设计变量、基础组件、状态组件和 E2E 定位点约定
**Status**: code-complete (未经 Maestro 验证)

### Milestone 12: Web 三栏 IM 工作台重构 (v0.12)
**Target**: 重构 Web 三栏 IM 工作台
**Status**: code-complete (未经 Maestro 验证)

### Milestone 13: Desktop Connector Console 重构 (v0.13)
**Target**: 重构 Electron Connector Console
**Status**: code-complete (未经 Maestro 验证)

### Milestone 14: Mobile/PWA 轻量 IM、审批、预览 (v0.14)
**Target**: 实现移动轻量 IM、审批和预览
**Status**: code-complete (未经 Maestro 验证)

### Milestone 15: 视觉 E2E 基础 (v0.15)
**Target**: E2E 测试框架和基础 helper
**Status**: code-complete (未经 Maestro 验证)

### Milestone 16: Lint/Type 修复 (v0.16)
**Target**: 全量 lint + type-check 通过
**Status**: completed

---

### Milestone 17: TDD 验证补全 (v0.17)
**Target**: 按 Maestro 纪律对 M11-M15 产出进行 TDD 验证、refer_proj 对照、截图留存
**Status**: active

#### Phases

- [ ] **Phase 1: 设计系统 TDD 验证** — 验证 UI 基础组件符合设计系统契约，补全缺失断言
- [ ] **Phase 2: 三端页面 TDD 验证** — Web/Desktop/Mobile 逐端验证布局、状态、敏感信息
- [ ] **Phase 3: refer_proj 对照审计** — 对照参考项目检查 UI 实现差距，生成 gap 报告

#### Phase Details

##### Phase 1: 设计系统 TDD 验证
**Goal**: 确认 packages/ui 组件符合 research/ui-design-system.md 所有约束
**Depends on**: M11-M15 code-complete
**Requirements**: FR-UI-001, FR-DEVICE-001
**Trellis Task**: 05-25-ui-foundation-design-system
**refer_proj**: AionUi (组件风格), codeg (状态卡)
**Success Criteria** (what must be TRUE):
  1. 每个基础组件（Button, Card, Input, Badge, Dialog, StateCard）有 Playwright 渲染测试
  2. 设计变量（颜色、间距、圆角）在三端主题中生效且有断言
  3. 状态组件覆盖所有 9 种状态且渲染中文文案
  4. StateCard 不出现 API Key / ANTHROPIC_API_KEY / OPENAI_API_KEY / Base URL
  5. lucide 图标按钮有中文 aria-label
  6. E2E 定位点（workspace-shell, chat-panel 等）存在且可定位
  7. 截图保存至 e2e/artifacts/design-system/

##### Phase 2: 三端页面 TDD 验证
**Goal**: 逐端验证页面布局、交互状态和敏感信息边界
**Depends on**: Phase 1
**Requirements**: FR-WEB-001, FR-DESK-001, FR-MOB-001, FR-CHAT-001, FR-ARTIFACT-001
**Trellis Tasks**: 05-25-web-three-column-workbench-ui, 05-25-desktop-connector-console-ui, 05-25-mobile-pwa-im-approval-preview-ui
**refer_proj**: lobehub (三栏布局), cherry-studio (消息流), codeg (Desktop Console)
**Success Criteria** (what must be TRUE):
  1. Web 1440x900: 三栏不重叠，左栏/中栏/右栏均可见
  2. Web 1024x768: 右栏收起，无横向滚动
  3. Desktop 1200x800: connector-console 定位点存在，状态卡不重叠
  4. Desktop: 无 API Key / Base URL / 环境变量输入框
  5. Mobile 390x844: 无横向滚动，输入框不遮挡消息
  6. 所有页面 UI 文字为简体中文（无英文占位）
  7. 计划卡、审批卡、任务结果卡有截图和布局断言
  8. 截图保存至 e2e/artifacts/{web,desktop,mobile}/

##### Phase 3: refer_proj 对照审计
**Goal**: 对照参考项目检查 UI 实现质量，生成差距报告
**Depends on**: Phase 2
**Requirements**: FR-UI-001
**refer_proj**: AionUi, codeg, lobehub, cherry-studio
**Success Criteria** (what must be TRUE):
  1. 对照 AionUi 检查组件风格一致性（圆角、间距、颜色语义）
  2. 对照 codeg 检查 Desktop Console 状态卡布局
  3. 对照 lobehub 检查三栏工作台信息密度
  4. 对照 cherry-studio 检查消息流渲染
  5. 差距报告写入 research/prd-amendments/refer-proj-audit.md
  6. 关键差距回填 Trellis 任务

---

### Milestone 17.5: 三端 UI 视觉统一返工 (v0.17.5)
**Target**: 修正 Web、Desktop、Mobile/PWA 风格割裂问题，统一到 codeg/shadcn 工作台视觉母版
**Status**: planned

#### Phases

- [ ] **Phase 1: 统一母版测试先行** — 先补共享 token/组件断言和三端截图对照
- [ ] **Phase 2: 三端 UI 返工** — 修正 Web、Desktop、Mobile/PWA 页面视觉，不改变三端职责边界
- [ ] **Phase 3: 局部门禁** — 跑局部 E2E、截图、布局、敏感信息和统一母版断言

#### Phase Details

##### Phase 1-3: 视觉统一返工
**Goal**: 三端像同一个 AgentHub 产品，而不是三个参考项目拼贴
**Depends on**: M17 Phase 3
**Requirements**: FR-UI-001, FR-WEB-001, FR-DESK-001, FR-MOB-001, FR-CHAT-001, FR-RUNTIME-001
**Trellis Task**: 05-26-ui-visual-unification-refactor
**refer_proj**: codeg/shadcn 为视觉母版；AionUi、lobehub、cherry-studio 只作结构参考
**Success Criteria** (what must be TRUE):
  1. 统一母版测试先于 UI 改动落地
  2. Web、Desktop、Mobile/PWA 同状态截图能看出共享色板、圆角、按钮、Badge、消息气泡、输入框和状态卡
  3. Desktop 不形成 cherry-studio Provider 设置页视觉
  4. Mobile 不形成独立 lobehub 模型配置视觉
  5. Web 不形成 AionUi/Arco 独立视觉皮肤
  6. 本地 Runtime 凭证边界跨端断言通过
  7. 需求不清时生成 research/prd-amendments/*.md 并暂停

---

### Milestone 18: 全量三端 E2E 视觉门禁 (v0.18)
**Target**: 全量三端 E2E 通过，截图留存，CI 门禁就绪
**Status**: planned

#### Phases

- [ ] **Phase 1: 全量视觉门禁** — 三端全量 E2E 运行 + 截图归档 + 门禁报告

#### Phase Details

##### Phase 1: 全量视觉门禁
**Goal**: 三端所有 E2E 测试通过，截图完整归档，生成门禁报告
**Depends on**: M17.5 Phase 3
**Requirements**: FR-UI-001, FR-WEB-001, FR-DESK-001, FR-MOB-001
**Trellis Task**: 05-25-visual-e2e-gate
**Success Criteria** (what must be TRUE):
  1. Web Playwright (1440x900 + 1024x768) 全部通过
  2. Mobile Playwright (390x844) 全部通过
  3. Desktop Playwright (1200x800) 全部通过
  4. 统一 helper 全部就绪：expectNoHorizontalOverflow, expectNoOverlap, expectNoSensitiveFields
  5. 统一视觉母版 helper 或等价断言就绪：expectUsesUnifiedVisualSystem
  6. 截图归档至 e2e/artifacts/{web,desktop,mobile}/{page}/{state}.png
  7. 本地 Runtime 凭证边界跨端断言通过
  8. 门禁报告生成至 .workflow/scratch/visual-gate-report.md

---

## FR-ID → Milestone 映射 (UI Phase 3)

| FR-ID | Code Milestone | Verify Milestone | 验收重点 |
|-------|---------------|-----------------|----------|
| FR-UI-001 | M11 + M12-M15 | M17 P1 + M18 | 设计系统合规 |
| FR-DEVICE-001 | M11 | M17 P1 | 状态组件、断点适配 |
| FR-WEB-001 | M12 | M17 P2 + M18 | 三栏布局、响应式 |
| FR-CHAT-001 | M12 + M14 | M17 P2 | 消息流 UI |
| FR-ARTIFACT-001 | M12 | M17 P2 | 右栏 Artifact tabs |
| FR-RESULT-001 | M12 + M14 | M17 P2 | 任务结果卡片 |
| FR-ORCH-001 | M12 | M17 P2 | 计划卡 UI |
| FR-PERM-001 | M12 | M17 P2 | 审批卡 UI |
| FR-DESK-001 | M13 | M17 P2 + M18 | Connector Console |
| FR-RUNTIME-001 | M13 | M17 P2 | Runtime 检测 UI |
| FR-ACTION-001 | M13 | M17 P2 | 执行活动 UI |
| FR-NOTIFY-001 | M13 + M14 | M17 P2 | 待审批入口 |
| FR-MOB-001 | M14 | M17 P2 + M18 | 移动轻量界面 |

## Scope Decisions

- **In scope**: M11-M15 代码验证、TDD 补全、refer_proj 对照、全量 E2E 门禁
- **Deferred**: 功能逻辑变更、新 FR-ID 功能开发
- **Out of scope**: 部署发布、Agent Marketplace、版本控制增强

## Progress

| Milestone | Status | Phases Done | Notes |
|-----------|--------|-------------|-------|
| M11: UI 基础设施与设计系统 | code-complete | 1/1 | 代码就绪，待 TDD 验证 |
| M12: Web 三栏 IM 工作台重构 | code-complete | 1/1 | 代码就绪，待 TDD 验证 |
| M13: Desktop Connector Console 重构 | code-complete | 1/1 | 代码就绪，待 TDD 验证 |
| M14: Mobile/PWA 轻量 IM、审批、预览 | code-complete | 1/1 | 代码就绪，待 TDD 验证 |
| M15: 视觉 E2E 基础 | code-complete | 1/1 | 框架就绪，待全量运行 |
| M16: Lint/Type 修复 | completed | 1/1 | ✓ |
| M17: TDD 验证补全 | active | 0/3 | 当前里程碑 |
| M18: 全量三端 E2E 视觉门禁 | planned | 0/1 | 依赖 M17 |
