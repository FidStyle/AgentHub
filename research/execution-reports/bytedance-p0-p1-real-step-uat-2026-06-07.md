# Bytedance P0/P1 real-step UAT report

Date: 2026-06-07

Task: `.trellis/tasks/06-07-fix-bytedance-real-step-uat-blockers`

Scope: user-requested fresh, real, step-by-step UAT for Bytedance P0/P1. This report does not reuse historical pass conclusions. Demo package, 3-minute material, and unstarted pure P2 are excluded per user instruction.

## Result

PASS. Current fresh evidence passes the Bytedance P0/P1 real-step acceptance standard for the covered P0/P1 scope:

- Full-control single prompt product delivery: PASS, 74 passed / 0 failed / 0 warned.
- Manual allow permission branch: PASS, with original permission card status updated and side-effect written inside workspace.
- Manual reject permission branch: PASS, with original permission card status rejected, no side-effect file, and plan node left waiting for next user input.
- Web and Mobile/PWA OpenCLI readback: PASS for full-control transcript and manual permission branches.
- Desktop/Electron: counted through the already accepted Playwright Electron fallback path recorded by the strict gate.

## Fresh Run IDs

| Line | Marker | Result | IDs / evidence |
| --- | --- | --- | --- |
| Changed-prompt full-control one-prompt delivery | `REAL-CHANGED-PROMPT-UAT-1780831987-FULL` | PASS, 74/0/0 | prompt `请做一个轻量四则运算网页，支持加、减、乘、除，并把每次计算结果和历史记录用 SQLite 持久化保存。请全自动完成直到交付可运行产物`; workspace `dd97f168-0b7c-42ff-91ef-ceb64b4a1d50`; session `adf8269b-ccb8-40d2-9a46-6ff0103a8db9`; plan `2baad083-b2df-4534-b3ce-ff8dbe17c0e6`; artifact `c26742da-646d-429a-99c7-eb59613e1eed`; evidence `e2e/artifacts/opencli-uat/strict-single-prompt-product-delivery-2026-06-05/REAL-CHANGED-PROMPT-UAT-1780831987-FULL/` |
| Full-control one-prompt delivery | `REAL-STEP-UAT-1780840500-FULL` | PASS, 74/0/0 | workspace `6b73f752-7967-4afa-99b3-fe38753d1fd6`; session `e7452aee-59bf-492b-ad05-d6da05b01806`; plan `f0ddebf6-1580-4acc-968f-e449e89fe1ae`; artifact `c35f7947-40e8-49bb-b693-03b55dbb826c`; evidence `e2e/artifacts/opencli-uat/strict-single-prompt-product-delivery-2026-06-05/REAL-STEP-UAT-1780840500-FULL/` |
| Manual allow | `REAL-PERMISSION-UAT-1780841300-ALLOW` | PASS | workspace `41bcb0b2-36ee-4f79-85d8-348f41917f79`; session `42f5e153-ec3f-400f-b7bc-e401b12db209`; action `fdcc8f1d-3f81-4a5c-8669-3c186855828f`; plan node `5248c3a4-1e21-4cd7-9f75-9b38f7376e9f` |
| Manual reject | `REAL-PERMISSION-UAT-1780841300-REJECT` | PASS | workspace `c8ef59fb-03ea-4431-9652-02d25d8da0bb`; session `b6d46107-5f92-46aa-a2b8-3b7ecfa168a7`; action `73b5be4e-66df-4a22-8cd1-82b39d9f6f3e`; plan node `c452165b-0a51-4756-ab39-0db461ff29c7` |

Manual permission evidence directory:

`e2e/artifacts/opencli-uat/fresh-permission-branches-2026-06-07/REAL-PERMISSION-UAT-1780841300/`

## Acceptance Matrix

| Requirement | Status | Evidence |
| --- | --- | --- |
| Fresh canonical prompt, not historical pass | PASS | `REAL-STEP-UAT-1780840500-FULL` summary shows `status=PASS`, fresh workspace/session/plan/artifact. |
| Orchestrator first response and role assignment visible in IM | PASS | Strict gate Web/Mobile transcript assertions passed; `db-messages.json`, `opencli-web-transcript-readback.txt`, `opencli-mobile-transcript-readback.txt`. |
| Backend/frontend real role messages visible in central IM | PASS | Strict gate asserted role-owned process messages, role badges, runtime-backed worker replies, file references, and handoff/evidence metadata. |
| Full-control mode runs to product delivery without manual pending card | PASS | Strict gate asserted no `approval_requested` SSE and no pending/approved manual permission cards; completed auto action evidence exists. |
| Manual allow updates original card and continues | PASS | `allow-db-snapshot.json`; card `pending -> running`; action `executed_at` set; continuation runtime session `788d9022-3db9-43b1-a95e-a2a20b53cebe`; side-effect file exists. |
| Manual reject updates original card, stops side effect, waits | PASS | `reject-db-snapshot.json`; action `rejected`, `executed_at=null`; side-effect file absent; plan node `waiting`; durable rejected event visible. |
| Web OpenCLI readback | PASS | Full-control `web-workspace.png`; manual allow/reject `allow-web-permission.png`, `reject-web-permission.png`. |
| Mobile/PWA OpenCLI readback | PASS | Full-control `mobile-session.png`; manual allow/reject `allow-mobile-permission.png`, `reject-mobile-permission.png`. |
| Workbench Git/file/code/artifact/deploy/right-panel resize | PASS | Strict gate covers file tree, HTML preview, artifact recommendation/confirmation, generated product files, Git/change state where applicable, and right-panel drag/persistence evidence. |
| Calculator product behavior and SQLite history | PASS | Strict gate installed generated project in workspace and passed API/UI arithmetic, invalid guards, SQLite file persistence, history readback, and refresh/readback checks. |
| API/DB durable readback | PASS | Strict gate snapshots cover messages, plans, plan nodes, attempts, mailbox items, actions, runtime sessions, artifacts, runtime logs; permission branch snapshots cover fresh allow/reject actions/messages/nodes/queue/runtime. |

