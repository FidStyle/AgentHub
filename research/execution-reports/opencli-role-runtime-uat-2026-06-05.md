# OpenCLI Role Runtime UAT - 2026-06-05

## Verdict

Status: **blocked / not accepted**

Fixed sample:

- Workspace: `/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2`
- Workspace id: `e427fab2-5cc3-469f-8828-fbce722fa9ef`
- Prompt: `做一个加减乘除的简单网站，使用sqlite存储历史记录`
- Base URL: `http://localhost:3000`
- Auth: fixture Auth.js DB session from `docker/.acceptance.env`
- Executor: real CLI executor (`RUNTIME_EXECUTOR=real`)

The UAT proved cwd isolation, real runtime execution, durable plan/mailbox records, and visible permission cards. It also exposed a blocking defect: approving a native CLI tool request does not resume the original tool call. The approval path dispatches a new runtime action whose prompt contains an invalid command string like `shell_command: /Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2`, so the worker completes by asking for a real command instead of executing the approved `Read` request.

## Commands Run

- `opencli doctor` - PASS, daemon and extension connected.
- `pnpm dev:acceptance` - PASS, started Postgres, Redis, Web, and real runtime worker.
- `pnpm env:acceptance:smoke` - PASS, API CRUD and `/api/chat` smoke passed with real runtime output.
- Web OpenCLI:
  - `opencli browser agenthub open http://localhost:3000/workspace`
  - fixture cookie injected with `authjs.session-token=941d47f3-9bbf-403a-9ba6-fff9696f752d`
  - `opencli browser agenthub open http://localhost:3000/workspace/e427fab2-5cc3-469f-8828-fbce722fa9ef`
  - composer sent the fixed prompt in two fresh sessions.
- Mobile/PWA OpenCLI:
  - `opencli browser agenthub open http://localhost:3000/m/sessions/d0644edb-efad-44f0-b302-1a661287b82c`
  - screenshot captured with `--width 390 --height 844 --full-page`.
- Electron fallback:
  - `pnpm --filter @agenthub/desktop build` - PASS.
  - `npx playwright test --config e2e/playwright.desktop.config.ts e2e/tests/desktop/electron.spec.ts --reporter=line` - PASS, 3 tests.

## Screenshot Evidence

Saved under `e2e/artifacts/opencli-uat/role-runtime-uat-2026-06-05/`:

- `01-web-workspace-list.png`
- `02-web-test2-existing-session.png`
- `03-web-permission-card.png`
- `04-web-reject-permission.png`
- `05-web-allow-before.png`
- `06-web-allow-permission.png`
- `07-mobile-session-allow.png`

## Data Evidence

Reject run:

- Session id: `4832c006-bb5e-4f84-b583-c03ca7ae371e`
- Runtime session id: `aad3f492-b4af-4892-886d-e8a829e9d1b6`
- Action id: `16ea4f07-9052-440c-b4b7-918e9b849ad8`
- Runtime cwd: `/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2`
- Runtime terminal: `runtime_failed` with `Runtime 工具已进入权限审批，未执行该操作。`
- Approval: `POST /api/actions/16ea4f07-9052-440c-b4b7-918e9b849ad8/approve` returned `{"status":"rejected"}`
- UI showed exact text: `已拒绝，未执行该操作。`

Allow run:

- Session id: `d0644edb-efad-44f0-b302-1a661287b82c`
- Initial runtime session id: `2826c5b3-76f8-4d2f-a58b-d52c7cc4d78a`
- Approved action id: `4671f8db-199e-49ae-b65e-1c735b3b99ca`
- Approved dispatch runtime session id: `fcf7af63-f34d-49e5-8550-c771402f1061`
- Network response: `{"status":"approved","dispatch":{"status":"queued","runtimeSessionId":"fcf7af63-f34d-49e5-8550-c771402f1061"}}`
- Action final DB status: `completed`
- Approved dispatch cwd: `/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2`

Durable plan/mailbox evidence:

- Reject plan id: `ce5d88fd-4841-446d-9679-c7654c037896`
- Allow plan id: `371f71ba-3d64-46e9-a6c1-804ed41e00ef`
- Both user messages stored `metadata.architectDispatch.eventKinds = ["plan_created","mailbox_created","role_dispatched","role_dispatched"]`
- Both dispatches selected backend and frontend role ids.
- `agent_mailbox_items` rows were created with attempt ids and lineage root ids for the architect planning node.

## What Passed

- Fixture-authenticated Web OpenCLI reached the real `test2` workspace.
- The current fresh architect reply did not mention AgentHub monorepo, Next.js, React, Drizzle, Postgres, next-auth, `.trellis`, or host repo context.
- Runtime session cwd matched the fixed cloud workspace root.
- Runtime logs contained real `runtime_output`, `approval_requested`, and fail-closed `runtime_failed` events.
- Permission card rendered in Web with action metadata and workspace path.
- Reject UI showed `已拒绝，未执行该操作。`, and DB action status became `rejected`.
- Allow UI showed `已允许本次执行`, DB action status became `completed`, and the queued approved runtime session kept cwd inside the fixed workspace root.
- Mobile/PWA route could read the same session and plan state.
- Electron fallback smoke passed because no OpenCLI AgentHub app adapter exists.

## Blocking Defects

1. Approved native tool continuation is not semantically correct.
   - The original permission was for Claude `Read` under the selected workspace.
   - The approved action command persisted as `shell_command: /Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2`.
   - The approved runtime responded that this was a directory path, not an executable command.
   - Result: approval starts a new product action rather than resuming or faithfully executing the approved native CLI tool request.

2. The fixed sample does not complete after the first permission.
   - Plans remain `failed` overall.
   - Backend and frontend worker nodes are marked failed, so the calculator + SQLite site is not produced.
   - No durable artifact/preview evidence exists for the requested website.

3. Mobile/PWA does not show durable permission detail after reload.
   - It shows the failed plan supervision state, but the transient runtime permission card from the Web message is not visible as a durable mobile approval/readback surface in the tested session.

## Follow-Up

Created follow-up task:

- `.trellis/tasks/06-05-fix-approved-native-tool-continuation`

The next task must fix approved native tool continuation, then re-run this fixed-sample UAT before the sequential queue can move to P1/P2 work.
