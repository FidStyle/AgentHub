# Roadmap: AgentHub UI Phase 3 (Revised)

## Roadmap Decisions

| # | Decision | Choice | Source |
|---|----------|--------|--------|
| 1 | Scope | UI Phase 3 全量（三端 UI 重构 + 视觉门禁） | research/ui-phase3-task-plan.md |
| 2 | Strategy | Progressive (渐进式交付) | 任务依赖链 |
| 3 | Milestone 数量 | 7 个 milestone (M11-M15 code-complete + M17 验证 + M18 门禁) | 修订：补充验证里程碑 |
| 4 | Tech stack | shadcn/ui + Tailwind CSS 4 + lucide-react + Playwright | research/product/ui-design-system.md |
| 5 | UI 语言 | 全局中文，禁止英文用户文案 | 用户强制约束 |
| 6 | 设计参考 | codeg/shadcn 是三端统一视觉母版；AionUi、lobehub、cherry-studio 只作结构、密度和端侧行为参考 | research/product/ui-design-system.md |
| 7 | 验收标准 | 每个 Milestone 必须通过截图、布局断言、统一视觉母版断言和敏感信息断言 | research/product/ui-design-system.md §9 |
| 8 | 基础复用 | 复用 M5-M10 已完成的功能逻辑，仅重构 UI 层 | state.json M5-M10 completed |
| 9 | 执行纪律 | TDD 优先 + Phase 4 嵌入每个 wave + 需求不清暂停 | 用户 Maestro 流程约束 |
| 10 | M11-M16 状态 | 代码已产出但未经 Maestro 验证流程，需补验证 | 用户确认 |

## Overview

UI Phase 3 基于已完成的 M5-M10 功能基础，按照 `research/product/ui-design-system.md` 设计系统契约，对三端 UI 进行系统性重构。

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
2. 读取 research/product/ui-design-system.md 确认设计约束
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
**Goal**: 确认 packages/ui 组件符合 research/product/ui-design-system.md 所有约束
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

---

### Milestone 19: 三端 P0 UI 统一返工 (v0.19)
**Target**: 让 Web、Desktop、Mobile/PWA 在 P0 达到同一套可交付产品 UI。统一 codeg/shadcn 视觉母版、品牌图标组件化、Desktop 主壳完善、Mobile 页面补全、全量 E2E 门禁。
**Status**: active
**Source**: analyze:ANL-009 (macro 分析)
**Depends on**: M17 completed, M18 completed

#### Phases

- [ ] **Phase 1: 共享 Token 校准 + BrandIcon 组件** — 对齐 PRD hex 色板、新增 BrandIcon/RuntimeIcon
- [ ] **Phase 2: Desktop 品牌图标 + 越界提示 + 轻量输入** — 接入品牌图标、完善越界中文提示、限制输入区
- [ ] **Phase 3: Web 视觉对齐 + 测试补全** — 对齐 codeg 风格、补 1024x768 右栏收起测试
- [ ] **Phase 4: Mobile/PWA 页面补全 + 测试补全** — 补 session/preview 页、截图测试
- [ ] **Phase 5: 三端联合视觉门禁验收** — 全量 E2E + 品牌图标断言 + 跨端色板对比

#### Phase Details

##### Phase 1: 共享 Token 校准 + BrandIcon 组件
**Goal**: packages/ui token 对齐 PRD hex 色板；新增 BrandIcon/RuntimeIcon 组件
**Depends on**: M17, M18 completed
**Requirements**: FR-UI-001, FR-RUNTIME-001
**refer_proj**: codeg (shadcn token), AionUi (agent card icon slot)
**Success Criteria**:
  1. packages/ui/src/globals.css token 值对齐 research/product/ui-design-system.md §4.2 hex 色板
  2. BrandIcon 组件导出 GitHub/Codex/ClaudeCode/OpenCode SVG
  3. RuntimeIcon 组件按 runtimeKind 选择对应品牌图标
  4. 三端 import @agenthub/ui 后可直接使用品牌图标

##### Phase 2: Desktop 品牌图标 + 越界提示 + 轻量输入
**Goal**: Desktop Agent 卡接入品牌图标；越界功能显示中文提示+Web 工作台按钮；输入区限制本地指令
**Depends on**: Phase 1
**Requirements**: FR-DESK-001, FR-RUNTIME-001
**refer_proj**: AionUi (AgentCard icon), codeg (shadcn button states)
**Success Criteria**:
  1. Agent 卡渲染对应 RuntimeIcon（非纯文字）
  2. GitHub 登录按钮渲染 GitHub SVG 图标
  3. 越界功能入口显示中文职责提示 + "打开 Web 工作台" 按钮
  4. 轻量输入区只承载诊断/继续/重试/停止/查看状态类指令
  5. desktop-main-shell E2E 品牌图标断言通过

