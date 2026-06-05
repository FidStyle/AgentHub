# Workbench Strict Product Line Report

Date: 2026-06-06

Task: `.trellis/tasks/06-06-workbench-strict-product-line`

TASK-ID: `WORKBENCH-STRICT-PRODUCT-LINE-2026-06-06`

Contract: `research/contracts/WORKBENCH-STRICT-PRODUCT-LINE-2026-06-06.md`

Regression updated: `REG-20260606-002`, `REG-20260606-003`

## Result

PARTIAL for the scoped API/frontend process-readback fix.

This task fixes the strict workbench gap identified from the user-visible deploy sample: a session must not collapse into only deploy approval cards plus a final "published" message. The same session now has a durable process read model and Web surfaces for both full process and deployment-only readback.

After the latest user review, this report also records a remaining P0 gap: timeline/readback evidence is not enough. The acceptance path must be IM-first: Orchestrator allocation, role replies/handoffs, Orchestrator validation, and artifact recommendation must appear in the central IM transcript and be backed by real role runtime/session state. This report does not claim that full IM-first fresh chain has passed.

## Implementation Summary

| Area | Change |
| --- | --- |
| Message readback | `GET /api/messages?session_id=...` no longer filters `message_type='role_acknowledgement'`. |
| Session timeline API | Added `GET /api/sessions/:id/timeline` with auth + workspace owner check. |
| Timeline aggregation | The API aggregates real `messages`, `plans`, `plan_nodes`, `plan_node_attempts`, `agent_mailbox_items`, `runtime_sessions`, `actions`, and `artifacts` for the same session. |
| Runtime evidence | Runtime sessions are read by `runtime_sessions.session_id` and also by attempt-linked `runtime_session_id`, deduped by id. |
| Deployment evidence | Deploy actions and deployment artifacts expose `actionId`, `previewPath`, `manifestPath`, and `artifactId` refs. |
| Web workbench | `ArtifactPanel` tabs now include `过程` and `部署`; `部署` filters deployment items from the same timeline. |
| Right panel resize | `WorkspaceShell` already exposes `artifact-resize-handle`, pointer drag min/max width, and `agenthub:right-panel-width` persistence; added contract coverage. |
| Specs | Updated `.trellis/spec/frontend/component-guidelines.md`, `.trellis/spec/frontend/quality-guidelines.md`, and `.trellis/spec/cross-layer/real-flow-acceptance.md` with timeline + IM-first role transaction contracts. |

## Break Loop Analysis

| Dimension | Finding |
| --- | --- |
| Root cause | B Cross-Layer Contract + D Test Coverage Gap + E Implicit Assumption. The previous acceptance model treated durable timeline aggregation/right-panel readback as enough, but the Bytedance product requirement is an IM collaboration loop first. |
| Why the earlier fix was insufficient | It fixed `/api/messages` filtering and added `/api/sessions/:id/timeline`, but did not force the central transcript to prove Orchestrator allocation, role replies, handoff/reply semantics, validation, and artifact recommendation. |
| Prevention | `.trellis/spec/cross-layer/real-flow-acceptance.md` now has `IM-First Orchestrator Role Transaction Loop`; frontend specs now require transcript assertions and right panel resize tests; regression ledger has a separate open item for fresh IM-first UAT. |
| Correct completion rule | Timeline-only proof is `partial`. Completion requires `/api/messages` transcript evidence plus matching plan/runtime/timeline evidence and Web/Mobile/Desktop readback. |

## Automated Evidence

```bash
pnpm --filter @agenthub/web test -- __tests__/api/messages.test.ts __tests__/api/session-timeline.test.ts __tests__/message-markdown.test.ts
```

Result: PASS, 3 files / 40 tests.

Assertions covered:

- `/api/messages` returns `role_acknowledgement` rows.
- `/api/sessions/:id/timeline` enforces workspace owner check.
- Timeline includes message, plan, plan node, attempt, mailbox, direct runtime session, deployment action, deployment artifact, and ordinary artifact items.
- Deployment refs include `actionId`, `artifactId`, `previewPath`, and `manifestPath`.
- Frontend source contract includes `角色 / 过程 / 编排 / 文件 / Git / 产物 / 部署`, process/deployment timeline surfaces, Git progressive disclosure, artifact launch controls, and right-panel resize persistence.
- Source contract now also asserts `/api/chat` persists Orchestrator allocation/process messages, role runtime replies, handoff metadata, validation, and artifact recommendation into IM-visible `messages`.

```bash
pnpm --filter @agenthub/web type-check
```

Result: PASS.

```bash
pnpm --filter @agenthub/web lint
```

Result: PASS. Existing Next lint deprecation/config warnings only; no ESLint warnings or errors.

```bash
python3 ./.trellis/scripts/task.py validate .trellis/tasks/06-06-workbench-strict-product-line
git diff --check
```

Result: PASS.

## OpenCLI Status

```bash
opencli doctor
```

Result: PASS. Daemon and browser extension are connected.

```bash
opencli browser agenthub state
```

Supplemental historical Web readback evidence was captured for workspace `58a63e3f-5ca7-457b-af02-2824d02ab9fa`, session `bbea8366-1e19-4ccc-9eb7-2a5d2fde6dbe`:

- API path: `/api/sessions/bbea8366-1e19-4ccc-9eb7-2a5d2fde6dbe/timeline`
- Timeline kinds observed: `message`, `plan`, `plan_node`, `attempt`, `mailbox`, `runtime`, `action`, `deployment`, `artifact`
- Web `过程` screenshot: `e2e/artifacts/opencli-uat/workbench-strict-product-line-2026-06-06/web-process-timeline.png`
- Web `部署` screenshot: `e2e/artifacts/opencli-uat/workbench-strict-product-line-2026-06-06/web-deployment-timeline.png`

This evidence is historical same-session readback only. It is not a fresh IM-first strict run.

No Web/Mobile/Desktop fresh UAT pass is claimed in this report. A later full acceptance run must start from the real workspace/chat entry, send the fixed prompt once, and verify:

- Central IM transcript shows Orchestrator allocation, assigned role replies/handoffs, Orchestrator validation, and artifact recommendation/confirmation.
- Web `过程` tab shows same-session message/plan/node/attempt/mailbox/runtime/action/artifact records.
- Web `部署` tab shows only deployment action/manifest/artifact refs.
- Web desktop right sidebar can be dragged wider/narrower and persists width after reload.
- Mobile/PWA reads the same session status and deployment/action refs.
- Desktop/Electron supervision/readback agrees, or is marked blocked/not-run with evidence.

## Residual Risk

The code path now has focused API, frontend contract, and type-check coverage. The remaining risk is the core product loop: this task did not rerun the full fixed calculator prompt from a fresh session across Web, Mobile/PWA, and Desktop/Electron, and it did not prove the central IM transcript contains the full Orchestrator -> role -> Orchestrator -> artifact recommendation loop. Future claims that "one sentence runs to final delivery" must use the strict IM-first product-delivery gate plus timeline/workbench readback checks.
