# Role Runtime OpenCLI Failure Evidence Sync

Date: 2026-06-05
Task: `.trellis/tasks/06-05-sync-role-runtime-opencli-failure-evidence`
Source contract: `research/contracts/ROLE-RUNTIME-WORKSPACE-PERMISSIONS-2026-06-03.md`
Old lane evidence source: `.trellis/tasks/06-03-role-runtime-workspace-permissions/research/acceptance-report.md`

## Summary

The old `role-runtime-workspace-permissions` lane produced contract-level evidence for runtime cwd binding, context filtering, architect dispatch, and permission broker behavior. It did not run the required real UI acceptance flow.

The old report explicitly states that no dev server was started and no `baseUrl` was used in that round. Therefore the old lane evidence is not accepted as Web, Mobile/PWA, or Desktop/Electron OpenCLI UAT proof.

This report synchronizes that fact into the current single-branch sequential queue. It does not fix business code.

## Acceptance Sample

| Field | Value |
| --- | --- |
| Workspace root | `/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2` |
| Prompt | `做一个加减乘除的简单网站，使用sqlite存储历史记录` |
| Required fixed base URL for server-backed UAT | `http://127.0.0.1:3106` |
| Old lane actual base URL | none |
| Old lane dev server | not started |

## Evidence Already Present In Old Lane

The old report records these contract-level facts:

- `RuntimeInvokeInput.cwd`, `RuntimeSessionRecord.cwd`, and `RuntimeWorkerJob.cwd` equal `/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2` in the shared contract sample.
- Context payload includes the constraint not to infer stack, package manager, `AGENTS.md`, Trellis, or monorepo context from the AgentHub host repository.
- Context regression assertions exclude host-derived assumptions such as `Next.js 15`, `React 19`, `Drizzle`, `Postgres`, and `next-auth`.
- Architect dispatch test evidence includes a plan id, mailbox id, backend target role, and frontend target role for the SQLite website request.
- Permission broker tests cover write file, install dependency, start service, network request, workspace external path access, and destructive command categories.
- Desktop command planning rejects a host repo cwd with `RUNTIME_CWD_MISMATCH`.

These facts are useful as regression targets for the follow-up implementation tasks, but they are not end-to-end product acceptance evidence.

## Missing / Not Accepted Evidence

| Surface | Required by current governance | Current result | Reason |
| --- | --- | --- | --- |
| Web | OpenCLI real browser from Web workspace IM entry at `http://127.0.0.1:3106` | `not-run` | Old lane did not start a dev server or use a base URL. |
| Mobile browser/PWA | OpenCLI mobile/PWA viewport proving the same session state and permission/dispatch visibility | `not-run` | No mobile viewport or PWA evidence exists for this sample. |
| Desktop/Electron | OpenCLI/Electron or Desktop real UI evidence for runtime/permission state | `not-run` | Old evidence is Desktop unit/contract level only, not Electron UAT. |
| Fixed sample runtime | URL, fixture auth, cwd, context, plan/mailbox/attempt, permission card, reject/allow behavior | `not-accepted` | The fixed sample was not exercised through real UI and runtime flow. |

## Current Queue Consequence

The sequential queue must continue with the already planned follow-up tasks:

1. `06-05-fix-role-runtime-cwd-context-isolation`
2. `06-05-fix-architect-durable-dispatch`
3. `06-05-fix-runtime-permission-broker`
4. `06-05-opencli-role-runtime-uat`

No follow-up task should be skipped because of the old lane contract tests. The final UAT remains unproven until Web, Mobile/PWA, and Desktop/Electron OpenCLI evidence is captured for the fixed sample.

## Verification For This Sync Task

- `git status --short` at task start: clean.
- Source evidence inspected: `.trellis/tasks/06-03-role-runtime-workspace-permissions/research/acceptance-report.md`.
- Current governance checked: `research/sequential-execution-progress.md`, `research/workflow/ai-workflow-control.md`, `.trellis/spec/cross-layer/real-flow-acceptance.md`.
- Business code changed: no.
- `python3 ./.trellis/scripts/task.py validate .trellis/tasks/06-05-sync-role-runtime-opencli-failure-evidence`: PASS, 4 `implement.jsonl` entries and 4 `check.jsonl` entries.
- `python3 -m json.tool .trellis/tasks/06-05-sync-role-runtime-opencli-failure-evidence/task.json`: PASS.
- `python3 -c "...json.loads(line)..."` over `implement.jsonl` and `check.jsonl`: PASS.
- `python3 ./.trellis/scripts/task.py current --source`: points to `.trellis/tasks/06-05-sync-role-runtime-opencli-failure-evidence`.
- `rg -n "not-run|not-accepted|role-runtime-opencli-failure-evidence|06-05-sync-role-runtime" ...`: PASS, synchronized report/progress/tracker entries are discoverable.
- `git diff --check`: PASS.
- Business-code diff: none; changed files are Trellis task metadata/docs and `research/` evidence docs only.
