# Architect Durable Dispatch Fix

Date: 2026-06-05
Task: `.trellis/tasks/06-05-fix-architect-durable-dispatch`
Contract: `research/contracts/ROLE-RUNTIME-WORKSPACE-PERMISSIONS-2026-06-03.md`

## Summary

This task fixes the single-architect engineering request path. When `/api/chat` resolves a default or explicitly selected `@架构师` as the only selected role and the request requires implementation, the route now expands the selection to real workspace engineering roles before orchestration is generated.

For the fixed sample:

```text
做一个加减乘除的简单网站，使用sqlite存储历史记录
```

the route creates the existing durable orchestration evidence path instead of falling back to direct architect chat:

- `plans`
- `plan_nodes`
- `plan_node_attempts`
- `agent_mailbox_items`
- runtime sessions/jobs carrying the selected workspace `cwd`

The expansion only uses real role rows from the selected workspace. It does not invent hidden role IDs or fake mailbox records.

## Implementation Evidence

- `/api/chat` calls `createArchitectDispatch` for single selected orchestrator roles and maps requested backend/frontend targets onto actual workspace roles by role name/type/capabilities.
- The generated user message metadata records `architectDispatch` with requested target types, selected target role IDs, plan/mailbox IDs from the contract helper, and event kinds for auditability.
- `generateOrchestration` treats `sqlite` and `存储` as backend-first signals so the fixed sample produces backend work before frontend work.
- Regression coverage asserts the fixed sample without `roleAgentIds` no longer calls the direct `HostedRuntimeAdapter`; it creates a durable plan, four plan nodes, four attempts, four mailbox items, and four queued runtime jobs.
- Regression coverage asserts all runtime sessions/jobs keep `cwd === /Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2`.

## Verification

Commands run and passed:

```bash
pnpm --filter @agenthub/web test -- __tests__/api/chat.test.ts __tests__/orchestrator.test.ts
pnpm --filter @agenthub/shared test -- src/domain/runtime-workspace.test.ts
pnpm --filter @agenthub/web test -- __tests__/orchestrator/action-dispatcher.test.ts __tests__/api/mailbox-controls.test.ts
pnpm --filter @agenthub/web type-check
pnpm --filter @agenthub/shared type-check
pnpm --filter @agenthub/web lint
pnpm --filter @agenthub/web test
pnpm --filter @agenthub/shared test
python3 ./.trellis/scripts/task.py validate .trellis/tasks/06-05-fix-architect-durable-dispatch
python3 -m json.tool .trellis/tasks/06-05-fix-architect-durable-dispatch/task.json
git diff --check
```

Results:

- Focused Web chat/orchestrator suite: 2 files, 31 tests passed.
- Focused Web dispatcher/mailbox suite: 2 files, 10 tests passed.
- Shared runtime-workspace test: 1 file, 9 tests passed.
- Web full Vitest suite: 30 files, 253 tests passed.
- Shared full Vitest suite: 7 files, 47 tests passed.
- Web and Shared type-check: passed.
- Web lint: passed with existing Next lint deprecation/config warnings only; no ESLint warnings or errors.
- Trellis validation and task JSON/JSONL parsing: passed.
- `git diff --check`: passed.

## OpenCLI Status

OpenCLI tri-surface UAT was intentionally not run in this task.

| Surface | Result | Reason |
| --- | --- | --- |
| Web | `not-run` | This task is scoped to automatic durable dispatch regression coverage. |
| Mobile browser/PWA | `not-run` | Final fixed-sample tri-surface UAT remains queued. |
| Desktop/Electron | `not-run` | Permission broker and final UAT are later queue items. |

The fixed sample OpenCLI UAT remains assigned to `06-05-opencli-role-runtime-uat` after the permission broker task.

## Residual Scope

Not included here:

- Runtime permission broker cards and allow/reject behavior.
- Final Web/Mobile/PWA/Desktop/Electron OpenCLI UAT for the fixed sample.

## Spec Update

No new spec update was needed. `.trellis/spec/backend/runtime-workspace-contract.md` already requires architect direct messages that require implementation to produce plan/mailbox/dispatch events before role execution, and it already names the fixed sample dispatch test.
