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
