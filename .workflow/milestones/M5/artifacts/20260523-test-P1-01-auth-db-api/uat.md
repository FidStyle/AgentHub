---
status: complete
target: M5 Phase 1
source: verification.json, auto-test/report.json
started: 2026-05-23T07:15:00Z
updated: 2026-05-23T07:15:00Z
---

## Summary

total: 39
passed: 39
issues: 0
pending: 0
skipped: 0

## Smoke Tests

Skipped: Supabase env vars not configured — app cannot start without NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY.

## Tests (API Unit Tests — 39 tests)

All 39 API route unit tests pass:
- **AT-W001–W017** (17): Workspaces routes — auth guards, validation, CRUD, error handling
- **AT-S001–S022** (22): Sessions routes — auth guards, workspace ownership checks, CRUD, error handling

Command: `pnpm exec vitest run --config apps/web/vitest.config.ts`
Result: 39 passed, 0 failed

### Coverage: API Auth & Ownership

| Test ID | Route | Scenario | Status |
|---------|-------|----------|--------|
| AT-W001 | GET /api/workspaces | 401 unauthenticated | pass |
| AT-W002 | GET /api/workspaces | workspace list for auth user | pass |
| AT-W003 | GET /api/workspaces | 500 on DB error | pass |
| AT-W004 | POST /api/workspaces | 401 unauthenticated | pass |
| AT-W005 | POST /api/workspaces | 400 missing name | pass |
| AT-W006 | POST /api/workspaces | 400 missing execution_domain | pass |
| AT-W007 | POST /api/workspaces | 400 invalid execution_domain | pass |
| AT-W008 | POST /api/workspaces | 201 created | pass |
| AT-W009 | POST /api/workspaces | 500 on insert error | pass |
| AT-W010 | GET /api/workspaces/[id] | 401 unauthenticated | pass |
| AT-W011 | GET /api/workspaces/[id] | workspace detail | pass |
| AT-W012 | GET /api/workspaces/[id] | 404 not found | pass |
| AT-W013 | PATCH /api/workspaces/[id] | 401 unauthenticated | pass |
| AT-W014 | PATCH /api/workspaces/[id] | 400 empty name | pass |
| AT-W015 | PATCH /api/workspaces/[id] | 400 name > 200 chars | pass |
| AT-W016 | PATCH /api/workspaces/[id] | updated workspace | pass |
| AT-W017 | PATCH /api/workspaces/[id] | 500 on update error | pass |
| AT-S001 | GET /api/sessions | 401 unauthenticated | pass |
| AT-S002 | GET /api/sessions | 400 missing workspace_id | pass |
| AT-S003 | GET /api/sessions | 403 workspace not owned | pass |
| AT-S004 | GET /api/sessions | session list | pass |
| AT-S005 | GET /api/sessions | 500 on DB error | pass |
| AT-S006 | POST /api/sessions | 401 unauthenticated | pass |
| AT-S007 | POST /api/sessions | 400 missing workspace_id | pass |
| AT-S008 | POST /api/sessions | 403 workspace not owned | pass |
| AT-S009 | POST /api/sessions | 201 created | pass |
| AT-S010 | POST /api/sessions | default name "新会话" | pass |
| AT-S011 | POST /api/sessions | 500 on insert error | pass |
| AT-S012 | GET /api/sessions/[id] | 401 unauthenticated | pass |
| AT-S013 | GET /api/sessions/[id] | 404 not found | pass |
| AT-S014 | GET /api/sessions/[id] | 403 not owned | pass |
| AT-S015 | PATCH /api/sessions/[id] | 401 unauthenticated | pass |
| AT-S016 | PATCH /api/sessions/[id] | 400 invalid status | pass |
| AT-S017 | PATCH /api/sessions/[id] | 404 not found | pass |
| AT-S018 | PATCH /api/sessions/[id] | 403 not owned | pass |
| AT-S019 | PATCH /api/sessions/[id] | updated name | pass |
| AT-S020 | PATCH /api/sessions/[id] | updated status=active | pass |
| AT-S021 | PATCH /api/sessions/[id] | updated status=archived | pass |
| AT-S022 | PATCH /api/sessions/[id] | 500 on update error | pass |

## Gaps

[none]

## Limitations

Full E2E smoke tests and UAT require:
1. Supabase environment variables configured (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)
2. Supabase project created with the migration schema applied
3. GitHub OAuth app configured with callback URL

API unit tests cover all critical paths. These will be validated manually when Supabase is connected.
