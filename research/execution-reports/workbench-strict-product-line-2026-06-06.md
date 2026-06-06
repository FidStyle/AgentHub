# Workbench Strict Product Line Report

Date: 2026-06-06

Task: `.trellis/tasks/06-06-workbench-strict-product-line`

TASK-ID: `WORKBENCH-STRICT-PRODUCT-LINE-2026-06-06`

Contract: `research/contracts/WORKBENCH-STRICT-PRODUCT-LINE-2026-06-06.md`

Regression updated: `REG-20260606-002`, `REG-20260606-003`

## Result

✅ completed / fresh strict pass.

The latest strict run starts from a fresh workspace/session, sends the fixed calculator prompt once through real `POST /api/chat` with `permissionMode=full_control`, and passes the IM-first Orchestrator role transaction loop, generated product checks, SQLite history persistence, artifact recommendation/confirmation, Web/Mobile readback, OpenCLI browser screenshots, real Web right-sidebar drag/persistence, and Desktop/Electron fallback evidence.

## Fresh Strict Evidence

| Item | Value |
| --- | --- |
| Run marker | `STRICT-IMRESIZE-1780732772` |
| Workspace | `7b2c1304-eda9-45e7-948f-cd8276ae6fe1` |
| Session | `b06980bf-fc93-49b4-8877-cd92e2239104` |
| Plan | `e0739be3-3dbe-42aa-9601-8b967c5b3af8` |
| Final artifact | `e08b63c6-d787-4af8-a413-627b0e81f2af` |
| Workspace root | `/Users/joytion/.agenthub/cloud-workspaces/user/strict-product-strict-imresize-1780732772-7b2c1304` |
| Evidence dir | `e2e/artifacts/opencli-uat/strict-single-prompt-product-delivery-2026-06-05/STRICT-IMRESIZE-1780732772/` |
| API transcript path | `GET /api/messages?session_id=b06980bf-fc93-49b4-8877-cd92e2239104` |
| Timeline path | `GET /api/sessions/b06980bf-fc93-49b4-8877-cd92e2239104/timeline` |
| Web URL | `http://localhost:3000/workspace/7b2c1304-eda9-45e7-948f-cd8276ae6fe1` |
| Mobile/PWA URL | `http://localhost:3000/m/sessions/b06980bf-fc93-49b4-8877-cd92e2239104` |

```bash
REDIS_URL=redis://localhost:6379 STRICT_PRODUCT_RUN_ID=STRICT-IMRESIZE-1780732772 STRICT_PRODUCT_CHAT_TIMEOUT_MS=600000 pnpm --filter @agenthub/web exec tsx scripts/verify-strict-single-prompt-product-delivery.ts
```

Result: PASS, 67 passed / 0 failed / 0 warned.

Key assertions passed:

- `POST /api/chat` SSE ended inside the strict window and included `orchestrator_plan_started`, `role_selected`, and `done`.
- Full-control mode produced no manual `approval_requested` event and no pending/approved manual permission card leftovers.
- Plan status is `completed`; all four plan nodes completed: Orchestrator planning, backend engineer, frontend engineer, Orchestrator summary.
- Runtime sessions persisted for every node and all reached `completed`; completed nodes have no queued/waiting mailbox or attempt leftovers.
- Central IM transcript includes Orchestrator allocation, backend/frontend role replies, handoff or observed file evidence, Orchestrator validation, and artifact recommendation/confirmation result card.
- Orchestrator validation contains no negative completion wording.
- Generated files include `package.json`, `src/server.js`, `public/index.html`, `public/app.js`, `README.md`, and a CSS file.
- Generated project `npm install` passed inside the generated workspace; generated `node --test` passed.
- Generated calculator API passed add/subtract/multiply/divide, divide-by-zero, invalid operator, invalid number, and SQLite-backed history checks.
- SQLite file persistence was verified by scanning generated user tables, excluding `.test-data` fixtures; the passing run found `data/strict-product-gate.sqlite:calculation_history` with 5 rows.
- Workspace file tree and HTML preview API read back the generated files.
- Final artifact row exists for `public/index.html`, metadata includes `artifactRecommendation` and `artifactConfirmation`, and the run did not mark the whole file tree as product.
- Web API read back the same session transcript; Mobile/PWA session page and artifact preview route read back; OpenCLI captured Web and Mobile screenshots; Desktop/Electron fallback evidence was found.
- OpenCLI opened the real Web workspace route and dragged the right sidebar from 360px to 500px; `agenthub:right-panel-width` persisted and reloaded at 500px while chat/composer stayed usable.

