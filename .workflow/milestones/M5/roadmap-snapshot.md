# Roadmap: AgentHub Phase 3 全栈落地

## Roadmap Decisions

| # | Decision | Choice | Source |
|---|----------|--------|--------|
| 1 | Scope | P0 MVP 全量（16 个 FR-ID） | research/prd.md |
| 2 | Strategy | Progressive (渐进式交付) | analyze:ANL-005 |
| 3 | Milestone 数量 | 5 个 milestone (M5-M9) | scope_verdict=large |
| 4 | Tech stack | Next.js + Supabase + Electron + pnpm monorepo | research/technical-design.md |
| 5 | UI 语言 | 全局中文 | 用户强制约束 |
| 6 | 每个 Milestone | 必须产出可运行 UI + 一键启动 | 用户强制约束 |
| 7 | Mobile | PWA (同一 Next.js 响应式路由) | research/technical-design.md |
| 8 | 基础复用 | 复用已有 monorepo 骨架 + auth 流程 + 类型定义 | analyze:ANL-005 |

## Overview

AgentHub Phase 3 从已有 monorepo 骨架出发，渐进式实现全部 P0 需求。每个 Milestone 必须产出可运行的真实 UI 界面，禁止纯逻辑交付。

已有基础：pnpm monorepo 骨架、GitHub OAuth 流程、Web 三栏布局壳子、Desktop Electron 壳子、packages/shared 完整 domain types。

## Milestones

### Milestone 5: Auth + DB + API 基础层 (v0.5)
**Target**: 完善 Auth 流程 + Supabase DB Schema + Workspace/Session CRUD API + 中文登录/首页 UI
**Status**: planned

#### Phases

- [ ] **Phase 1: Auth + DB Schema + Workspace API** — Supabase 表结构、RLS 策略、Workspace/Session CRUD、中文登录页

#### Phase Details

##### Phase 1: Auth + DB Schema + Workspace API
**Goal**: 用户可通过 GitHub OAuth 登录，看到中文首页，创建 Workspace 和 Session，数据持久化到 Supabase
**Depends on**: 已有 monorepo 骨架
**Requirements**: FR-AUTH-001, FR-WS-001, FR-PERM-001(基础)
**Success Criteria** (what must be TRUE):
  1. `pnpm dev:web` 启动后浏览器可访问中文登录页
  2. GitHub OAuth 登录成功后跳转中文 Workspace 列表页
  3. 用户可创建 Workspace（选择执行域）和 Session
  4. 所有数据持久化到 Supabase（非 in-memory）
  5. 所有 UI 文字为简体中文

---

### Milestone 6: Web IM 工作台核心 (v0.6)
**Target**: Web 三栏 IM 工作台完整功能 + 消息流 + Agent 配置 + Artifact 渲染
**Status**: planned

#### Phases

- [ ] **Phase 1: IM 消息流 + Agent + Artifact** — 消息发送/接收/流式、Role Agent 配置、Markdown/代码块渲染、上下文 Pin、结果卡片

#### Phase Details

##### Phase 1: IM 消息流 + Agent + Artifact
**Goal**: 用户在 Web 三栏工作台中发送消息、@ Role Agent、看到流式回复（先用 Hosted Runtime mock）；支持 Markdown 渲染、代码块高亮、上下文 Pin、任务结果卡片
**Depends on**: Milestone 5 Phase 1
**Requirements**: FR-WEB-001, FR-CHAT-001, FR-AGENT-001, FR-ARTIFACT-001, FR-RESULT-001, FR-CTX-001(pin)
**Success Criteria** (what must be TRUE):
  1. 左栏 Workspace 切换 + Session 列表功能完整
  2. 中栏消息流支持用户消息、Agent 流式回复、系统消息
  3. 用户可 @ Role Agent，Agent 配置可在右栏查看/编辑
  4. 消息支持 Markdown 渲染、代码块语法高亮、一键复制
  5. 用户可 pin 消息作为长期上下文
  6. 任务结果卡片展示状态、摘要、文件变更
  7. 所有 UI 文字为简体中文
  8. Supabase Realtime 订阅消息更新

---

### Milestone 7: Desktop Connector + Runtime (v0.7)
**Target**: Desktop Connector 完整协议 + Claude Code/Codex Runtime Adapter + 设备绑定
**Status**: planned

#### Phases

- [ ] **Phase 1: Desktop Connector + Runtime Adapter** — 设备绑定、WebSocket DeviceChannel、Runtime 检测、Claude Code CLI Adapter、流式事件回传

#### Phase Details

