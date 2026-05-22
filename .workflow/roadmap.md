# Roadmap: AgentHub

## Roadmap Decisions

| # | Decision | Choice | Source |
|---|----------|--------|--------|
| 1 | Scope | P0 MVP 全量（FR-AUTH 到 FR-NOTIFY） | PRD / -y auto |
| 2 | Strategy | Progressive (MVP → Usable → Refined) | -m progressive |
| 3 | Milestone boundaries | M1 工程底座 → M2 Auth+IM 核心 → M3 Runtime+Orchestrator → M4 三端联调+Demo | Phase3 roadmap + minimum-phase |
| 4 | Tech stack | Next.js + Supabase + Electron + pnpm monorepo | technical-design.md |

## Overview

AgentHub 采用渐进式交付：从 monorepo 工程底座出发，逐步叠加 Auth/IM 核心体验、Runtime/Orchestrator 协调能力，最终三端联调完成 P0 Demo。每个 Milestone 遵循最小 Phase 原则（默认 1 Phase），wave DAG 处理内部任务并行。

## Milestones

### Milestone 1: Engineering Foundation (v0.1)
**Target**: Monorepo 骨架 + 共享类型 + 测试基建 + CI
**Status**: planned

#### Phases

- [ ] **Phase 1: Monorepo + Shared Infrastructure** — pnpm workspace、shared domain types、test harness、CI pipeline

#### Phase Details

##### Phase 1: Monorepo + Shared Infrastructure
**Goal**: 建立 `apps/web`、`apps/desktop`、`packages/shared` monorepo 骨架；落地 FR-ID 常量、domain types、state machines、shared test fixtures；CI 可运行 lint + type-check + test
**Depends on**: Nothing (first phase)
**Requirements**: FR-AUTH-001(types), FR-WS-001(types), FR-DEVICE-001(types), FR-RUNTIME-001(types), FR-PERM-001(policies)
**Success Criteria** (what must be TRUE):
  1. `pnpm install && pnpm build` 在 CI 和本地均通过
  2. `packages/shared` 导出 Workspace、Session、Message、RoleAgent、RuntimeEvent 等 domain types
  3. 共享 test harness 可被 web/desktop 项目引用并运行
  4. FR-ID 常量文件存在且被 type-check 覆盖

---

### Milestone 2: Auth + IM Core (v0.2)
**Target**: GitHub OAuth 登录 + Web 三栏 IM 工作台 + 核心消息流
**Status**: planned

#### Phases

- [ ] **Phase 1: Auth + Web IM Shell + Chat Core** — Supabase Auth、Web 三栏布局、Session CRUD、消息发送/接收/流式、基础 Artifact 渲染

#### Phase Details

##### Phase 1: Auth + Web IM Shell + Chat Core
**Goal**: 用户可通过 GitHub OAuth 登录，在 Web 三栏工作台中创建 Workspace/Session，发送消息并看到 Role Agent 流式回复（先用 Hosted Runtime mock）；基础 Markdown/代码块渲染
**Depends on**: Milestone 1 Phase 1
**Requirements**: FR-AUTH-001, FR-WS-001, FR-WEB-001, FR-CHAT-001, FR-AGENT-001(basic), FR-ARTIFACT-001(basic), FR-CTX-001(pin)
**Success Criteria** (what must be TRUE):
  1. 用户可通过 GitHub OAuth 登录并看到 Workspace 列表
  2. 用户可创建 Workspace（选择执行域）和 Session
  3. 用户可发送消息、@ Role Agent，看到流式回复
  4. 消息支持 Markdown 渲染、代码块语法高亮、一键复制
  5. 用户可 pin 消息作为长期上下文

---

### Milestone 3: Runtime + Orchestrator + Desktop (v0.3)
**Target**: 真实 Runtime 接入 + Orchestrator 计划分派 + Desktop Connector + Action 执行
**Status**: planned

#### Phases