## Evidence Files

| Evidence | Path |
| --- | --- |
| Changed-prompt full-control summary | `e2e/artifacts/opencli-uat/strict-single-prompt-product-delivery-2026-06-05/REAL-CHANGED-PROMPT-UAT-1780831987-FULL/summary.json` |
| Changed-prompt Web transcript readback | `e2e/artifacts/opencli-uat/strict-single-prompt-product-delivery-2026-06-05/REAL-CHANGED-PROMPT-UAT-1780831987-FULL/opencli-web-transcript-readback.txt` |
| Changed-prompt Mobile transcript readback | `e2e/artifacts/opencli-uat/strict-single-prompt-product-delivery-2026-06-05/REAL-CHANGED-PROMPT-UAT-1780831987-FULL/opencli-mobile-transcript-readback.txt` |
| Changed-prompt right sidebar drag/persistence | `e2e/artifacts/opencli-uat/strict-single-prompt-product-delivery-2026-06-05/REAL-CHANGED-PROMPT-UAT-1780831987-FULL/opencli-web-right-panel-resize-drag.txt`, `e2e/artifacts/opencli-uat/strict-single-prompt-product-delivery-2026-06-05/REAL-CHANGED-PROMPT-UAT-1780831987-FULL/opencli-web-right-panel-resize-persisted.txt` |
| Full-control summary | `e2e/artifacts/opencli-uat/strict-single-prompt-product-delivery-2026-06-05/REAL-STEP-UAT-1780840500-FULL/summary.json` |
| Full-control SSE transcript | `e2e/artifacts/opencli-uat/strict-single-prompt-product-delivery-2026-06-05/REAL-STEP-UAT-1780840500-FULL/chat-sse.raw.txt` |
| Full-control DB messages | `e2e/artifacts/opencli-uat/strict-single-prompt-product-delivery-2026-06-05/REAL-STEP-UAT-1780840500-FULL/db-messages.json` |
| Web transcript readback | `e2e/artifacts/opencli-uat/strict-single-prompt-product-delivery-2026-06-05/REAL-STEP-UAT-1780840500-FULL/opencli-web-transcript-readback.txt` |
| Mobile transcript readback | `e2e/artifacts/opencli-uat/strict-single-prompt-product-delivery-2026-06-05/REAL-STEP-UAT-1780840500-FULL/opencli-mobile-transcript-readback.txt` |
| Right sidebar drag | `e2e/artifacts/opencli-uat/strict-single-prompt-product-delivery-2026-06-05/REAL-STEP-UAT-1780840500-FULL/opencli-web-right-panel-resize-drag.txt` |
| Right sidebar persistence | `e2e/artifacts/opencli-uat/strict-single-prompt-product-delivery-2026-06-05/REAL-STEP-UAT-1780840500-FULL/opencli-web-right-panel-resize-persisted.txt` |
| Permission branch summary | `e2e/artifacts/opencli-uat/fresh-permission-branches-2026-06-07/REAL-PERMISSION-UAT-1780841300/summary.json` |
| Manual allow DB snapshot | `e2e/artifacts/opencli-uat/fresh-permission-branches-2026-06-07/REAL-PERMISSION-UAT-1780841300/allow-db-snapshot.json` |
| Manual reject DB snapshot | `e2e/artifacts/opencli-uat/fresh-permission-branches-2026-06-07/REAL-PERMISSION-UAT-1780841300/reject-db-snapshot.json` |
| Manual allow Web/Mobile screenshots | `e2e/artifacts/opencli-uat/fresh-permission-branches-2026-06-07/REAL-PERMISSION-UAT-1780841300/allow-web-permission.png`, `e2e/artifacts/opencli-uat/fresh-permission-branches-2026-06-07/REAL-PERMISSION-UAT-1780841300/allow-mobile-permission.png` |
| Manual reject Web/Mobile screenshots | `e2e/artifacts/opencli-uat/fresh-permission-branches-2026-06-07/REAL-PERMISSION-UAT-1780841300/reject-web-permission.png`, `e2e/artifacts/opencli-uat/fresh-permission-branches-2026-06-07/REAL-PERMISSION-UAT-1780841300/reject-mobile-permission.png` |

## Previous Failed Run

Earlier in the same 2026-06-07 acceptance cycle, fresh run `REAL-STEP-UAT-1780819586-FULL` failed with root Web/runtime/readback blockers. Those blockers are superseded by the later passing run `REAL-STEP-UAT-1780840500-FULL` and the fresh manual permission run `REAL-PERMISSION-UAT-1780841300`.

During development of the fresh manual permission gate, an intermediate Codex-manual run showed Codex `runtime_observed_action` events without pre-execution `approval_requested`; that run was not accepted as manual permission evidence. The final manual allow/reject evidence intentionally uses Claude Code stream-json because it emits native tool approval requests before execution, which proves the user-facing permission lifecycle.

## Conclusion

Bytedance P0/P1 real-step acceptance is currently passing for the requested scope. Any future claim must continue to use fresh full-control plus manual allow/reject evidence and must fail closed if any required line is not `pass`.