## Code And Test Changes

| Area | Change |
| --- | --- |
| `/api/chat` role completion | Completed role replies now append observed durable evidence from `actions` and current workspace files, so downstream handoffs and Orchestrator validation receive real file/action facts instead of only model planning text. |
| Handoff summary | The completed reply with observed evidence is persisted to `plan_nodes.result.summary`, agent messages, and downstream handoff summaries. |
| Strict gate | `verify-strict-single-prompt-product-delivery.ts` now accepts generated API contract variant `{ a, b, operator }`, nested `calculation.result`, and `history` response bodies; it also fails if the IM transcript lacks role replies, handoff/evidence, Orchestrator validation, or artifact result card. |
| Web resize gate | The strict gate now opens `/workspace/:id`, exercises `artifact-resize-handle` through OpenCLI in a real browser, verifies chat area usability, and confirms `agenthub:right-panel-width` survives reload. |
| SQLite gate | The strict gate now scans generated SQLite user tables and excludes `.test-data` fixture databases instead of assuming fixed table names. |
| Evidence audit | `audit-acceptance-evidence.mjs` no longer treats SQLite “history records” wording as stale historical evidence. |
| API unit test | `chat.test.ts` now proves full-auto backend/frontend role messages include `AgentHub 观察到的落地证据` and that Orchestrator handoffs receive generated file paths. |

## Automated Quality Gate

```bash
pnpm --filter @agenthub/web test -- __tests__/api/chat.test.ts __tests__/api/messages.test.ts __tests__/api/session-timeline.test.ts __tests__/message-markdown.test.ts
```

Result: PASS, 4 files / 56 tests.

```bash
node scripts/test-audit-acceptance-evidence.mjs
```

Result: PASS.

```bash
pnpm --filter @agenthub/web type-check
```

Result: PASS.

```bash
pnpm --filter @agenthub/web lint
```

Result: PASS. Existing Next lint deprecation/config notices only; no ESLint warnings or errors.

```bash
python3 ./.trellis/scripts/task.py validate .trellis/tasks/06-06-workbench-strict-product-line
git diff --check
```

Result: PASS.

## Web / Mobile / Desktop Surface Status

| Surface | Status | Evidence |
| --- | --- | --- |
| Web | PASS | `GET /api/messages?session_id=b06980bf-fc93-49b4-8877-cd92e2239104` returned 15 messages; OpenCLI screenshot `web-workspace.png` captured under the fresh evidence directory; right sidebar drag evidence is `opencli-web-right-panel-resize-drag.txt` and reload persistence evidence is `opencli-web-right-panel-resize-persisted.txt`. |
| Mobile/PWA | PASS | `/m/sessions/b06980bf-fc93-49b4-8877-cd92e2239104` and `/m/preview?artifactId=e08b63c6-d787-4af8-a413-627b0e81f2af` returned successfully; OpenCLI screenshot `mobile-session.png` captured. |
| Desktop/Electron | PASS via allowed fallback | AgentHub Electron OpenCLI adapter is unavailable in the current tool list; allowed Playwright Electron fallback evidence exists: `e2e/artifacts/desktop-workspace-page-1200x800.png`, `e2e/artifacts/desktop-settings-page-1200x800.png`. |

Right sidebar resize is now covered by both source contract tests and the fresh OpenCLI browser strict gate: `artifact-resize-handle` changed the rendered panel width from 360px to 500px, persisted `agenthub:right-panel-width=500`, and reloaded at 500px.

## Regression Closure

- `REG-20260606-002` is closed by the fresh same-session `/api/messages`, timeline, Web process/deploy readback, artifact, and three-surface evidence above.
- `REG-20260606-003` is closed by the fresh IM-first transcript checks: Orchestrator allocation, real backend/frontend role replies with handoff/evidence, Orchestrator validation without negative completion wording, and artifact recommendation/confirmation result card.

## Residual Risk

No P0 blocker remains for this task. Electron still uses Playwright fallback because no AgentHub Electron OpenCLI adapter is available; this is recorded as accepted fallback evidence for this gate, not as missing completion.