##### Phase 1: Desktop Connector + Runtime Adapter
**Goal**: Desktop Connector 可登录绑定、检测本地 Claude Code/Codex、通过 WebSocket 与后端通信；Role Agent 可通过 Adapter 调用本地 CLI 并流式回传结果
**Depends on**: Milestone 6 Phase 1
**Requirements**: FR-DESK-001, FR-DEVICE-001, FR-RUNTIME-001, FR-AGENT-001(runtime binding)
**Success Criteria** (what must be TRUE):
  1. `pnpm dev:desktop` 启动 Electron 窗口，显示中文 Connector Console
  2. Desktop 可通过绑定码与 Web 账号关联
  3. Desktop 检测本地 Claude Code/Codex 可用性并显示状态
  4. Desktop 通过 WebSocket 与后端建立 DeviceChannel
  5. Role Agent 通过 Adapter 调用本地 Claude Code 并流式回传结果
  6. 所有 Desktop UI 文字为简体中文

---

### Milestone 8: Orchestrator + Action + 权限 (v0.8)
**Target**: Orchestrator 编排引擎 + Action 执行 + 权限策略 + 通知队列
**Status**: planned

#### Phases

- [ ] **Phase 1: Orchestrator + Action + Permission** — Orchestrator Plan DAG、计划确认、任务分派、Action 执行、权限策略、站内通知

#### Phase Details

##### Phase 1: Orchestrator + Action + Permission
**Goal**: Orchestrator 可生成计划、请求确认、分派任务、汇总结果；Action 可执行本地命令；权限策略在高风险动作时触发确认；站内通知队列工作
**Depends on**: Milestone 7 Phase 1
**Requirements**: FR-ORCH-001, FR-CTX-001(handoff), FR-ACTION-001, FR-PERM-001, FR-NOTIFY-001
**Success Criteria** (what must be TRUE):
  1. Orchestrator 可生成 Plan DAG 并在 Web 展示计划卡
  2. 用户确认后 Orchestrator 分派 ready 节点给 Role Agent
  3. Action 执行本地 preview 命令并返回状态卡片
  4. 权限策略在高风险动作时触发确认流程
  5. 站内通知队列展示待审批项
  6. 上下文 Handoff 在角色切换时传递 Context Package
  7. 所有 UI 文字为简体中文

---

### Milestone 9: Mobile + 三端联调 + Demo (v0.9)
**Target**: Mobile PWA + 三端联调 + P0 Demo 主路径硬化
**Status**: planned

#### Phases

- [ ] **Phase 1: Mobile PWA + E2E Demo** — Mobile 响应式路由、跨端通知/审批、端到端主路径验证

#### Phase Details

##### Phase 1: Mobile PWA + E2E Demo
**Goal**: Mobile 可查看 Session、发送消息、完成审批；Web+Desktop+Mobile 三端配合完成一次端到端开发任务；P0 Demo 主路径无阻塞
**Depends on**: Milestone 8 Phase 1
**Requirements**: FR-MOB-001, FR-NOTIFY-001(cross-platform), FR-DEVICE-001(mobile), 全部 P0 FR-ID
**Success Criteria** (what must be TRUE):
  1. Mobile PWA 路由可在手机浏览器访问
  2. Mobile 可查看 Workspace/Session 列表和消息流
  3. Mobile 可发送消息和完成待确认动作
  4. Web + Desktop + Mobile 三端配合完成端到端开发任务
  5. P0 Demo 主路径无阻塞错误
  6. 所有 Mobile UI 文字为简体中文

---

## FR-ID → Milestone 映射

| FR-ID | Milestone | Phase |
|-------|-----------|-------|
| FR-AUTH-001 | M5 | P1 |
| FR-WS-001 | M5 | P1 |
| FR-PERM-001 | M5 (基础) + M8 (完整) | P1 |
| FR-WEB-001 | M6 | P1 |
| FR-CHAT-001 | M6 | P1 |
| FR-AGENT-001 | M6 (配置) + M7 (binding) | P1 |
| FR-ARTIFACT-001 | M6 | P1 |
| FR-RESULT-001 | M6 | P1 |
| FR-CTX-001 | M6 (pin) + M8 (handoff) | P1 |
| FR-DESK-001 | M7 | P1 |
| FR-DEVICE-001 | M7 + M9 | P1 |
| FR-RUNTIME-001 | M7 | P1 |
| FR-ORCH-001 | M8 | P1 |
| FR-ACTION-001 | M8 | P1 |
| FR-NOTIFY-001 | M8 + M9 | P1 |
| FR-MOB-001 | M9 | P1 |

## Progress

| Milestone | Status | Phases Done | Notes |
|-----------|--------|-------------|-------|
| M5: Auth + DB + API | planned | 0/1 | |
| M6: Web IM 工作台 | planned | 0/1 | |
| M7: Desktop + Runtime | planned | 0/1 | |
| M8: Orchestrator + Action | planned | 0/1 | |
| M9: Mobile + Demo | planned | 0/1 | |
