# Context: M6 Phase 1 — IM 消息流 + Agent + Artifact

**Date**: 2026-05-23
**Phase**: Phase 1 (IM 消息流 + Agent + Artifact)
**Milestone**: M6 (Web IM 工作台核心)
**Goal**: 用户在 Web 三栏工作台中发送消息、@ Role Agent、看到流式回复；支持 Markdown 渲染、代码块语法高亮、上下文 Pin、任务结果卡片
**Depends on**: M5 Phase 1 (Auth + DB Schema + Workspace API)
**Requirements**: FR-WEB-001, FR-CHAT-001, FR-AGENT-001, FR-ARTIFACT-001, FR-RESULT-001, FR-CTX-001(pin)

## Decisions

### Decision 1: Message 类型统一
- **Context**: domain/message.ts (camelCase, 8字段) 与 database.types.ts (snake_case, 13字段) 双轨并存
- **Chosen**: 扩展 domain/message.ts 以匹配 database.types.ts（增加 role_agent_id, metadata, is_pinned, message_type）
- **Reason**: 前端类型更完整，减少转换层；database.types.ts 作为规范基准

### Decision 2: Realtime 订阅方案
- **Context**: Supabase Realtime 已配置（messages + sessions 表已添加到 Publication）
- **Chosen**: 按 session_id 频道过滤订阅
- **Reason**: 减少广播开销；与 Supabase Realtime 机制匹配

### Decision 3: Markdown 渲染库
- **Context**: ChatPanel 当前只渲染纯文本
- **Chosen**: react-markdown + rehype-highlight + remark-gfm
- **Reason**: React 生态标准，无需手动 HTML 拼接，防 XSS

## Constraints

### Locked
- 三栏布局不变：左栏 Sidebar(w-64) + 中栏 ChatPanel(flex-1) + 右栏 DetailPanel(w-72)
- Message 数据使用 database.types.ts 字段规范（snake_case）
- 中文 UI：所有用户可见文字为简体中文
- pnpm dev:web 可真实拉起界面

### Free
- 流式对接方案（SSE 直接调用或经 Supabase Edge Functions）
- Pin 消息展示位置（置顶或折叠面板）
- Result Card 具体渲染样式
- Agent 配置面板交互形式

### Deferred
- Orchestrator Plan DAG 可视化（M7 Desktop Connector 后）
- 多 Agent @ 提及路由逻辑（M7 Runtime Adapter 后）
- Approval 卡片审批流程（M8 Orchestrator 后）

## Code Context

### 关键文件
| 文件 | 角色 | 变更 |
|------|------|------|
| `apps/web/app/api/messages/route.ts` | 新增：消息列表 + 创建 API | 新建 |
| `apps/web/app/api/messages/[id]/route.ts` | 新增：消息更新 API（pin） | 新建 |
| `apps/web/app/(workspace)/workspace/[id]/page.tsx` | 修改：Realtime 订阅 + 真实 SSE | 重写 |
| `apps/web/components/chat/ChatPanel.tsx` | 修改：Markdown 渲染 + 多消息类型 | 重写 |
| `apps/web/components/layout/DetailPanel.tsx` | 修改：Agent 配置 + Artifact 详情 | 重写 |
| `packages/shared/src/domain/message.ts` | 修改：扩展字段 | 重写 |
| `package.json` | 修改：添加 react-markdown 等 | 更新 |

### 关键数据流
```
用户发送消息
  → POST /api/messages { session_id, content, sender_type: 'user' }
  → Supabase messages INSERT
  → Realtime broadcast
  → 前端订阅追加到 messages state
  → ChatPanel 渲染

Agent 流式回复
  → POST /api/chat { session_id, content }
  → SSE stream (Runtime Adapter)
  → 前端逐块消费 delta
  → streamingStatus: streaming → complete
  → 完整消息 INSERT 到 Supabase
```
