# TASK-001 Summary: Message 类型统一 + Markdown 依赖安装

**Task**: TASK-001 | **Wave**: wave-1 | **Status**: completed
**Executor**: workflow-executor agent | **Duration**: ~80s
**Commit**: a97843c

## Changes

### packages/shared/src/domain/message.ts
- 完全重写 `Message` 接口，使用 snake_case 字段匹配 `database.types.ts`
- 新增字段：`role_agent_id`, `metadata`, `is_pinned`, `updated_at`
- 字段更名：`sessionId`→`session_id`, `senderType`→`sender_type`, `type`→`message_type`, `streamingStatus`→`streaming_status`, `createdAt`→`created_at`
- `created_at`/`updated_at` 类型为 `string`（与 DB schema 一致）

### package.json
- 新增 `dependencies`：react-markdown ^9.0.0, rehype-highlight ^7.0.0, remark-gfm ^4.0.0
- `pnpm install` 成功，104 个新包

## Verification
- [x] `grep: 'role_agent_id' packages/shared/src/domain/message.ts`
- [x] `grep: 'message_type' packages/shared/src/domain/message.ts`
- [x] `grep: 'metadata.*Record' packages/shared/src/domain/message.ts`
- [x] `grep: 'is_pinned' packages/shared/src/domain/message.ts`
- [x] `grep: 'created_at' packages/shared/src/domain/message.ts`
- [x] `grep: 'updated_at' packages/shared/src/domain/message.ts`
- [x] `grep: 'react-markdown' package.json`
- [x] `grep: 'rehype-highlight' package.json`
- [x] `grep: 'remark-gfm' package.json`
- [x] `pnpm install` succeeds

## Notes
- 后续任务（TASK-002, TASK-003, TASK-004, TASK-005）依赖新的 Message 类型，需更新引用方
- Workspace page、ChatPanel、chat-store 等文件需要迁移到 snake_case 字段
