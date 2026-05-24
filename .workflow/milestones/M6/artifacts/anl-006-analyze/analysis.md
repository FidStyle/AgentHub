# Analysis: M6 Phase 1 — IM 消息流 + Agent + Artifact

## Executive Summary

M6 Phase 1 实现 Web 三栏 IM 工作台核心功能。现有骨架完整（三栏布局、Mock 流式、DB Schema），主要工作在于**类型统一**、**消息持久化**、**Realtime 启用**、**Markdown 渲染**。

**Overall Assessment**: GO — 核心体验（消息持久化 + Markdown + 流式）技术可行，风险可控。
**Confidence**: 75%

## Six-Dimension Scoring

| Dimension | Score (1-5) | Confidence | Key Evidence |
|-----------|------------|------------|--------------|
| Feasibility | 3 | 70% | 布局骨架已存在，DB Schema 就绪；Realtime 集成和流式对接需验证 |
| Impact | 5 | 95% | IM 工作台是 AgentHub 核心交互界面，直接决定可用性 |
| Risk | 2 | 75% | TypeScript 类型不一致可能导致重构；流式对接复杂度中等 |
| Complexity | 4 | 80% | 6 个子系统（消息持久化/流式/渲染/Agent配置/Artifacts/Realtime） |
| Dependencies | 3 | 85% | 依赖 M5 DB Schema 和 Auth；内部子系统无循环依赖 |
| Alternatives | 3 | 80% | Markdown 渲染可选 react-markdown 或 marked；SSE vs WebSocket |

## Risk Matrix

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Message 类型不一致导致前端重构建 | Medium | High | 统一使用 database.types.ts 字段规范 |
| Realtime 订阅在高并发下性能 | Low | Medium | 按 session_id 过滤频道，控制订阅数量 |
| 流式对接 Runtime Adapter 复杂 | Medium | Medium | 分 two-phase（先 UI 后 API） |

## Recommendations Summary

### Priority HIGH (必须实现)

1. **消息持久化 + Realtime 订阅**
   - 实现 GET/POST /api/messages 端点
   - 前端添加 `supabase.channel('messages').on('postgres_changes')` 订阅
   - 验证：刷新后数据仍存在；多 Tab 同步

2. **统一 Message 类型**
   - 扩展 `packages/shared/src/domain/message.ts` 以匹配 `database.types.ts`
   - 增加字段：`role_agent_id`, `metadata`, `is_pinned`, `message_type`
   - 验证：`tsc --noEmit` 无错误

3. **Markdown + 代码块渲染**
   - 安装 `react-markdown`, `rehype-highlight`, `remark-gfm`
   - 扩展 ChatPanel 消息渲染，按 message_type 分支
   - 验证：Agent 代码回复显示语法高亮

### Priority MEDIUM (核心体验)

4. **流式消息 UI + SSE 对接**
   - 用 `fetch` EventSource 消费 `/api/chat` SSE 流
   - 替换 `setInterval` mock 为真实 delta 追加
   - 验证：逐字显示不闪烁

5. **Role Agent CRUD + 右栏配置**
   - 新增 GET/POST/PATCH /api/role-agents 端点
   - 重写 DetailPanel 为 Agent 配置表单
   - 验证：可编辑保存

6. **Pin 消息功能**
   - PATCH /api/messages/[id] 支持 `is_pinned`
   - ChatPanel hover 显示 Pin 按钮
   - 验证：Pin 的消息在会话重开后仍显示

7. **Result Card / Artifact 渲染**
   - ChatPanel 按 message_type 差异化渲染
   - DetailPanel 展示选中消息的 Artifact 详情
   - 验证：Result Card 显示任务状态/摘要/文件变更

### Priority LOW

8. **Session 归档/重命名/删除**
   - Sidebar 右键菜单
   - 验证：归档后不在列表显示

## Go/No-Go

**Recommendation**: GO
**Confidence**: 75%
**Condition**: REC-001（类型统一）和 REC-002（持久化）是前置条件，必须先完成
**Residual Risks**:
- Message 类型重构可能影响多个组件（ChatPanel, DetailPanel, page.tsx）
- Realtime 订阅取消/重建的生命周期管理需小心处理
