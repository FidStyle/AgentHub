---
title: "Learnings"
readMode: optional
priority: medium
category: learning
keywords:
  - bug
  - lesson
  - gotcha
  - learning
---

# Learnings

Add entries with: `/spec-add learning <description>`

## Entries

### Security: Workspace Ownership for Nested Resources
**Owner**: auth + API layer
**Pattern**: Before accessing a child resource (sessions), verify the parent resource (workspace) belongs to the authenticated user via ownership query. Critical for preventing unauthorized cross-tenant access.
```typescript
// Always check: workspace belongs to current user
const { data: ws } = await supabase
  .from('workspaces').select('id').eq('id', workspaceId).eq('owner_id', user.id).single()
if (!ws) return NextResponse.json({ error: '无权限' }, { status: 403 })
```
**M5**: Discovered via auto-test — Session PATCH and GET routes lacked ownership checks. Fixed during review.
**Milestone**: M5

### Testing: Supabase Mock Chain with Mutable Cell
**Owner**: test infrastructure
**Pattern**: For complex chained `.eq().eq().single()` calls in tests, use a mutable cell pattern inside a shared `vi.fn()`. Single shared mock function injected via `vi.mock()` at module level.
```typescript
let cell = { data: undefined as unknown, error: null }
function chainedEq(data: unknown, err: { message: string } | null = null) {
  cell = { data: { ...(data as Record<string, unknown>) }, error: err }
  return chainBuilder(cell.data, cell.error)
}
export function createSupabaseChain(...) {
  return vi.fn(() => ({
    auth: { getUser: ... },
    from: vi.fn((table: string) => { /* return chain builders */ })
  }))
}
```
**M5**: Generated 39 passing tests with 100% pass rate in single pass.
**Milestone**: M5

### Type Safety: `any` Casting for Test Utilities
**Owner**: test layer
**Pattern**: API route handlers have positional `params` arguments. Use `handler: any` with eslint-disable and `as unknown as` for result extraction to avoid TypeScript errors.
```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function callRoute(handler: any, method: ..., options: ...) {
  const result = await handler(request, context as any)
  if (result && typeof result === 'object' && 'status' in ...) {
    const r = result as unknown as { status: number; json: () => Promise<unknown> }
    return { status: r.status, data: await r.json() }
  }
}
```
**M5**: Required after dynamic imports of route handlers to avoid TypeScript compilation errors.
**Milestone**: M5

### Review: Auto-Generated Tests Catch What Manual Review Misses
**Owner**: quality pipeline
**Finding**: 4 critical/medium security issues (session ownership, status validation, name validation) were not caught in the execute phase or manual review — they were caught by auto-generated tests. Ownership checks for nested resources are easy to overlook.
**Action**: Keep auto-test as a mandatory step in quality pipeline. Tests complement review, not replace it.
**Milestone**: M5

### Type Migration: Verify Consumer Side After Changing Shared Types
**Owner**: shared package + consumer layers
**Pattern**: When modifying shared domain types (e.g., Message from camelCase to snake_case), ALL consuming files must be updated simultaneously. TypeScript's excess property checking allows test suites to pass even with stale field names. Always grep for old field references after type migrations.
**M6**: domain/message.ts changed to snake_case, ChatPanel.tsx had stale camelCase refs (msg.senderType, msg.streamingStatus) that compiled but never matched real runtime data.
**Milestone**: M6

### API Error Message Consistency: Standardize Early
**Owner**: API layer
**Pattern**: Keep all API error messages in a single locale (English or Chinese). Mixing languages across route groups creates an inconsistent client-facing contract. Use a shared error constants file from the start.
**M6**: role-agents routes returned Chinese errors while messages routes returned English. No blocking, but noted in integration audit.
**Milestone**: M6

### Realtime Cleanup: useRef + useEffect Cleanup
**Owner**: React frontend
**Pattern**: When subscribing to Supabase Realtime channels in a component with state that changes (e.g., session switching), always use `useRef` to hold the channel and `useEffect` cleanup to unsubscribe. Without cleanup, stale subscriptions persist and cause duplicate messages.
```typescript
const realtimeRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
useEffect(() => {
  return () => { realtimeRef.current?.unsubscribe() }
}, [])
```
**M6**: Verified correct pattern in workspace page.tsx.
**Milestone**: M6

### SSE Streaming: fetch + ReadableStream for POST Requests
**Owner**: React frontend
**Pattern**: Use `fetch()` with `ReadableStream.getReader()` for SSE consumption when the request requires a POST body (unlike EventSource which only supports GET). Parse SSE `data: {...}` lines with TextDecoder. Handle `delta` (append) and `done` (complete) event types.
**M6**: Replaced setInterval mock with real SSE streaming from /api/chat endpoint.
**Milestone**: M6


### Electron IPC 死代码：handler 注册必须在 main 进程显式调用
**Owner**: Electron 全栈
**Pitfall**: `registerRuntimeIPC()`（`runtime:execute` 等 `ipcMain.handle`）已实现却从未被 `main/index.ts` 调用，preload 也未 `contextBridge` 暴露 → renderer `window.electronAPI.runtime.execute` 始终 undefined，假交互被迫硬编码 success echo。修复需三层齐全：main 显式 `registerRuntimeIPC()` + preload `contextBridge` 暴露 + renderer 类型签名，缺一则链路不通。审计时用 grep 反查 handler 是否真的被 wire，不要假设"已实现=已接通"。
**Milestone**: adhoc-desktop-session-runtime (DESKTOP-SESSION-RUNTIME-001)

### 能力未实现的按钮：disabled + title 原因优于假 onClick
**Owner**: 前端 UX
**Pattern**: 当某控制语义（继续/重试/停止 需远程流式 runtime 会话）尚不支持时，按钮应 `disabled` 并加 `title` 说明原因（指向未来 milestone 如 P1-RT），而非挂一个无效果 onClick 制造"可点假交互"。诚实的禁用态比静默失败更可维护，且 renderer 测试可直接断言 disabled+title。
**Milestone**: adhoc-desktop-session-runtime (DESKTOP-SESSION-RUNTIME-001)
