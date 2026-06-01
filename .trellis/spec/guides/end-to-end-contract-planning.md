# End-to-End Contract Planning Guide

> Purpose: prevent plans from passing with fake product closure. Use this before planning or reviewing any AgentHub task that touches auth, workspace, session, message, runtime, database, E2E, or cross-surface UX.

---

## Core Rule

An AgentHub P0/MVP plan is valid only when each task proves user-visible behavior through the real contract path.

Plans must not replace product behavior with placeholder code, file-existence checks, test listing, mocked APIs, or unstated browser/session assumptions.

For local conversation, remote conversation, `@role`, attachment, and artifact closure, the executable contract is `.trellis/spec/cross-layer/real-flow-acceptance.md`. If a plan cannot satisfy that spec, it must say "deferred" or "not accepted" instead of "passed".

Before broad acceptance or "what is still missing" reviews, run a PRD backtrace using `.trellis/spec/cross-layer/prd-backtrace-audit.md`. The review must find both missing P0 behavior and stale/ghost UI or tests that should be deleted or explicitly downgraded.

---

## Plan Anti-Patterns

Reject or revise a plan if any task uses these as completion evidence:

- `playwright test --list` as proof that E2E passed.
- File existence, grep-only checks, or "contains string" checks as the main definition of done.
- `page.route`, `vi.mock`, fixture-only tests, or mock auth as proof that the real database/API/session path works.
- Placeholder runtime responses that look like successful Agent output.
- In-memory stores or hardcoded sample data for Workspace, Session, Message, User, Account, Runtime, or Permission main flows.
- Electron renderer polling Web auth session after OAuth in an external browser without an explicit token, device binding, deep link payload, or main-process bridge that transfers identity.
- "TODO later" for auth, DB, permission, persistence, or runtime routing inside a P0 main path.
- Reports that say "completed" while verification data says `passed: false`, `NO-GO`, `DONE_WITH_CONCERNS`, or equivalent.
- Reports that merge skipped external-login, missing worker, missing Desktop app path, or mock-route tests into the passed count for a P0 main chain.

---

## Required Plan Review

Before a plan may execute, review every task against this checklist:

- [ ] The task DoD describes an observable behavior, not just a changed file.
- [ ] Validation commands are real commands that must run, not only test discovery or static existence checks.
- [ ] If the task claims DB behavior, it names the table/API path and how persistence is verified after refresh or reread.
- [ ] If the task uses auth fixtures, it still verifies real authorization boundaries and real database rows.
- [ ] If the task touches Desktop auth, it explains the identity transfer mechanism explicitly: device binding token/code, deep link with one-time token, or main-process mediated session exchange.
- [ ] If the task touches runtime/agent behavior, it distinguishes unavailable runtime errors from successful responses and never emits fake Agent success.
- [ ] If the task claims local/remote conversation, `@role`, attachment, or artifact closure, it names the exact Web/API/runtime/Desktop path, persistence rows, refresh assertion, and artifact/contentRef evidence.
- [ ] If a minimal adapter is used, UI/API labels it honestly as a minimal/local test adapter and the plan states what real contract it proves.
- [ ] Each wave has a behavior-level verification artifact in `research/execution-reports/`.
- [ ] Product runtime mock removal is verified separately from test fixture use.

---

## Acceptable Test Fixtures

Fixtures are allowed only when they do not replace the product contract being tested.

Allowed:

- Auth fixture that creates a stable test user while still writing and reading real database rows.
- Seed data created through migrations or setup scripts and then verified through real APIs.
- Runtime parser fixture for CLI output parsing, when the task is specifically parser logic.
- Network interception for component-level tests, clearly labeled as not P0 main-chain evidence.

Not allowed as P0 main-chain evidence:

- Mocking `/api/workspaces`, `/api/sessions`, or `/api/messages` to prove Workspace/Session/Message closure.
- Returning hardcoded assistant messages from `/api/chat` and calling it Agent integration.
- Testing a Desktop login button popup without proving identity is transferred to Desktop state.
- Using a mocked route to prove Mobile protected data is authenticated.

---

## Runtime Minimum Viable Closure

A P0 minimal runtime can be small, but it must be honest and testable:

- `cloud` execution may use a hosted minimal adapter only if it is explicitly named as such, writes real message state, and does not pretend to be Claude/Codex/OpenCode.
- `local_desktop` execution must route through DeviceChannel or return a clear `DEVICE_OFFLINE` / equivalent error. It must not silently produce fake success.
- Runtime unavailable, unauthenticated, or execution-domain mismatch states must be visible as errors or blocked states, not as successful chat replies.

---

## Desktop Identity Boundary

External browser OAuth does not automatically authenticate the Electron renderer.

Plans must specify one of:

- Web creates a one-time Desktop device binding token/code; Desktop exchanges it with the backend for device identity.
- Web redirects to a custom protocol/deep link carrying a short-lived token; Desktop validates it through the backend.
- Electron main process owns a supported auth/session bridge and documents cookie/session boundaries.

Plans must not assume `fetch('/api/auth/session', { credentials: 'include' })` from the renderer can read cookies stored in an external browser.
