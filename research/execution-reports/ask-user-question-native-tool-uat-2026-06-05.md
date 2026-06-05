# AskUserQuestion Native Tool UAT - 2026-06-05

## Verdict

Status: **accepted for REG-20260605-001**

Claude native `AskUserQuestion` is no longer represented as `shell_command`. The executor emits a structured `question` chunk, the runtime worker publishes a durable `question` runtime event without creating an action/notification, and `/api/chat` persists the question part even when the runtime stops with the explicit waiting state.

The original fixed sample is still not declared complete for the full calculator + SQLite artifact. This task closes the malformed `AskUserQuestion (shell_command)` blocker only; the remaining P0 blocker is Mobile/PWA durable permission detail readback (`REG-20260605-002`).

## Scope

- Workspace id: `e427fab2-5cc3-469f-8828-fbce722fa9ef`
- Workspace root: `/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2`
- Real-user UAT session id: `02ebaf71-fcef-4b5f-bec6-e334bad137db`
- Prompt: `请先使用 Claude Code 原生 AskUserQuestion 工具向用户提问：历史记录保存方式选择 SQLite 还是 LocalStorage？只发起问题，不要直接给出实现方案。`
- Executor: real Claude Code CLI through the acceptance runtime worker
- Browser UAT: OpenCLI profile `agenthub`

## Commands Run

- Focused regression and quality gates:
  - `pnpm --filter @agenthub/web test -- __tests__/runtime/executor.test.ts __tests__/api/chat.test.ts` - PASS, 52 tests.
  - `pnpm --filter @agenthub/web type-check` - PASS.
  - `pnpm --filter @agenthub/web lint` - PASS, no ESLint warnings or errors; existing Next lint deprecation/config warnings only.
  - `pnpm --filter @agenthub/shared type-check` - PASS.
  - `pnpm --filter @agenthub/shared test -- src/domain/runtime-workspace.test.ts` - PASS, 15 tests.
- Desktop/Electron fallback:
  - `pnpm --filter @agenthub/desktop build` - PASS.
  - `npx playwright test --config e2e/playwright.desktop.config.ts e2e/tests/desktop/electron.spec.ts --reporter=line` - PASS, 3/3.

## OpenCLI Evidence

Saved under `e2e/artifacts/opencli-uat/ask-user-question-native-tool-2026-06-05/`:

- `opencli-real-user-question-eval.json`
  - `chatStatus = 200`
  - `hasQuestion = true`
  - `hasApproval = false`
  - `sessionId = 02ebaf71-fcef-4b5f-bec6-e334bad137db`
  - `questionId = tooluse_EEqwBGTYilRNQOUUIw706G`
- `web-real-user-question-card-dom.json`
  - Web workspace URL: `http://localhost:3000/workspace/e427fab2-5cc3-469f-8828-fbce722fa9ef`
  - `questionCards = 1`
  - Message content includes the persisted question and SQLite/LocalStorage choices.
- `web-real-user-question-card-final.png`
  - Web screenshot showing the question card in the real workspace session.
- `mobile-question-card-dom.json`
  - Mobile/PWA URL: `http://localhost:3000/m/sessions/02ebaf71-fcef-4b5f-bec6-e334bad137db`
  - `questionCards = 1`
  - Text includes the persisted question card content.
- `mobile-real-user-question-card.png`
  - Mobile/PWA screenshot showing the question card.

Earlier exploratory screenshots `web-question-card.png` and `mobile-question-card.png` are not counted as passing evidence because they were taken before the final real-user session/cookie alignment.

## Data Evidence

Real-user session `02ebaf71-fcef-4b5f-bec6-e334bad137db`:

- No action row was created for `AskUserQuestion`.
- No pending approval card was created for `AskUserQuestion`.
- Runtime event stream contained:
  - `type = question`
  - `questionId = tooluse_EEqwBGTYilRNQOUUIw706G`
  - title `存储方式`
  - content describing SQLite and LocalStorage choices.
- Runtime then failed closed with:
  - `Runtime 等待用户补充确认，未继续执行。`
- Persisted agent message metadata includes a `runtimeParts[0].type = "question"` part.

## Surface Matrix

| Surface | Result | Evidence |
| --- | --- | --- |
| Web | PASS | OpenCLI real-user DOM shows `questionCards = 1`; screenshot `web-real-user-question-card-final.png`; SSE has `type:"question"` and no approval. |
| Mobile/PWA | PASS for question readback | OpenCLI mobile route for the same real session shows `questionCards = 1`; screenshot `mobile-real-user-question-card.png`. |
| Electron | PASS smoke fallback | No OpenCLI Electron adapter evidence was available in this run; established Playwright Electron fallback built desktop and passed 3/3 connector/runtime-detection assertions. |

## Follow-Up Defects

1. `REG-20260605-002` remains open.
   - Mobile/PWA can now read durable question parts, but the separate approved permission detail/card readback gap remains open for the prior `read_file` approval flow.

2. Full Bytedance fixed sample still needs another UAT pass after the remaining P0 blocker is fixed.
   - This task proves the `AskUserQuestion` boundary is now durable question data, not a shell approval.
   - It does not claim the calculator + SQLite artifact has been produced.

## Conclusion

`REG-20260605-001` is closed. `AskUserQuestion` is handled as a native user-question event/part and read back by Web and Mobile through the real session path. The product no longer creates malformed `AskUserQuestion (shell_command)` approvals for this native tool.
