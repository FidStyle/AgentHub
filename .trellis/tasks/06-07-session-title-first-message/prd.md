# 新会话标题使用首条消息

## Goal

新建会话默认仍可显示“新会话”，但用户发送第一句话后，会话标题应自动改为第一条用户消息的内容，并持久化到 sessions 表，刷新后仍保持该标题。

## What I already know

* Web 侧会话列表来自 `apps/web/store/session-store.ts`。
* 创建会话 API `apps/web/app/api/sessions/route.ts` 当前默认写入 `name: "新会话"`。
* `/api/chat` 会在发送消息时插入 `messages`，适合作为首条消息触发点。
* 已存在 `PATCH /api/sessions/[id]` 可手动改名，因此自动改名不能覆盖用户已有自定义标题。

## Requirements

* 仅当当前 session 标题为空、`新会话` 或 `未命名会话` 等占位标题时，第一条用户消息触发自动改名。
* 自动标题取第一条用户消息内容，清理多余空白，并限制长度，避免侧栏过长。
* 标题更新必须落库到 `sessions.name`，刷新后可读回。
* 前端发送第一条消息后应立即更新本地 session 列表标题，不等用户刷新。
* 之后继续发送消息不再覆盖已有标题。

## Acceptance Criteria

* [ ] `/api/chat` 在默认标题会话的首条用户消息后更新 `sessions.name`。
* [ ] `/api/chat` 对已有自定义标题不会覆盖。
* [ ] Web session store 在发送消息时把默认标题即时替换为第一句话摘要。
* [ ] 单元测试覆盖 API 自动命名和前端 store 本地更新。

## Out of Scope

* 不做 AI 总结式标题。
* 不增加手动重命名 UI。
* 不改变现有默认创建会话行为。

## Technical Notes

* 主要文件：`apps/web/app/api/chat/route.ts`、`apps/web/store/session-store.ts`。
* 测试文件：`apps/web/__tests__/api/chat.test.ts`、`apps/web/__tests__/session-store.test.ts`。
