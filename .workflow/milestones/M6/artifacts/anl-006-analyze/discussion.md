# Discussion: M6 Phase 1 — IM 消息流 + Agent + Artifact

## Session Metadata

| Field | Value |
|-------|-------|
| Artifact ID | ANL-006 |
| Phase | Phase 1 |
| Milestone | M6 (Web IM 工作台核心) |
| Scope | phase (micro) |
| Mode | full (auto-deepen) |
| Output | `.workflow/scratch/20260523-analyze-P1-01-im-agent-artifact/` |
| Date | 2026-05-23 |

## User Intent

用户意图：实现 Web 三栏 IM 工作台核心功能，包括消息流、Agent 配置、Markdown 渲染、Pin 上下文、Result Card。

### Intent Coverage Matrix

| # | Original Intent | Status | Where Addressed | Notes |
|---|----------------|--------|-----------------|-------|
| 1 | Web 三栏 IM 工作台 | ✅ Addressed | All 6 implementation_scope items | |
| 2 | 消息发送/接收/流式 | ✅ Addressed | implementation_scope[1,3] | |
| 3 | Agent 配置 | ✅ Addressed | implementation_scope[4] | |
| 4 | Markdown 渲染 | ✅ Addressed | implementation_scope[2] | |
| 5 | Pin 上下文 | ✅ Addressed | implementation_scope[5] | |
| 6 | Result Card | ✅ Addressed | implementation_scope[6] | |

## Current Understanding

### 已有基础（M5 产出）
- 三栏布局骨架（Sidebar + ChatPanel + DetailPanel）已存在
- ChatPanel 支持消息列表渲染和流式光标
- DetailPanel 是空壳（仅 placeholder）
- Supabase Realtime 已配置（ALTER PUBLICATION）
- SSE 端点 `/api/chat` Mock 实现就绪

### 核心 Gap
1. **Message 类型双轨**：domain/message.ts (8字段, camelCase) vs database.types.ts (13字段, snake_case)
2. **消息无持久化**：当前全内存，刷新丢失
3. **Realtime 未启用**：Publication 已配但前端无订阅
4. **Markdown 无渲染**：ChatPanel 只输出纯文本
5. **Agent CRUD 缺失**：类型已定义无 API
6. **Pin 无 UI**：DB 字段存在无操作入口

### 决策
1. **类型统一**：扩展 domain/message.ts 匹配 database.types.ts（增加 role_agent_id, metadata, is_pinned, message_type）
2. **Realtime 方案**：按 session_id 频道过滤订阅，减少广播
3. **Markdown 库**：react-markdown + rehype-highlight + remark-gfm

## Discussion Timeline

### Round 1: 探索发现

**Sources used**:
- cli-explore-agent 3-layer exploration (16 files analyzed)
- roadmap.md M6 Phase 1
- research/prd.md

**Key findings**:
- 三栏布局完整骨架已就绪，DetailPanel 唯一空壳
- Message 类型双轨是最高优先级问题
- 6 个独立子系统可并行实现

**Technical Solutions**:
> **Solution**: 统一 Message 类型定义
> - **Status**: Proposed
> - **Problem**: 双轨类型导致前端/后端不一致
> - **Rationale**: database.types.ts 是 DB 规范，domain/message.ts 应向其对齐
> - **Alternatives**: 保持双轨用映射函数（成本高）；废弃 domain/message.ts（影响面大）
> - **Evidence**: packages/shared/src/domain/message.ts:5-14, packages/shared/src/database.types.ts:57-70
> - **Next Action**: 扩展 domain/message.ts 字段

> **Solution**: Realtime 订阅模式
> - **Status**: Proposed
> - **Problem**: 当前无实时同步，多 Tab 状态不一致
> - **Rationale**: Supabase Realtime 已配置，按频道过滤减少广播
> - **Alternatives**: 轮询（开销大，延迟高）
> - **Evidence**: supabase/migrations/00001_initial_schema.sql:227-228
> - **Next Action**: 前端添加 supabase.channel().on('postgres_changes')

> **Solution**: Markdown 渲染方案
> - **Status**: Proposed
> - **Problem**: Agent 回复需要格式化，当前纯文本
> - **Rationale**: react-markdown 是 React 生态标准，防 XSS
> - **Alternatives**: marked + highlight.js（需手动 HTML 拼接）
> - **Evidence**: apps/web/components/chat/ChatPanel.tsx:30-48
> - **Next Action**: 安装依赖 + 重写 ChatPanel

### Round 2: 实施路径确认

**Key understanding update**:
- 6 个实现项按依赖关系排序：消息持久化 → Markdown → 流式 → Agent 配置 → Pin → Artifacts
- 前 4 项是核心体验，后 2 项是增强功能
- 流式实现分两层：API 层（SSE mock 替换）+ UI 层（streamingStatus 状态）

**Decision records**:
> **Decision**: 流式对接路径
> - **Context**: SSE 端点 mock 已就绪
> - **Chosen**: 先替换 UI 层（取消 setInterval mock），再替换 API 层（接入真实 Runtime）
> - **Reason**: 验证 UI 交互后对接到真实数据源更安全
> - **Impact**: 分 two-phase 实现，降低风险

## Conclusions

### Key Conclusions

1. **类型统一是前置条件**：所有其他实现都依赖一致的 Message 类型
2. **消息持久化是核心**：无持久化则无 Realtime、无 Chat History
3. **渐进实现策略**：先持久化+渲染 → 再流式 → 再 Agent/Pin/Artifacts
4. **scope_verdict = medium**：6 个子系统，无硬串行依赖，可并行开发

### Recommendations (by priority)

| Priority | Recommendation | Action | Verification |
|----------|--------------|--------|-------------|
| HIGH | 消息持久化 + Realtime | API + 前端订阅 | 刷新后数据仍存在 |
| HIGH | 统一 Message 类型 | domain/message.ts 扩展 | tsc 无错误 |
| HIGH | Markdown 渲染 | react-markdown + rehype-highlight | 代码块有高亮 |
| MEDIUM | 流式消息 UI | SSE 消费替换 mock | 逐字显示不闪烁 |
| MEDIUM | Agent CRUD + 右栏配置 | 新 API + DetailPanel 重写 | 可编辑保存 |
| MEDIUM | Pin 消息功能 | is_pinned 字段 | 持久化验证 |
| MEDIUM | Result Card 渲染 | message_type 分支 | 差异化展示 |
| LOW | Session 归档/删除 | Sidebar 右键菜单 | 归档功能正常 |

### Open Questions

1. SSE 流式经 /api/chat 直接调用 Runtime 还是经 Supabase Edge Functions？
2. Pin 消息展示在置顶还是折叠面板？
3. Agent 配置面板用表单直接编辑还是滑出面板？

## Session Statistics

| Metric | Value |
|--------|-------|
| Rounds | 2 (auto-deepen) |
| Sources | cli-explore-agent (3-layer, 16 files) |
| Decisions captured | 3 |
| Technical solutions | 3 |
| Recommendations | 8 (4 high, 4 medium, 0 low) |
| Scope verdict | medium |
| Confidence | 75% |
