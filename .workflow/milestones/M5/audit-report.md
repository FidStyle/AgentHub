# M5 Integration Audit Report

**Milestone**: M5 (Auth + DB Schema + Workspace API)
**Auditor**: Claude Code
**Date**: 2026-05-23

---

## Summary

| Check | Status |
|---|---|
| Shared interfaces (snake_case) | GAP FOUND |
| Data contracts (API ↔ DB types) | GAP FOUND |
| API error handling consistency | PASS |
| Page → API wiring | GAP FOUND |
| Type consistency (component ↔ API) | GAP FOUND |

**Verdict**: FAIL — 5 gaps found, 2 critical

---

## 1. SHARED INTERFACES: database.types.ts vs. Supabase snake_case

**Status**: GAP FOUND
**Severity**: CRITICAL

The `packages/shared/src/database.types.ts` defines TypeScript interfaces with **snake_case** field names matching the Supabase schema convention (e.g., `execution_domain`, `workspace_id`, `sender_type`, `created_at`). This is correct and consistent with the migration file.

However, there is a **structural mismatch** with the separate `packages/shared/src/domain/message.ts`:

- `database.types.ts` `Message`: `id, session_id, sender_type, sender_id, role_agent_id, content, message_type, streaming_status, metadata, is_pinned, created_at, updated_at`
- `domain/message.ts` `Message`: `id, sessionId, type, content, senderType, senderId, streamingStatus, createdAt`

Two conflicting `Message` interfaces exist in the same shared package:
1. `database.types.ts` — DB-aligned snake_case (used by API routes)
2. `domain/message.ts` — camelCase (used by frontend pages)

The frontend (`apps/web/app/(workspace)/workspace/[id]/page.tsx`) imports `Message` from `domain/message.ts` (camelCase), which is incompatible with data returned by future message API endpoints (which will return snake_case per DB schema).

---

## 2. DATA CONTRACTS: API routes vs. database.types.ts

**Status**: GAP FOUND
**Severity**: HIGH

The API routes (`/api/workspaces`, `/api/sessions`) correctly use `.select('*')` and return raw DB rows, so field names match `database.types.ts` snake_case. No contract mismatch here.

**Double `updated_at` update** in PATCH routes: Both `PATCH /api/workspaces/[id]` and `PATCH /api/sessions/[id]` manually set `updated_at` in the update payload, but the DB schema already includes a `update_updated_at()` trigger that auto-sets this field. This is redundant and the manual value will be overwritten by the trigger anyway (trigger fires on BEFORE UPDATE, so the trigger value wins). Low severity but worth noting.

**Critical gap**: The API routes never actually validate `execution_domain` immutability at the API layer — they rely solely on the DB trigger (`prevent_execution_domain_change`). If the DB trigger is disabled or misconfigured, the API would accept a PATCH that changes execution_domain. No explicit validation in the PATCH route.

---

## 3. API ERROR HANDLING CONSISTENCY

**Status**: PASS
**Severity**: null

All 4 API routes follow a consistent pattern:
- Auth failures → `401` with `{ error: '未授权' }`
- Not found → `404` with localized Chinese message
- Permission denied → `403` with `{ error: '无权限' }`
- Validation failure → `400` with descriptive Chinese message
- DB errors → `500` with `{ error: error.message }`

Consistent across all routes. No issues found.

---

## 4. PAGE → API WIRING

**Status**: GAP FOUND
**Severity**: MEDIUM

### `/workspace/page.tsx` (list page)
- GET `/api/workspaces` — correctly wired
- POST `/api/workspaces` via `CreateWorkspaceDialog` — correctly wired with `execution_domain` field
- **Missing**: No `.ok` check before calling `setWorkspaces(await res.json())`. If the API returns a non-200 (e.g., 401 or 500), the page will try to parse error JSON as an array, causing a runtime error.

### `/workspace/[id]/page.tsx` (chat page)
- GET `/api/sessions?workspace_id={id}` — correctly wired
- POST `/api/sessions` — correctly wired with `workspace_id` and `name`
- **Mock-only**: All chat message handling (send, stream, display) is entirely client-side with hardcoded mock data. No actual message persistence API exists yet. The `handleSend` function creates `Message` objects that are never sent to any API.

