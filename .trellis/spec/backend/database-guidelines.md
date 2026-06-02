# Database Guidelines

> Database patterns and conventions for this project.

---

## Overview

<!--
Document your project's database conventions here.

Questions to answer:
- What ORM/query library do you use?
- How are migrations managed?
- What are the naming conventions for tables/columns?
- How do you handle transactions?
-->

(To be filled by the team)

---

## Query Patterns

<!-- How should queries be written? Batch operations? -->

(To be filled by the team)

---

## Migrations

<!-- How to create and run migrations -->

(To be filled by the team)

---

## Naming Conventions

<!-- Table names, column names, index names -->

(To be filled by the team)

---

## Common Mistakes

<!-- Database-related mistakes your team has made -->

(To be filled by the team)

---

## Scenario: Acceptance Auth.js Test Session Seed

### 1. Scope / Trigger

- Trigger: acceptance smoke/E2E needs a real Auth.js database session that can pass `auth()` and exercise real Workspace/Session/Message APIs.
- The seed must never mock API route auth or bypass ownership checks with headers such as `X-Test-User-Id`.

### 2. Signatures

- Command: `pnpm env:acceptance:seed`
- Fixture command: `pnpm env:acceptance:seed:fixture`
- Smoke command: `pnpm env:acceptance:smoke`
- DB tables: `public."user"`, `public.account`, `public.session`.

### 3. Contracts

- `pnpm env:acceptance:seed`:
  - Loads `apps/web/.env.local` when process env does not already define a key.
  - Looks for an existing `account.provider = 'github'` row joined to `public."user"`.
  - Supports optional filters `TEST_GITHUB_ACCOUNT_ID` and `TEST_USER_EMAIL`.
  - Writes `docker/.acceptance.env` with `DATABASE_URL`, `AUTH_TRUST_HOST`, `AUTH_SECRET`, `TEST_USER_ID`, `TEST_USER_EMAIL`, `TEST_GITHUB_ACCOUNT_ID`, `TEST_AUTH_SESSION_TOKEN`, and `TEST_AUTH_COOKIE`.
  - No legacy env fallback: `docker/.acceptance.env` is the only acceptance env file read by scripts and E2E setup.
- `pnpm env:acceptance:seed:fixture`:
  - Sets `ACCEPTANCE_CREATE_GITHUB_FIXTURE=true`.
  - Creates or updates a real DB `user` row and a test `account(provider='github')` row.
  - This simulates GitHub binding for automated tests; it is not proof that real browser OAuth completed.
- `pnpm env:acceptance:smoke`:
  - Uses `TEST_AUTH_COOKIE=authjs.session-token=<token>`.
  - Must call real API routes and verify persistence by rereading DB-backed API results.

### 4. Validation & Error Matrix

- No GitHub-linked user and no fixture flag -> fail with instructions to login, prepare `user + account(provider='github')`, or run fixture seed.
- `TEST_GITHUB_ACCOUNT_ID` set but no matching GitHub account -> fail.
- `TEST_USER_EMAIL` set but user has no GitHub account -> fail.
- Fixture mode missing fixture IDs -> fail before writing session.
- Missing `TEST_AUTH_COOKIE` in smoke -> fail before API calls.

### 5. Good/Base/Bad Cases

- Good: a real OAuth-created Auth.js user exists; `pnpm env:acceptance:seed` only creates a session for that user.
- Base: local empty DB; `pnpm env:acceptance:seed:fixture` creates a DB user plus GitHub account row, then smoke passes.
- Bad: seed creates a user silently in default mode, then reports OAuth-linked coverage.

### 6. Tests Required

- Type-check `apps/web`.
- Build `apps/web`.
- Run `pnpm env:acceptance:seed:fixture`.
- Start the built web server with `docker/.acceptance.env`, then run `pnpm env:acceptance:smoke`.

### 7. Wrong vs Correct

#### Wrong

```bash
pnpm env:acceptance:seed
# silently creates a fake user when no GitHub account exists
```

#### Correct

```bash
pnpm env:acceptance:seed
# strict: uses existing GitHub-linked account or fails

pnpm env:acceptance:seed:fixture
# explicit: creates a real DB fixture user and test GitHub account row
```
