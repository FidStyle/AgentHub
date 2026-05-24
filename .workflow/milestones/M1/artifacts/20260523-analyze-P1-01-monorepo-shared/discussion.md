# Discussion: Phase 1 — Monorepo + Shared Infrastructure

## Table of Contents
- [Session Metadata](#session-metadata)
- [User Intent](#user-intent)
- [Current Understanding](#current-understanding)
- [Round 1: Research Document Analysis](#round-1-research-document-analysis)
- [Decisions](#decisions)
- [Intent Coverage](#intent-coverage)

## Session Metadata

| Field | Value |
|-------|-------|
| Session ID | ANL-01-monorepo-shared-2026-05-23 |
| Scope | Phase (micro mode) |
| Phase | 1 — Monorepo + Shared Infrastructure |
| Milestone | M1 — Engineering Foundation |
| Mode | Auto (-y) |
| Dimensions | architecture, implementation, dependencies |
| Depth | Standard |

## User Intent

1. 建立 pnpm monorepo 骨架（apps/web, apps/desktop, packages/shared）
2. 落地 FR-ID 常量和 domain types
3. 搭建共享 test harness
4. CI 可运行 lint + type-check + test
5. 三端工程壳子可一键启动（pnpm dev:web, pnpm dev:desktop）
6. 全局中文 UI 规范

## Current Understanding

Phase 1 是 greenfield 脚手架搭建。技术路线已在 research/technical-design.md 中明确锁定：

- **Web**: Next.js App Router + React + TypeScript
- **Desktop**: Electron + React + TypeScript
- **Mobile**: 同一 Next.js 应用的响应式 PWA 路由（不单独建 app）
- **共享层**: packages/shared 纯 TypeScript（domain types, protocol, state machines, api-client, policies）
- **包管理**: pnpm workspace
- **数据库/Auth**: Supabase（Phase 1 只建类型，不接入）

Phase 1 的核心交付是工程骨架 + 类型系统，不涉及业务逻辑实现。但根据用户强制交付标准，必须同时产出可运行的 UI 壳子。

## Round 1: Research Document Analysis

### 关键发现

1. **仓库结构已明确定义**（technical-design.md §3）：
   - `apps/web/` — Next.js App Router
   - `apps/desktop/` — Electron main/preload/renderer
   - `packages/shared/` — domain types, protocol, state machines, api-client, policies

2. **工程边界约束**：
   - packages/shared 不依赖 DOM、Electron、Node-only API
   - Electron renderer 不直接访问文件系统
   - Web UI 组件不承诺迁移到 React Native

3. **Domain Types 已列举**（technical-design.md §7）：
   - Workspace, Session, Message, Artifact, RoleAgent, RuntimeBinding, RuntimeSession, ActionRequest, PendingApproval, TaskResult
   - 状态机：message/action/orchestrator/permission states

4. **FR-ID 需求映射**：
   - FR-AUTH-001(types), FR-WS-001(types), FR-DEVICE-001(types), FR-RUNTIME-001(types), FR-PERM-001(policies)

5. **用户交付标准要求**：
   - 必须有可运行的 Web 和 Desktop UI 壳子
   - 必须有 pnpm dev:web 和 pnpm dev:desktop 启动脚本
   - UI 文字必须 100% 中文

### Narrative Synthesis

**起点**: Greenfield 项目，research 文档已完成技术选型。
**关键进展**: 技术路线完全锁定，无需额外探索。Phase 1 范围清晰：monorepo 骨架 + types + 可运行壳子。
**决策影响**: Auto mode，直接采用 research 文档推荐方案。
**当前理解**: 这是一个低风险、高确定性的脚手架阶段，关键在于正确落地已决定的架构。
**遗留问题**: 具体 UI 框架版本、测试框架选择、CI 平台选择。

## Decisions

| # | Decision | Choice | Source |
|---|----------|--------|--------|
| 1 | Web 框架 | Next.js App Router | research/technical-design.md |
| 2 | Desktop 框架 | Electron | research/modules/client-shells.md |
| 3 | Mobile 策略 | 响应式 PWA（同一 Next.js 应用） | research/modules/client-shells.md |
| 4 | 包管理 | pnpm workspace | research/technical-design.md |
| 5 | 语言 | TypeScript strict | research/technical-design.md |
| 6 | 共享层边界 | 纯 TS，无 DOM/Node/Electron 依赖 | research/technical-design.md §3 |

## Intent Coverage

| # | Intent | Status | Where Addressed |
|---|--------|--------|-----------------|
| 1 | pnpm monorepo 骨架 | ✅ | Round 1 — 结构已明确 |
| 2 | FR-ID 常量 + domain types | ✅ | Round 1 — 实体列表已明确 |
| 3 | 共享 test harness | 🔄 | 需在 context.md 中决定测试框架 |
| 4 | CI lint + type-check + test | 🔄 | 需在 context.md 中决定 CI 平台 |
| 5 | 一键启动脚本 | ✅ | pnpm dev:web, pnpm dev:desktop |
| 6 | 全局中文 UI | ✅ | 作为 Locked 约束 |

#### 压力测试

> **Finding**: Phase 1 只建类型不接入 Supabase
> - **Evidence demand**: technical-design.md 明确 Phase 1 scope 是 types + test harness + CI
> - **Assumption probe**: 假设不建 UI 壳子？→ 用户强制标准明确要求可运行界面
> - **Boundary**: UI 壳子只需展示空白框架页面，不需要业务逻辑
> - **Conclusion**: 压力测试通过，scope 合理
