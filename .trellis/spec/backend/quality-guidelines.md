# Quality Guidelines

> Code quality standards for backend development.

---

## Overview

<!--
Document your project's quality standards here.

Questions to answer:
- What patterns are forbidden?
- What linting rules do you enforce?
- What are your testing requirements?
- What code review standards apply?
-->

(To be filled by the team)

---

## Forbidden Patterns

<!-- Patterns that should never be used and why -->

(To be filled by the team)

---

## Required Patterns

<!-- Patterns that must always be used -->

(To be filled by the team)

---

## Testing Requirements

<!-- What level of testing is expected -->

(To be filled by the team)

---

## Code Review Checklist

<!-- What reviewers should check -->

(To be filled by the team)

## Scenario: Custom Next Server With WebSocket Routes

### 1. Scope / Trigger

- Trigger: Web custom server hosts both Next.js dev traffic and product WebSocket routes on the same HTTP server.
- Applies to `apps/web/server.ts` and any `server/*.ts` module that registers WebSocket upgrade handling.

### 2. Signatures

- Next dev HMR path: `/_next/webpack-hmr`.
- AgentHub device gateway path: `/ws/device`.
- Server API: `setupWebSocketGateway(server: http.Server): WebSocketServer`.

### 3. Contracts

- Product WebSocket handlers must only consume their owned path.
- All non-product upgrade requests must remain available for Next.js, especially HMR in development.
- If the web server loads local environment files, explicit process env values win over file values.

### 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| Upgrade path is `/ws/device` | Route to AgentHub device gateway. |
| Upgrade path is `/_next/webpack-hmr` | Route to `app.getUpgradeHandler()` or otherwise let Next handle it. |
| Upgrade path is unrelated | Do not terminate it from the device gateway. |
| Local env file defines an existing key | Keep the explicit process env value. |

### 5. Good/Base/Bad Cases

- Good: `new WebSocketServer({ noServer: true })` plus a server `upgrade` listener that checks `new URL(req.url ?? '/', 'http://localhost').pathname`.
- Base: Custom server has one product WebSocket path and one Next upgrade handler.
- Bad: `new WebSocketServer({ server, path: '/ws/device' })` on the same server as Next dev; `ws` can reject non-matching upgrade paths with HTTP 400 before Next HMR sees them.

### 6. Tests Required

- Type-check `apps/web`.
- Start the custom server and verify `ws://localhost:<port>/_next/webpack-hmr` opens in dev.
- Verify `/ws/device` is still registered for the device gateway.

### 7. Wrong vs Correct

#### Wrong

```ts
new WebSocketServer({ server, path: '/ws/device' })
```

#### Correct

```ts
const wss = new WebSocketServer({ noServer: true })
server.on('upgrade', (req, socket, head) => {
  const pathname = new URL(req.url ?? '/', 'http://localhost').pathname
  if (pathname !== '/ws/device') return
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req)
  })
})
```

## Scenario: Session Lifecycle API

### 1. Scope / Trigger

- Trigger: Web workspace sessions support active listing, archived listing, restore, and hard delete.
- Applies to `apps/web/app/api/sessions/route.ts`, `apps/web/app/api/sessions/[id]/route.ts`, and frontend callers that mutate session lifecycle state.

### 2. Signatures

- `GET /api/sessions?workspace_id=<uuid>&status=active|archived|all`
- `PATCH /api/sessions/[id]` with `{ "status": "active" | "archived" }`
- `DELETE /api/sessions/[id]`

### 3. Contracts

- `workspace_id` is required for session lists.
- `status` defaults to `active`; archived sessions must not appear in the default list.
- `status=archived` returns only archived sessions; `status=all` returns active and archived sessions.
- `PATCH status=archived` is a soft archive; `PATCH status=active` restores.
- `DELETE` is a hard delete of an owned session. Related rows follow the database FK contract in `docker/postgres/acceptance-schema.sql`: messages, plans, mailbox items, actions, and runtime sessions cascade; artifacts keep the artifact row and clear `session_id`.
- Every read or mutation must verify session workspace ownership through the workspace owner, not only by session id.

### 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| Missing auth | `401 { error: "未授权" }` |
| Missing `workspace_id` in list | `400 { error: "缺少 workspace_id" }` |
| Invalid list or patch status | `400 { error: "无效的会话状态" }` |
| Workspace not owned for list/create | `403` with a Chinese ownership error |
| Session missing for GET/PATCH/DELETE | `404 { error: "会话不存在" }` |
| Session workspace not owned | `403 { error: "无权限" }` |
| Database mutation error | `500 { error: <db message> }` |

### 5. Good/Base/Bad Cases

- Good: default workspace load calls `GET /api/sessions?workspace_id=<id>&status=active`, so archived sessions stay hidden until the user opens the archive view.
- Base: archived view calls `status=archived`, restore calls `PATCH status=active`, and the restored session disappears from the archive list.
- Bad: deleting a session without ownership lookup; listing all sessions by default; creating fake sessions in the archived list when it is empty.

### 6. Tests Required

- API unit tests for default active filtering, archived filtering, invalid status, delete auth, delete missing session, delete ownership, and successful delete.
- Store/component tests for archive, restore/delete list removal, active-session reselection, and rollback on failed mutation.
- Run `pnpm --filter @agenthub/web test -- __tests__/api/sessions.test.ts __tests__/session-store.test.ts`.
- Run `pnpm --filter @agenthub/web type-check`.
- Run `pnpm --filter @agenthub/web lint`.

### 7. Wrong vs Correct

#### Wrong

```ts
await db.from('sessions').delete().eq('id', id)
```

#### Correct

```ts
const { data: session } = await db.from('sessions').select('workspace_id').eq('id', id).single()
if (!session) return NextResponse.json({ error: '会话不存在' }, { status: 404 })

const { data: ws } = await db
  .from('workspaces')
  .select('id')
  .eq('id', session.workspace_id)
  .eq('owner_id', user.id)
  .single()
if (!ws) return NextResponse.json({ error: '无权限' }, { status: 403 })

await db.from('sessions').delete().eq('id', id)
```
