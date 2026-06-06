# Role Process Message Foregrounding Report

Date: 2026-06-06

Task: `.trellis/tasks/06-06-role-process-message-foregrounding`

## Result

✅ verified / pending final commit.

The central IM transcript now receives foregrounded role process messages from the same durable message rows used for refresh readback. `/api/chat` emits `role_process_message` SSE frames when it persists Orchestrator, backend engineer, frontend engineer, permission waiting, auto-continuation, terminal, failure, and artifact recommendation process events.

## Changes

- `/api/chat` now returns each persisted process event as a `role_process_message` SSE frame with message id, session id, role id, message type, created time, `visibleStatus`, plan/node references, and optional `runtimeParts`.
- Permission waiting is persisted and streamed under the role that triggered the tool request, so the approval card is not a generic background artifact.
- The Web session store renders `role_process_message` immediately and suppresses duplicate `approval_requested` cards for the same `actionId`.
- Chat messages now expose role process rows through `data-testid="role-process-message"` and show a visible status badge.
- The strict single-prompt gate now fails if central IM lacks backend/frontend role-owned process messages.

## Validation

```bash
pnpm --filter @agenthub/web test -- __tests__/api/chat.test.ts __tests__/session-store.test.ts
```

Result: PASS, 2 files / 26 tests.

```bash
pnpm --filter @agenthub/web test -- __tests__/api/chat.test.ts __tests__/api/messages.test.ts __tests__/api/session-timeline.test.ts __tests__/message-markdown.test.ts __tests__/session-store.test.ts
```

Result: PASS, 5 files / 68 tests.

```bash
pnpm --filter @agenthub/web type-check
pnpm --filter @agenthub/web lint
python3 ./.trellis/scripts/task.py validate .trellis/tasks/06-06-role-process-message-foregrounding
git diff --check
```

Result: PASS. `next lint` only printed existing deprecation/config notices; no ESLint warnings or errors.

## Surface Status

| Surface | Status | Evidence |
| --- | --- | --- |
| Web | PASS via focused tests and type/lint | Store and chat API tests cover live SSE rendering plus refresh-compatible message shape. |
| Mobile/PWA | PASS by same `/api/messages` readback contract | Mobile session page renders persisted messages and `metadata.runtimeParts`; no separate UI code path is required for process rows. |
| Desktop/Electron | Not directly changed | This task modifies Web API/store/message rendering; Desktop fallback remains governed by the strict product gate. |

## Residual Risk

No code blocker remains for this task. A fresh full strict product gate should be rerun before claiming a new Bytedance product-pass run that includes this stricter central IM assertion.