- [ ] **Phase 1: Runtime Adapters + Orchestrator + Desktop Connector** — Claude Code/Codex CLI Adapter、Orchestrator Plan DAG、Desktop WebSocket 通道、Action 执行、权限策略、结果卡片

#### Phase Details

##### Phase 1: Runtime Adapters + Orchestrator + Desktop Connector
**Goal**: Role Agent 可通过 Desktop Connector 绑定本地 Claude Code/Codex 并执行任务；Orchestrator 可生成计划、请求确认、分派任务、汇总结果；Action 可执行本地预览命令；权限策略生效
**Depends on**: Milestone 2 Phase 1
**Requirements**: FR-RUNTIME-001, FR-ORCH-001, FR-DESK-001, FR-DEVICE-001(desktop), FR-ACTION-001, FR-PERM-001, FR-RESULT-001, FR-CTX-001(handoff), FR-NOTIFY-001
**Success Criteria** (what must be TRUE):
  1. Desktop Connector 可登录、绑定文件夹、检测本地 Claude Code/Codex 可用性
  2. Role Agent 通过 Adapter 调用本地 Claude Code 并流式回传结果
  3. Orchestrator 可生成 Plan DAG、用户确认后分派 ready 节点
  4. Action 执行本地 preview 命令并返回状态卡片
  5. 权限策略在高风险动作时触发确认流程
  6. 任务结果卡片展示状态、文件变更、Git diff、预览链接

---

### Milestone 4: Multi-Platform Integration + Demo (v0.4)
**Target**: Mobile PWA + 三端联调 + P0 Demo 主路径硬化
**Status**: planned

#### Phases

- [ ] **Phase 1: Mobile + E2E Integration + Demo Hardening** — Mobile PWA 路由、跨端通知/审批、端到端主路径验证、Demo 视频准备

#### Phase Details

##### Phase 1: Mobile + E2E Integration + Demo Hardening
**Goal**: Mobile 可查看 Session、发送消息、完成审批；Web+Desktop+Mobile 三端配合完成一次端到端开发任务；P0 Demo 主路径无阻塞
**Depends on**: Milestone 3 Phase 1
**Requirements**: FR-MOB-001, FR-NOTIFY-001(cross-platform), FR-DEVICE-001(mobile)
**Success Criteria** (what must be TRUE):
  1. Mobile PWA 可查看 Workspace/Session、发送消息、@ Agent
  2. Mobile 可查看待审批队列并完成审批操作
  3. 三端联调：Web 发起任务 → Desktop 执行 → Mobile 审批 → 结果回到 Web
  4. P0 Demo 主路径端到端无手工 patch 可完成
  5. 3 分钟 Demo 视频素材就绪

---

## Scope Decisions

- **In scope**: P0 全部 FR-ID（AUTH/WS/DEVICE/WEB/DESK/MOB/CHAT/AGENT/RUNTIME/ORCH/CTX/ARTIFACT/RESULT/ACTION/PERM/NOTIFY）
- **Deferred**: P1 增强（FR-IM-101 Session 搜索/置顶、FR-AGENT-101 工具集配置、FR-WORKSPACE-101、FR-NOTIFY-101）
- **Out of scope**: P2/P3（FR-COLLAB-201 多人协作、FR-MARKET-201 Agent Marketplace、FR-VERSION-201 版本控制增强、FR-RUNTIME-201 OpenCode、FR-PUBLISH-201 部署平台、FR-DOCS-201）

## Progress

| Milestone | Phase | Status | Completed |
|-----------|-------|--------|-----------|
| 1. Engineering Foundation | 1. Monorepo + Shared Infrastructure | Not started | - |
| 2. Auth + IM Core | 1. Auth + Web IM Shell + Chat Core | Not started | - |
| 3. Runtime + Orchestrator + Desktop | 1. Runtime Adapters + Orchestrator + Desktop Connector | Not started | - |
| 4. Multi-Platform Integration + Demo | 1. Mobile + E2E Integration + Demo Hardening | Not started | - |
