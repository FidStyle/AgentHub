# fix AskUserQuestion native tool classification

## Background

This P0 task continues the single-branch sequential execution queue. The fixed Bytedance demo sample is blocked after the previous native `Read` approval fix: Claude emits `AskUserQuestion`, but AgentHub classifies it as `shell_command` and creates a malformed permission action instead of showing a user-question interaction in the chat.

Highest product truth remains:

- `bytedance_init_prd.md`
- `bytedance_init_video_txt.txt`

Current regression source:

- `research/regression-ledger.md` / `REG-20260605-001`
- `research/execution-reports/approved-native-tool-continuation-uat-2026-06-05.md`

## Goal

`AskUserQuestion` must not be represented as `shell_command`. It must become durable runtime question data that Web and Mobile can read from the real session/message path. The fixed sample must either continue through a supported answer path or stop at an explicit user-question state, never at a malformed shell approval.

## Requirements

1. Detect Claude native `AskUserQuestion` tool calls explicitly.
2. Do not create an `actions` row with `action_type=shell_command` for `AskUserQuestion`.
3. Emit/persist a runtime `question` event/part using the existing runtime gateway/message schema where possible:
   - keep `questionId` when available;
   - include a readable Chinese/English content summary from the tool input;
   - preserve session/workspace/runtime context through the normal real API/DB path.
4. Web chat must render the persisted question card after reload.
5. Mobile/PWA session readback must render the persisted question card after reload.
6. Electron/Desktop UAT must prove the current build still opens the real workspace/session surface or, if no OpenCLI Electron adapter is available, use the established Playwright Electron fallback and record the limitation.
7. The fixed sample UAT must check the DB/API evidence:
   - no new `AskUserQuestion (shell_command)` pending action;
   - message/runtime part contains a durable question;
   - the original workspace cwd and runtime session metadata remain real, not fake/script runtime.

## Non-goals

- Do not implement new unstarted P2 features.
- Do not fake runtime success or script a synthetic artifact completion.
- Do not claim the calculator + SQLite demo is complete unless the real runtime produces it and it is verified.
- Do not redesign the full answer/resume protocol unless existing code already supports it safely.

## Verification

Run focused automated checks for the touched packages, then run OpenCLI three-surface UAT:

- Web focused tests for runtime executor/worker/question persistence.
- Web type-check and lint.
- Shared type-check and focused runtime workspace tests if shared contracts change.
- Acceptance server smoke with real DB/API/session.
- OpenCLI Web browser UAT on the fixed sample.
- OpenCLI Mobile/PWA browser readback UAT.
- OpenCLI Electron/app UAT, or documented Playwright Electron fallback when OpenCLI has no Electron adapter.

## Completion

The task is complete only after code, tests, UAT evidence, `research/sequential-execution-progress.md`, `research/regression-ledger.md`, and execution report are updated, then committed, archived, and journaled before the next task starts.
