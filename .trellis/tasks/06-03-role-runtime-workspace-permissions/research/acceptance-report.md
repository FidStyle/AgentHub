# Acceptance Report: Role Runtime Workspace Permissions

**Date:** 2026-06-03  
**Lane port:** `3106`  
**Final baseUrl rule:** `http://127.0.0.1:3106` for any server-backed E2E.  
**Actual baseUrl used in this round:** none. No dev server was started; no default or auto-selected port was used as evidence.

## Verification Commands

- `corepack pnpm --filter @agenthub/shared typecheck`
- `corepack pnpm --filter @agenthub/shared test`
- `corepack pnpm --filter @agenthub/desktop test`
- `corepack pnpm -r typecheck`
- `corepack pnpm -r test`

## Acceptance Sample

- Workspace root: `/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2`
- User request: `做一个加减乘除的简单网站，使用sqlite存储历史记录`
- Contract test: `packages/shared/src/domain/runtime-workspace.test.ts`

## Runtime Evidence

- `RuntimeInvokeInput.workspaceId`: `workspace-test2`
- `RuntimeInvokeInput.workspaceRoot`: `/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2`
- `RuntimeInvokeInput.cwd`: `/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2`
- `RuntimeSessionRecord.cwd`: `/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2`
- `RuntimeWorkerJob.cwd`: `/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2`
- `ContextPackage.id`: `ctx-workspace-test2-session-acceptance-role-architect`
- `ContextPackage.visibleFiles`: `README.md` in the `/api/chat` contract sample; broader scope test accepts only `package.json`, `server/index.ts`, and `src/App.tsx`.
- Host repo candidates such as `/Users/joytion/Documents/code/agenthub-worktrees/role-runtime-workspace-permissions/AGENTS.md` and `/repo/AgentHub/package.json` are filtered out.

## Context Isolation Evidence

The context payload includes an explicit constraint:

`Do not infer stack, package manager, AGENTS.md, Trellis, or monorepo context from the AgentHub host repository.`

The regression test asserts the architect context does not include host-derived assumptions:

- `Next.js 15`
- `React 19`
- `Drizzle`
- `Postgres`
- `next-auth`

## Role Dispatch Evidence

- `planId`: `plan-session-acceptance-architect`
- `mailboxId`: `mailbox-session-acceptance-architect`
- `dispatchEventIds`:
  - `dispatch-plan-session-acceptance-architect-created`
  - `dispatch-mailbox-session-acceptance-architect-created`
  - `dispatch-plan-session-acceptance-architect-role-backend`
  - `dispatch-plan-session-acceptance-architect-role-frontend`
- Target roles:
  - `role-backend`
  - `role-frontend`

The SQLite history requirement triggers backend dispatch. The website UI requirement triggers frontend dispatch.

## Permission Broker Evidence

Covered tool calls in tests:

- `write_file`: `tool-write-1`
- `install_dependency`: `tool-install-1`
- `start_service`: parameterized shared broker test
- `network_request`: parameterized shared broker test
- `workspace_external_path_access`: parameterized shared broker test
- `destructive_command`: parameterized shared broker test

Approval event behavior:

- Without a decision: emits `approval_required`, `allowed=false`.
- Rejected decision: emits `rejected` and `execution_blocked`, `allowed=false`.
- Approved inside workspace root: emits `approved` and `execution_allowed`, `allowed=true`.
- Approved but outside workspace root: emits `execution_blocked`, `allowed=false`, `code=OUTSIDE_WORKSPACE_ROOT`.

## Runtime / CLI Spawn Guard

Desktop runtime command planning now calls the shared invariant:

`RuntimeInvokeInput.cwd === RuntimeInvokeInput.workspaceRoot`

The Desktop regression test rejects host repo cwd:

`/Users/joytion/Documents/code/agenthub-worktrees/role-runtime-workspace-permissions`

with `RUNTIME_CWD_MISMATCH`.
