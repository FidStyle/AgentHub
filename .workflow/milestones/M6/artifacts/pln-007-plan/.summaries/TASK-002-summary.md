# TASK-002 Summary: Messages CRUD API + Realtime 订阅

**Task**: TASK-002 | **Wave**: wave-2 | **Status**: completed
**Executor**: workflow-executor agent | **Duration**: ~220s
**Commit**: (created during execution)

## Changes

### apps/web/app/api/messages/route.ts
- GET handler: 返回指定 session_id 的消息列表（含 workspace 归属校验）
- POST handler: 创建新消息（含 auth + workspace 归属校验）

### apps/web/app/api/messages/[id]/route.ts
- PATCH handler: 更新消息字段（目前支持 is_pinned）
- 包含 auth + workspace 归属校验

### apps/web/app/(workspace)/workspace/[id]/page.tsx
- 添加 `useEffect` 加载历史消息: `GET /api/messages?session_id=X`
- 添加 Realtime 订阅: `supabase.channel('messages:' + sessionId).on('postgres_changes', ...)`
- 使用 `useRef` 管理订阅生命周期，session 切换时正确 cleanup
- 用户消息通过 `POST /api/messages` 持久化（Realtime 回调追加）

### Cascading Fix
- `apps/web/components/chat/ChatPanel.tsx`: 更新字段引用
  - `msg.senderType` → `msg.sender_type`
  - `msg.streamingStatus` → `msg.streaming_status`

## Verification
- [x] GET/POST in messages/route.ts
- [x] PATCH in messages/[id]/route.ts
- [x] supabase.channel + postgres_changes in workspace page
- [x] GET/POST /api/messages in workspace page
- [x] Files exist

## Notes
- Realtime deduplication: 按 id 去重后追加
- AI 流式回复仍为 setInterval mock（TASK-003 替换为真实 SSE）
- 消息持久化已工作（POST 后 Realtime 追加）
