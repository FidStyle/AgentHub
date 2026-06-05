# Approved Native Tool Continuation UAT - 2026-06-05

## Verdict

Status: **accepted for the original blocker**

The approved Claude native `Read` request no longer becomes a malformed `shell_command: <workspaceRoot>` action. The Web rerun on the refreshed acceptance stack created a `read_file` action with complete broker metadata, approval queued a native-tool continuation in the same workspace/native session, and the terminal action row preserved the broker metadata.

Remaining issues are split out of this blocker:

- Mobile/PWA session readback loads the session and plan state, but does not show the durable permission detail/card after reload.
- Claude's follow-on `AskUserQuestion` native tool is classified as `shell_command`; this blocks the sample from completing the full calculator + SQLite implementation after the fixed `Read` continuation.

## Scope

- Workspace id: `e427fab2-5cc3-469f-8828-fbce722fa9ef`
- Workspace root: `/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2`
- Session id: `b7cb9b2d-227a-4188-8c41-95319936acc3`
- Prompt: `做一个加减乘除的简单网站，使用sqlite存储历史记录`
- Executor: real Claude Code CLI through `pnpm dev:acceptance`
- Browser UAT: OpenCLI profile `agenthub`

## Commands Run

- `kill ...` old `pnpm dev:acceptance` process tree, then `pnpm dev:acceptance` - PASS, fresh Web + worker on current working tree.
- `pnpm env:acceptance:smoke` - PASS:
  - CRUD smoke 5/5.
  - `/api/chat` smoke 12 passed, 0 failed.
- Focused regression and quality gates:
  - `pnpm --filter @agenthub/web test -- __tests__/runtime/executor.test.ts __tests__/orchestrator/action-dispatcher.test.ts` - PASS, 42 tests.
  - `pnpm --filter @agenthub/web type-check` - PASS.
  - `pnpm --filter @agenthub/web lint` - PASS, no ESLint warnings or errors.
  - `pnpm --filter @agenthub/shared type-check` - PASS.
  - `pnpm --filter @agenthub/shared test -- src/domain/runtime-workspace.test.ts` - PASS, 15 tests.
  - `python3 ./.trellis/scripts/task.py validate .trellis/tasks/06-05-fix-approved-native-tool-continuation` - PASS.
  - `git diff --check` - PASS.
- Web OpenCLI:
  - `opencli doctor` - PASS.
  - `opencli browser agenthub open http://localhost:3000/workspace/e427fab2-5cc3-469f-8828-fbce722fa9ef`
  - `opencli browser agenthub click 55`
  - `opencli browser agenthub click 50`
- Mobile/PWA OpenCLI:
  - `opencli browser agenthub open http://localhost:3000/m/sessions/b7cb9b2d-227a-4188-8c41-95319936acc3`
  - `opencli browser agenthub screenshot --width 390 --height 844 .../13-mobile-rerun-approved-readback.png`
- Electron fallback:
  - `pnpm --filter @agenthub/desktop build` - PASS.
  - `npx playwright test --config e2e/playwright.desktop.config.ts e2e/tests/desktop/electron.spec.ts --reporter=line` - PASS, 3/3.

## Screenshot Evidence

Saved under `e2e/artifacts/opencli-uat/approved-native-tool-continuation-2026-06-05/`:

- `10-web-rerun-before-send.png`
- `11-web-rerun-read-permission-card.png`
- `12-web-rerun-approved-running.png`
- `13-mobile-rerun-approved-readback.png`

Earlier exploratory screenshots in the same folder (`01` through `09`) record the pre-final reruns and the original final approval UI.

## Data Evidence

Fresh `Read` approval action before approval:

- Action id: `d23a4396-a3e0-4521-a91c-644bc3291911`
- `action_type`: `read_file`
- `command`: `Read: /Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2/README.md`
- `cwd`: `/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2`
- `status`: `pending`
- `result.source`: `runtime_permission_broker`
- `result.toolName`: `Read`
- `result.actionKind`: `read_file`
- `result.targetPaths`: `["/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2/README.md"]`
- `result.roleAgentId`: `fc3c6f73-715e-4299-9ee5-c07ea1ec1ca4`
- `result.nativeSessionId`: `996d592d-b4a1-4dd4-9ee6-67413ae6db3b`
- `result.runtimeSessionId`: `fee5a305-53f9-41eb-b37b-1293159e8ba9`

After approval and terminal worker update:

- Approved action status: `failed` because the runtime hit a new permission boundary, not because the approved `Read` was malformed.
- Continuation runtime session id: `ebda99b8-a6bc-4b3c-a376-1a07b7c926e7`
- Continuation runtime session kept:
  - `role_agent_id = fc3c6f73-715e-4299-9ee5-c07ea1ec1ca4`
  - `runtime_type = claude_code`
  - `native_session_id = 996d592d-b4a1-4dd4-9ee6-67413ae6db3b`
  - `cwd = /Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2`
- Terminal `actions.result` still contained:
  - `source = runtime_permission_broker`
  - `toolName = Read`
  - `actionKind = read_file`
  - `targetPaths = [README.md under test2 workspace]`
  - `roleAgentId`
  - `nativeSessionId`
  - `originalRuntimeSessionId`
  - `runtimeSessionId = ebda99b8-a6bc-4b3c-a376-1a07b7c926e7`

There was no new approved action with `command = shell_command: /Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2`.

## Surface Matrix

| Surface | Result | Evidence |
| --- | --- | --- |
| Web | PASS for original blocker | Permission card showed `read_file`/`Read`; approval showed `已允许本次执行`; DB preserved native tool metadata before, during, and after worker terminal update. |
| Mobile/PWA | PARTIAL / follow-up defect | `/m/sessions/b7cb9b2d-227a-4188-8c41-95319936acc3` loaded session and plan state, but did not show durable permission card/detail after reload. |
| Electron | PASS smoke fallback | No OpenCLI app adapter available; Playwright Electron fallback built desktop and passed 3/3 connector/runtime-detection assertions. |

## Follow-Up Defects

1. `AskUserQuestion` native tool classification gap.
   - Follow-on action id: `d8eee57c-9783-4e86-b432-c0df5a30a05e`
   - Current classification: `action_type = shell_command`, `command = AskUserQuestion (shell_command)`
   - This is separate from the original malformed `Read` approval. It prevented the fixed sample from finishing the calculator + SQLite implementation in this rerun.

2. Mobile/PWA durable permission detail readback.
   - Mobile route shows plan supervision and message text, but not the approved permission state/card details visible on Web.
   - The DB has the permission metadata, so this is a mobile presentation/readback gap, not an approval dispatch data-loss issue.

## Conclusion

The original UAT blocker is fixed: approving a Claude native `Read` permission no longer dispatches malformed `shell_command: <workspaceRoot>`. The system now preserves native tool metadata, reuses the selected workspace cwd/native session, and blocks outside-root broker metadata in automated coverage.
