# Workbench Strict Product Line Report

Date: 2026-06-06

Task: `.trellis/tasks/06-06-workbench-strict-product-line`

TASK-ID: `WORKBENCH-STRICT-PRODUCT-LINE-2026-06-06`

Contract: `research/contracts/WORKBENCH-STRICT-PRODUCT-LINE-2026-06-06.md`

Regression updated: `REG-20260606-002`, `REG-20260606-003`

## Result

✅ completed / fresh strict pass.

The latest strict run starts from a fresh workspace/session, sends the fixed calculator prompt once through real `POST /api/chat` with `permissionMode=full_control`, and passes the IM-first Orchestrator role transaction loop, generated product checks, SQLite history persistence, artifact recommendation/confirmation, Web/Mobile readback, OpenCLI browser screenshots, and Desktop/Electron fallback evidence.

## Fresh Strict Evidence

| Item | Value |
| --- | --- |
| Run marker | `STRICT-IMFIRST-1780728733` |
| Workspace | `519d0c8f-c52b-4a2e-bc12-503db2af2690` |
| Session | `512f4209-ced8-4314-b61e-dbff7d55d7fc` |
| Plan | `2e0fdecb-3b66-4f0f-8adf-dfa7e82ad196` |
| Final artifact | `90ec5f1e-7569-480e-a407-7f6b3e6e956b` |
| Workspace root | `/Users/joytion/.agenthub/cloud-workspaces/user/strict-product-strict-imfirst-1780728733-519d0c8f` |
| Evidence dir | `e2e/artifacts/opencli-uat/strict-single-prompt-product-delivery-2026-06-05/STRICT-IMFIRST-1780728733/` |
| API transcript path | `GET /api/messages?session_id=512f4209-ced8-4314-b61e-dbff7d55d7fc` |
| Timeline path | `GET /api/sessions/512f4209-ced8-4314-b61e-dbff7d55d7fc/timeline` |
| Web URL | `http://localhost:3000/workspaces/519d0c8f-c52b-4a2e-bc12-503db2af2690` |
| Mobile/PWA URL | `http://localhost:3000/m/sessions/512f4209-ced8-4314-b61e-dbff7d55d7fc` |

```bash
REDIS_URL=redis://localhost:6379 STRICT_PRODUCT_RUN_ID=STRICT-IMFIRST-1780728733 STRICT_PRODUCT_CHAT_TIMEOUT_MS=600000 pnpm --filter @agenthub/web exec tsx scripts/verify-strict-single-prompt-product-delivery.ts
```

Result: PASS, 64 passed / 0 failed / 0 warned.

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
- Workspace file tree and HTML preview API read back the generated files.
- Final artifact row exists for `public/index.html`, metadata includes `artifactRecommendation` and `artifactConfirmation`, and the run did not mark the whole file tree as product.
- Web API read back the same session transcript; Mobile/PWA session page and artifact preview route read back; OpenCLI captured Web and Mobile screenshots; Desktop/Electron fallback evidence was found.

## Code And Test Changes

| Area | Change |
| --- | --- |
| `/api/chat` role completion | Completed role replies now append observed durable evidence from `actions` and current workspace files, so downstream handoffs and Orchestrator validation receive real file/action facts instead of only model planning text. |
| Handoff summary | The completed reply with observed evidence is persisted to `plan_nodes.result.summary`, agent messages, and downstream handoff summaries. |
| Strict gate | `verify-strict-single-prompt-product-delivery.ts` now accepts generated API contract variant `{ a, b, operator }`, nested `calculation.result`, and `history` response bodies; it also fails if the IM transcript lacks role replies, handoff/evidence, Orchestrator validation, or artifact result card. |
| API unit test | `chat.test.ts` now proves full-auto backend/frontend role messages include `AgentHub 观察到的落地证据` and that Orchestrator handoffs receive generated file paths. |

## Automated Quality Gate

```bash
pnpm --filter @agenthub/web test -- __tests__/api/chat.test.ts __tests__/api/messages.test.ts __tests__/api/session-timeline.test.ts __tests__/message-markdown.test.ts
```

Result: PASS, 4 files / 55 tests.

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
| Web | PASS | `GET /api/messages?session_id=512f4209-ced8-4314-b61e-dbff7d55d7fc` returned 15 messages; OpenCLI screenshot `web-workspace.png` captured under the fresh evidence directory. |
| Mobile/PWA | PASS | `/m/sessions/512f4209-ced8-4314-b61e-dbff7d55d7fc` and `/m/preview?artifactId=90ec5f1e-7569-480e-a407-7f6b3e6e956b` returned successfully; OpenCLI screenshot `mobile-session.png` captured. |
| Desktop/Electron | PASS via allowed fallback | AgentHub Electron OpenCLI adapter is unavailable in the current tool list; allowed Playwright Electron fallback evidence exists: `e2e/artifacts/desktop-workspace-page-1200x800.png`, `e2e/artifacts/desktop-settings-page-1200x800.png`. |

Right sidebar resize is covered by frontend source contract tests in `__tests__/message-markdown.test.ts`: `artifact-resize-handle`, `agenthub:right-panel-width` read/write persistence, and the quality spec requirement remain enforced.

## Regression Closure

- `REG-20260606-002` is closed by the fresh same-session `/api/messages`, timeline, Web process/deploy readback, artifact, and three-surface evidence above.
- `REG-20260606-003` is closed by the fresh IM-first transcript checks: Orchestrator allocation, real backend/frontend role replies with handoff/evidence, Orchestrator validation without negative completion wording, and artifact recommendation/confirmation result card.

## Residual Risk

No P0 blocker remains for this task. Electron still uses Playwright fallback because no AgentHub Electron OpenCLI adapter is available; this is recorded as accepted fallback evidence for this gate, not as missing completion.
