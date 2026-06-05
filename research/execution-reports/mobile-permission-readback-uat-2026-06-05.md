# Mobile Permission Readback UAT - 2026-06-05

## Verdict

Status: **accepted for REG-20260605-002**

Mobile/PWA `/m/sessions/:sessionId` now reads durable action rows through the real `/api/actions?session_id=...` path and renders a persistent permission detail card after reload. Approved native permission details are no longer limited to Web or DB evidence.

This task closes the Mobile/PWA readback blocker only. It does not claim the fixed calculator + SQLite Bytedance sample has fully produced its final artifact.

## Scope

- Trellis task: `.trellis/tasks/06-05-fix-mobile-permission-readback`
- Regression: `REG-20260605-002`
- Surface under test: Mobile/PWA route `/m/sessions/:sessionId`
- Browser UAT tool: OpenCLI profile `agenthub`
- Supporting Electron check: Playwright Electron fallback

## Implementation Summary

- Added `apps/web/app/m/sessions/[sessionId]/mobile-permission-readback.tsx`.
- Mobile session page now fetches `/api/actions?session_id=<sessionId>` and renders an `授权记录` section for durable action rows.
- Approved/terminal actions render read-only decided states such as `已允许本次执行`.
- Pending actions keep approve/reject controls wired to the real `/api/actions/:id/approve` endpoint.
- Existing message `runtimeParts.permission` rendering remains unchanged for inline stream context.

## Commands Run

- `pnpm --filter @agenthub/web test -- __tests__/message-markdown.test.ts` - PASS, 15 tests.
- `pnpm --filter @agenthub/web type-check` - PASS.
- `pnpm --filter @agenthub/web lint` - PASS, no ESLint warnings or errors; existing Next lint deprecation/config warnings only.
- `pnpm --filter @agenthub/shared type-check` - PASS.
- `pnpm --filter @agenthub/shared test -- src/domain/runtime-workspace.test.ts` - PASS, 15 tests.
- `pnpm --filter @agenthub/desktop build` - PASS.
- `npx playwright test --config e2e/playwright.desktop.config.ts e2e/tests/desktop/electron.spec.ts --reporter=line` - PASS, 3/3.
- `python3 ./.trellis/scripts/task.py validate .trellis/tasks/06-05-fix-mobile-permission-readback` - PASS.
- `git diff --check` - PASS.

## OpenCLI Mobile/PWA Evidence

Saved under `e2e/artifacts/opencli-uat/mobile-permission-readback-2026-06-05/`.

Primary evidence:

- `opencli-browser-created-session.json`
  - Current OpenCLI browser user created a real workspace and session via product APIs.
  - Workspace id: `39ac8722-8e27-4187-b934-31091edd0dd2`
  - Session id: `43361319-a417-4db9-a135-c2c9fd44dd61`
  - Owner id: `7cb39857-1620-42c8-9871-9e5e7c99df0c`
- `opencli-actions-api-browser-user.json`
  - Same browser user called `/api/actions?session_id=43361319-a417-4db9-a135-c2c9fd44dd61`.
  - `count = 1`
  - `action_type = read_file`
  - `status = approved`
  - `result.source = runtime_permission_broker`
  - `result.toolName = Read`
  - `result.actionKind = read_file`
  - `result.targetPaths[0]` points to `README.md` under the selected cloud workspace.
- `mobile-readback-dom.json`
  - URL: `http://localhost:3000/m/sessions/43361319-a417-4db9-a135-c2c9fd44dd61`
  - `readback = 1`
  - `durablePermissionCards = 1`
  - `hasApprovedText = true`
  - `hasReadFile = true`
  - `hasTargetPath = true`
  - `overflow = false`
- `mobile-permission-readback.png`
  - Mobile/PWA screenshot showing `授权记录`, `已允许本次执行`, `read_file`, `Read`, cwd/workspace root, and target path.

Debug-only artifact:

- `mobile-before-cookie-check.png` records the old-cookie mismatch before using the current OpenCLI browser user for the final UAT. It is not counted as passing evidence.

## Surface Matrix

| Surface | Result | Evidence |
| --- | --- | --- |
| Web | Supporting API evidence | Same browser user created workspace/session through real Web APIs and `/api/actions?session_id=...` returned the approved action. This is supporting context, not the Mobile pass condition. |
| Mobile/PWA | PASS | OpenCLI Mobile/PWA DOM and screenshot show durable approved `read_file` permission details after reload. |
| Electron | PASS smoke fallback | No OpenCLI Electron adapter evidence was available in this run; established Playwright Electron fallback built desktop and passed 3/3 connector/runtime-detection assertions. |

## Data Evidence

Final action id: `7a5052d7-d0fc-4f55-8399-0671ebeae2c1`.

Durable action fields:

- `session_id = 43361319-a417-4db9-a135-c2c9fd44dd61`
- `owner_id = 7cb39857-1620-42c8-9871-9e5e7c99df0c`
- `action_type = read_file`
- `status = approved`
- `requires_approval = true`
- `command = Read: /Users/joytion/.agenthub/cloud-workspaces/joytion/mobile-permission-readback-browser-user-39ac8722/README.md`
- `cwd = /Users/joytion/.agenthub/cloud-workspaces/joytion/mobile-permission-readback-browser-user-39ac8722`
- `result.source = runtime_permission_broker`
- `result.toolName = Read`
- `result.actionKind = read_file`
- `result.workspaceRoot` and `result.cwd` match the selected workspace root.
- `result.targetPaths[0]` is the `README.md` path under that workspace.

## Conclusion

`REG-20260605-002` is closed. Mobile/PWA can now read and render durable permission/action metadata after refresh, including decided approved state and native tool details.