##### Phase 3: Web 视觉对齐 + 测试补全
**Goal**: Web 三栏工作台视觉对齐 codeg/shadcn 风格；补 1024x768 右栏收起截图测试
**Depends on**: Phase 1
**Requirements**: FR-WEB-001, FR-CHAT-001
**refer_proj**: codeg (Sidebar, ConversationShell, MessageInput)
**Success Criteria**:
  1. Web 工作台截图符合 codeg 中性底色/细边框/紧凑侧栏风格
  2. 1024x768 右栏收起不破版，有截图断言
  3. web visual-gate + web-workbench E2E 通过

##### Phase 4: Mobile/PWA 页面补全 + 测试补全
**Goal**: 补 mobile session 详情页和 preview 页；补截图测试
**Depends on**: Phase 1
**Requirements**: FR-MOB-001
**refer_proj**: lobehub (移动端信息架构)
**Success Criteria**:
  1. /m/sessions/[id] 页面完整渲染消息列表
  2. /m/preview 页面存在且可导航
  3. mobile visual-gate + mobile-pwa E2E 通过（含 session/preview 截图）
  4. 390x844 所有路由无横向滚动

##### Phase 5: 三端联合视觉门禁验收
**Goal**: 全量 E2E 通过 + type-check + lint + 品牌图标断言 + 跨端色板一致性
**Depends on**: Phase 2, 3, 4
**Requirements**: FR-UI-001, FR-WEB-001, FR-DESK-001, FR-MOB-001
**Success Criteria**:
  1. pnpm --filter @agenthub/web type-check 通过
  2. pnpm --filter @agenthub/desktop type-check 通过
  3. pnpm --filter @agenthub/web lint 通过
  4. pnpm --filter @agenthub/desktop lint 通过
  5. Web/Desktop/Mobile visual-gate + desktop-main-shell + web-workbench + mobile-pwa E2E 全绿
  6. 三端截图可见共用色板/圆角/按钮/Badge/输入框/状态卡
  7. GitHub/Codex/Claude Code 图标渲染断言通过

---

## Scope Decisions

- **In scope**: M11-M15 代码验证、TDD 补全、refer_proj 对照、全量 E2E 门禁、三端 P0 UI 统一返工
- **Deferred**: 功能逻辑变更、新 FR-ID 功能开发
- **Out of scope**: 部署发布、Agent Marketplace、版本控制增强、API Key/Base URL 表单

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

---

# Roadmap: P1 Agent Runtime 完整部署

> 独立 P1 initiative。来源：`scratch/20260529-analyze-p1-runtime/conclusions.json`（scope_verdict=large）。
> 本 roadmap 止步于 plan/recommendation，不进入 execute。

## Roadmap Decisions

| # | Decision | Choice | Source |
|---|----------|--------|--------|
| 1 | Scope | P1 Agent Runtime 三子系统完整部署 | macro analyze conclusions |
| 2 | Strategy | Progressive — Phase 1 解除 /api/chat stub 限制优先 | conclusions.recommendation |
| 3 | Phase 拆分 | 3 phase（HostedRuntimeAdapter / Desktop 增强 / Cloud Adapter） | conclusions.subsystems |
| 4 | 基础设施边界 | Cloud runtime / DB / cache 等基础设施默认自建，不依赖 Supabase/Fly/Neon/Upstash 等包装平台 | D-003 |
| 5 | 不回改 | P0-END-TO-END / UI-ALIGN-001 / mobile fixture 已 closeout | boundary_contract |

## Milestone: P1-RT — Cloud Runtime Gateway（架构修订 Revised）

> **修订（2026-05-29）**：用户澄清 Cloud Runtime Gateway 是必需实体（FRP 式 relay），不是 optional provider。
> 取代旧模型「HostedRuntimeAdapter 直连真实云端服务」。架构合同见 `research/contracts/P1-RUNTIME-GATEWAY.md`。
> 本 milestone 止步于 **revised plan/recommendation**，等待确认后再 execute。

