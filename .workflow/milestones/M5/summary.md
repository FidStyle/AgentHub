# Milestone: M5 — Auth + DB + API 基础层

**Completed**: 2026-05-23
**Phase**: Phase 1: Auth + DB Schema + Workspace API

---

## Key Outcomes

### Auth + Database Schema
- GitHub OAuth via `@supabase/ssr` with SSR-safe `createClient()`
- Initial DB migration: `profiles`, `workspaces`, `sessions`, `messages`, `role_agents` tables
- Row Level Security (RLS) policies on all tables
- Auto-profile creation via database trigger (`handle_new_user`)
- User ownership enforced at database level via `owner_id` field

### Workspace + Session API
- 4 API routes: `GET/POST /api/workspaces`, `GET/PATCH /api/workspaces/[id]`, `GET/POST /api/sessions`, `GET/PATCH /api/sessions/[id]`
- Consistent error responses (401/403/404/400/500)
- Workspace ownership validation on all endpoints
- Input validation: name length, execution_domain enum, session status enum
- CRUD for workspaces and sessions fully implemented

### UI Pages
- `/workspace` — workspace list + creation dialog, fetches from API
- `/workspace/[id]` — workspace-specific chat interface with session management
- `CreateWorkspaceDialog` — modal form with domain selection and error feedback
- 全中文 UI (login page, workspace page, dialog)

### Test Coverage
- 22 vitest L0 unit tests for API routes (workspaces + sessions)
- 100% pass rate (39/39 tests)
- Supabase client mocked with chain builder pattern
- Auth, validation, ownership, and error scenarios covered

## Security Fixes During Review
- Session PATCH: missing workspace ownership check (CRITICAL)
- Session GET: missing workspace ownership check (MEDIUM)
- Session PATCH: accepted arbitrary status values (MEDIUM)
- Workspace PATCH: allowed empty name (MEDIUM)

## Learnings

| Pattern | Type | Source |
|---------|------|--------|
| Workspace ownership for nested resources | security | auto-test caught it |
| Supabase mock with mutable cell + chain builder | testing | M5 |
| `any` casting for route handler test utilities | types | M5 |
| Auto-tests complement manual review | quality | M5 |

## Deferred Issues (M6+)
- Dual `Message` type (domain/message.ts vs database.types.ts) — M6 will add message API
- `createdAt: Date` vs `created_at: string` — unify when message API added
- No rate limiting on POST endpoints — future hardening
- No execution_domain immutability check in PATCH route — DB trigger fallback

## Next Milestone
**M6: Web IM 工作台核心** — Phase 1: IM 消息流 + Agent + Artifact
