# Role Runtime Cwd And Context Isolation Fix

Date: 2026-06-05
Task: `.trellis/tasks/06-05-fix-role-runtime-cwd-context-isolation`
Contract: `research/contracts/ROLE-RUNTIME-WORKSPACE-PERMISSIONS-2026-06-03.md`
Work commit: `b5da89d fix: 绑定角色 runtime 工作区 cwd`

## Summary

This task fixes the cloud role runtime `cwd` and context boundary so `/api/chat`, runtime sessions, Redis worker jobs, mailbox/runtime-node dispatch, local relay payloads, and real CLI worker creation no longer fall back to `process.cwd()` or `RUNTIME_CWD`.

The selected cloud workspace root used by the regression tests is:

```text
/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2
```

Business role prompts now include the selected workspace root plus an explicit constraint to only use files visible inside that root and not infer stack, package manager, `AGENTS.md`, Trellis, or monorepo context from the AgentHub host repository.

## Implementation Evidence

- `/api/chat` now selects `id, name, execution_domain, cloud_project_dir` and resolves cloud runtime root through `loadCloudWorkspaceRoot`.
- Direct `HostedRuntimeAdapter.invoke` receives `cwd` from the selected cloud workspace root and fails with `runtime_failed` if `cwd` is missing.
- `createSession` requires `cwd` and stores/reuses native sessions scoped by the selected cwd.
- Public cloud Redis jobs copy `runtimeSession.cwd`.
- Local Desktop relay payloads copy `runtimeSession.cwd`.
- Runtime worker `createExecutor` requires `job.cwd` before creating a real `CliRuntimeExecutor`.
- Orchestrator action dispatch, mailbox dispatch, and runtime-node dispatch select `cloud_project_dir`, inject `cwd`/`workspaceRoot`, and fail closed if the root is missing.
- Tests assert the fixed sample root reaches direct adapter calls, runtime sessions, queued jobs, mailbox dispatch, local relay payloads, and worker executor options.

## Verification

Commands run and passed:

```bash
pnpm --filter @agenthub/shared build
pnpm --filter @agenthub/web test -- __tests__/api/chat.test.ts __tests__/orchestrator/action-dispatcher.test.ts __tests__/runtime/gateway-gating.test.ts __tests__/runtime/local-device-relay.test.ts __tests__/runtime/gateway-session-reuse.test.ts __tests__/api/mailbox-controls.test.ts __tests__/runtime/executor.test.ts
pnpm --filter @agenthub/web type-check
pnpm --filter @agenthub/shared type-check
pnpm --filter @agenthub/shared test -- src/domain/runtime-workspace.test.ts
pnpm --filter @agenthub/web lint
pnpm --filter @agenthub/web test
python3 ./.trellis/scripts/task.py validate .trellis/tasks/06-05-fix-role-runtime-cwd-context-isolation
python3 -m json.tool .trellis/tasks/06-05-fix-role-runtime-cwd-context-isolation/task.json
git diff --check
```

Results:

- Web focused runtime/chat suite: 7 files, 57 tests passed.
- Web full Vitest suite: 30 files, 252 tests passed.
- Shared runtime-workspace test: 1 file, 9 tests passed.
- Web and Shared type-check: passed.
- Web lint: passed with existing Next lint deprecation/config warnings only; no ESLint warnings or errors.
- Trellis validation and task JSON/JSONL parsing: passed.
- `git diff --check`: passed.

## OpenCLI Status

OpenCLI tri-surface UAT was intentionally not run in this task.

| Surface | Result | Reason |
| --- | --- | --- |
| Web | `not-run` | This task is scoped to code-level `cwd` and context isolation regression. |
| Mobile browser/PWA | `not-run` | Final fixed-sample tri-surface UAT remains queued. |
| Desktop/Electron | `not-run` | Permission cards and final UAT are later queue items. |

The fixed sample OpenCLI UAT remains assigned to `06-05-opencli-role-runtime-uat` after durable architect dispatch and permission broker fixes.

## Residual Scope

Not included here:

- Durable `@架构师` engineering dispatch fix.
- Runtime permission broker cards and allow/reject behavior.
- Final Web/Mobile/PWA/Desktop/Electron OpenCLI UAT for the fixed sample.

## Spec Update

No new spec update was needed. The existing `.trellis/spec/backend/runtime-workspace-contract.md` already requires selected workspace root, non-host context, runtime/session/job cwd equality, and fail-closed behavior.