**核心模型**：Cloud Runtime Gateway 统一承载两类 runtime endpoint：
- `public_cloud`：AgentHub 官方公共 runtime 池（部署基座 = 自建 Gateway / worker）
- `user_local`：用户 Desktop 本地 runtime，经 gateway relay/tunnel 暴露（复用现有 `/ws/device`）

Web/Mobile 永不直连本地端口，统一请求 gateway；`/api/chat` 按 endpoint 路由 → gateway 决定 public_cloud 还是转发 user_local。

##### Phase 1: Cloud Runtime Gateway contract + DB model + routing/event semantics
**Goal**: 建立 gateway 契约、DB 实体与路由/事件语义，HostedRuntimeAdapter 重定义为 gateway 客户端。**不要求真实部署平台。**
**Depends on**: 无（可独立验收，无需 D-003）
**Key Files**: `apps/web/lib/runtime/hosted-adapter.ts`, `apps/web/app/api/chat/route.ts`, `apps/web/lib/schema/runtime.ts`, `docker/postgres/p0-test-schema.sql`, `packages/shared/src/protocol/runtime-event.ts`
**Success Criteria**:
  1. DB 实体落库（幂等，不影响 P0 表）：`runtime_endpoints` / `runtime_sessions` / `runtime_logs` / `device_runtime_channels` / `runtime_capabilities`
  2. HostedRuntimeAdapter 重构为 gateway 客户端契约：按 endpoint.kind 路由；public_cloud 未配置时明确返回 `endpoint_unavailable`/`public_runtime_available=false`，不连真实平台
  3. `/api/chat` 按 workspace execution_domain / selected endpoint 路由到 gateway 逻辑（user_local 走现有 device relay，cloud 走 public_cloud 占位路由），runtime_sessions 落库
  4. 统一事件语义：`gateway_connected` / `runtime_status` / `public_runtime_available` / `endpoint_unavailable` / `local_runtime_offline` / `tunnel_connected` / `tunnel_disconnected`（定义在 shared 协议；保留 `DEVICE_OFFLINE` 兼容）
  5. type-check 通过 + `/api/chat` 集成测试覆盖新路由/事件/落库 + DB 迁移幂等性验证

##### Phase 2: Desktop local runtime tunnel/channel 接入 gateway
**Goal**: Desktop 本地 runtime 经 gateway 建立 device/channel/tunnel；channel 状态持久化；错误码统一
**Depends on**: Phase 1（gateway 契约 + schema + 事件）
**Key Files**: `apps/web/server/ws-gateway.ts`, `apps/web/server/device-connections.ts`, `apps/web/lib/device-gateway-client.ts`, `packages/shared/src/runtime/*.ts`（不改 Desktop 进程主链路，除非类型必须兼容）
**Success Criteria**:
  1. user_local endpoint 经 `/ws/device` tunnel 接入 gateway，`device_runtime_channels` 持久化连接态
  2. `local_runtime_offline` / `tunnel_connected` / `tunnel_disconnected` 事件闭环
  3. 统一 RuntimeErrorCode 枚举（替代 Desktop exitCode 数字 + Web 'DEVICE_OFFLINE' 字符串），向后兼容
  4. 集成/E2E 验证 tunnel 状态 + 错误码

##### Phase 3: 自建 public cloud runtime pool 实现
**Goal**: public_cloud runtime 池在自建 Gateway / worker 基座上的真实实现
**Depends on**: Phase 1（gateway 契约统一）
**Decision (D-003)**: **全部自建** — 不采用 Modal/Fly 等托管运行平台；Postgres/Redis 等基础设施使用官方镜像或开源实现自部署
**Success Criteria**:
  1. public_cloud runtime 池连接自建 Gateway / worker 基座
  2. 凭证边界隔离 + 超时/重试策略
  3. E2E 或集成测试覆盖（需 staging 或 mock）

## Scope Decisions（修订）

- **In scope**: Cloud Runtime Gateway 契约、两类 endpoint 路由、DB 状态记录、统一事件语义、user_local tunnel、错误码
- **Resolved (D-003)**: public_cloud runtime 池和基础设施走自建路线；Supabase/Fly/Neon/Upstash 等包装平台不进入当前实现路线
- **不再 deferred**: Cloud Gateway 实体本身（必需）
- **Out of scope**: P0/UI-ALIGN-001/mobile fixture 已闭环代码；Desktop 本地 RuntimeHost/StreamAdapter/DeviceChannel 进程主链路改写；实际 execute（本 roadmap 止步 revised plan）
