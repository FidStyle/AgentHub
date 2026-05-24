# Analysis Discussion: Phase 3 全栈落地

## User Intent
以 research/ 目录下的 PRD 和技术架构文档为唯一真相源，分析全量 P0 需求范围、现有代码差距、交付路径。

## Table of Contents
- [Round 1: Codebase Gap Assessment](#round-1)
- [Round 2: Delivery Path Analysis](#round-2)
- [Current Understanding](#current-understanding)
- [Decisions](#decisions)

---

## Round 1: Codebase Gap Assessment {#round-1}

### Sources
- research/prd.md (16 P0 FR-IDs)
- research/technical-design.md (935 lines, complete tech spec)
- research/product-design.md (product flows)
- Codebase exploration (all apps/ and packages/)

### Key Findings

**已实现 (Functional):**
1. GitHub OAuth 登录流程 (FR-AUTH-001 部分)
2. 路由保护中间件
3. Web 三栏布局骨架 (FR-WEB-001 部分)
4. Chat UI 组件 (纯前端，无后端)
5. Desktop Electron 壳子 + local-adapter (FR-DESK-001 部分)
6. packages/shared 完整 domain types
7. Mobile React Native 基础 chat 屏幕

**完全缺失:**
1. Supabase 数据库 schema (无任何 migration)
2. 消息持久化 (全部 in-memory)
3. Workspace/Session CRUD API
4. 真实 LLM/Agent 调用
5. Runtime Adapter 完整实现
6. Orchestrator 编排引擎
7. DeviceChannel WebSocket 协议
8. 审批/Action 流程
9. 实时订阅 (Supabase Realtime)
10. 中文 UI (当前混合英文)

### Gap Summary
- 16 个 P0 FR-ID 中，仅 FR-AUTH-001 部分实现 (~30%)
- 其余 15 个 FR-ID 处于 0-10% 实现状态
- 核心缺失：数据库层、API 层、实时层、Agent 执行层

---

## Round 2: Delivery Path Analysis {#round-2}

### Scope Verdict Assessment

**独立子系统识别:**
1. Auth + DB Schema + API 基础层
2. Web IM 工作台 (消息流、Session、Workspace)
3. Desktop Connector (DeviceChannel、Runtime 检测、绑定)
4. Runtime Adapter (Claude Code/Codex CLI 接入)
5. Orchestrator (Plan DAG、分派、汇总)
6. Mobile PWA (轻量 IM、审批)

**串行依赖:**
- DB Schema → API → Web UI → Desktop 连接 → Runtime → Orchestrator → Mobile

**结论: scope_verdict = large**
- 6 个独立子系统
- 硬串行依赖链
- 16 个 P0 FR-ID 跨越所有子系统
- 需要完整 roadmap 拆分

---

## Current Understanding

AgentHub 是一个以 IM 为核心的多 Agent 协作平台。当前代码仅有骨架级实现（auth 流程 + UI 壳子 + 类型定义）。从骨架到 P0 Demo 需要：
1. 建立完整数据库层 (Supabase schema + RLS)
2. 实现全部 CRUD API
3. 完成 Web 三栏工作台真实功能
4. 实现 Desktop Connector 完整协议
5. 接入 Claude Code/Codex Runtime
6. 实现 Orchestrator 编排
7. Mobile PWA 轻量功能
8. 三端联调

这是一个 large scope 项目，需要 5-8 个 milestone 的渐进式交付。

---

## Decisions

### D1: Scope Verdict
- **Context:** 16 P0 FR-IDs, 6 独立子系统, 硬串行依赖
- **Options:** large / medium / small
- **Chosen:** large
- **Reason:** 子系统数量 ≥3，存在硬串行依赖，无法跳过 roadmap 直接 plan

### D2: 复用现有代码
- **Context:** 已有 auth 流程、类型定义、UI 骨架
- **Options:** 重写 / 增量构建
- **Chosen:** 增量构建
- **Reason:** 现有骨架质量可接受，类型定义完整，auth 流程可用

### D3: 技术栈确认
- **Context:** research/technical-design.md 已收敛
- **Options:** 沿用 / 调整
- **Chosen:** 沿用 (Next.js + Supabase + Electron + pnpm monorepo)
- **Reason:** 代码已按此架构搭建，无需变更