### `CreateWorkspaceDialog.tsx`
- POST `/api/workspaces` — correctly wired with `{ name, execution_domain, description }`
- **Missing**: No error feedback when `res.ok` is false. If creation fails, the dialog silently closes without telling the user.

---

## 5. TYPE CONSISTENCY: Component interfaces vs. API response shapes

**Status**: GAP FOUND
**Severity**: CRITICAL

### Critical: `workspace/[id]/page.tsx` Message construction mismatch

The chat page constructs `Message` objects using **camelCase** field names:

```ts
const userMsg: Message = {
  id: genId(),
  sessionId: currentSessionId,   // wrong: should be session_id
  type: 'text',                  // wrong: should be message_type
  content,
  senderType: 'user',            // wrong: should be sender_type
  senderId: 'user-1',            // wrong: should be sender_id
  streamingStatus: 'complete',   // wrong: should be streaming_status
  createdAt: new Date(),         // wrong: should be created_at (string, not Date)
}
```

This `Message` type (from `domain/message.ts`) is structurally incompatible with the DB-aligned `Message` interface in `database.types.ts`. When a real message persistence API is added, all frontend components will need to be refactored to use snake_case field names.

### `createdAt: Date` vs `created_at: string`

The `domain/message.ts` uses `createdAt: Date`, but the DB schema uses `created_at TIMESTAMPTZ` which serializes as an ISO string. Runtime type mismatch — if this Date object were ever serialized to JSON (e.g., for API transmission), it would become an invalid date string.

### `workspace/page.tsx` WorkspaceRow interface

The local `WorkspaceRow` interface uses snake_case field names matching the API response, which is correct:

```ts
interface WorkspaceRow {
  id: string
  name: string
  description: string
  execution_domain: 'cloud' | 'local_desktop'
  created_at: string
}
```

This is consistent with the API and DB schema. However, the interface is locally defined in the page rather than imported from the shared package — no reuse of `database.types.ts` `Workspace`.

---

## Gap Summary

| # | Gap | Severity | File(s) | Fix Required |
|---|---|---|---|---|
| 1 | Two conflicting Message interfaces (domain/message.ts vs database.types.ts) | Critical | `packages/shared/src/domain/message.ts`, `apps/web/app/(workspace)/workspace/[id]/page.tsx` | Unify Message type: remove `domain/message.ts` or align with DB schema |
| 2 | `createdAt: Date` vs `created_at: string` type mismatch | Critical | `packages/shared/src/domain/message.ts`, `apps/web/app/(workspace)/workspace/[id]/page.tsx` | Change `createdAt` to `created_at: string` in domain/message.ts |
| 3 | Frontend camelCase Message vs DB snake_case field names | Critical | `apps/web/app/(workspace)/workspace/[id]/page.tsx` | Align Message construction with database.types.ts field names |
| 4 | No execution_domain immutability check in PATCH route | High | `apps/web/app/api/workspaces/[id]/route.ts` | Add explicit check before DB update |
| 5 | Missing error handling in workspace list page | Medium | `apps/web/app/(workspace)/workspace/page.tsx` | Check `res.ok` before parsing JSON |
| 6 | No error feedback in CreateWorkspaceDialog | Medium | `apps/web/components/workspace/CreateWorkspaceDialog.tsx` | Show error message on failure |
| 7 | Redundant `updated_at` in PATCH update payloads | Low | `apps/web/app/api/workspaces/[id]/route.ts`, `apps/web/app/api/sessions/[id]/route.ts` | Remove manual updated_at; rely on DB trigger |
| 8 | Mock-only message handling (no persistence API) | Low | `apps/web/app/(workspace)/workspace/[id]/page.tsx` | Acceptable for M5 scope; document for M6 |

---

## Recommendations

1. **Immediately**: Unify the `Message` interface — keep only the `database.types.ts` version and update `domain/message.ts` to re-export from there. Update `workspace/[id]/page.tsx` to use snake_case field names.

2. **Before M6**: Add `POST /api/messages` and `GET /api/sessions/[id]/messages` endpoints to persist messages to the DB. These will return data matching `database.types.ts` `Message`.

3. **Next audit**: When adding message API routes, verify that the unified `Message` type is used consistently across frontend and API layers.
