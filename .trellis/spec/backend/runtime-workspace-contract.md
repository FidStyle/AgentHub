# Runtime Workspace Contract

## Scenario: Selected Workspace Runtime Isolation

### 1. Scope / Trigger

- Trigger: any `/api/chat`, runtime worker, Desktop connector, or native CLI adapter change that creates a role runtime invocation or executes a native CLI tool.
- This is a cross-layer contract spanning chat request handling, workspace lookup, context packaging, runtime session persistence, worker job dispatch, CLI spawn, and permission approval.

### 2. Signatures

- `resolveSelectedWorkspaceScope(workspaces, selectedWorkspaceId, fileCandidates)`
- `createRuntimeInvokeInputFromChat(input)`
- `assertRuntimeCwdMatchesWorkspaceRoot(input)`
- `evaluateNativeCliToolPermission(toolCall, { workspaceId, workspaceRoot, decision })`
- `createArchitectDispatch(input)`
- `createAcceptancePlanSummary(input)`

Concrete source: `packages/shared/src/domain/runtime-workspace.ts`.

### 3. Contracts

- Cloud Workspace root comes from `workspace.descriptor.cloudProjectDir`.
- Local Desktop Workspace root comes from `workspace.descriptor.rootPath`.
- `RuntimeInvokeInput.workspaceRoot`, `RuntimeInvokeInput.cwd`, `RuntimeSessionRecord.workspaceRoot`, and `RuntimeSessionRecord.cwd` must be equal for a selected workspace invocation.
- Worker job cwd and CLI spawn cwd must be copied from the same `RuntimeInvokeInput.cwd`.
- `ContextPackage.visibleFiles` must contain only relative paths under the selected workspace root.
- Business role context must not infer stack, package manager, `AGENTS.md`, Trellis, or monorepo context from the AgentHub host repository.
- Architect direct messages that require implementation must produce plan/mailbox/dispatch events before role execution.
- Native CLI tool execution must go through the product permission broker before execution.
- Runtime worker jobs that can broker native tools must carry `workspaceId`, `sessionId`, `ownerId`, `workspaceRoot`, and `cwd`. If a native CLI tool request is detected without that context, the worker must fail closed with a Chinese runtime failure instead of guessing the workspace.
- Runtime permission events use `approval_requested` with `actionId`, `actionKind`, `workspaceRoot`, `cwd`, `targetPaths`, `commandPreview`, and `riskLevel`; `/api/chat` must persist those fields into `RuntimeMessagePart.type === "permission"` so the message stream can render a structured approval card.
- Approving an action is not enough to execute it: `dispatchApprovedAction` must re-check `action.cwd` and absolute path tokens in `action.command` against the selected `workspaceRoot` immediately before `createSession` / `enqueue`.
- A detected native CLI tool request is a fail-closed boundary. The worker creates a pending product action and notification, emits `approval_requested`, and stops the current runtime job with `Runtime 工具已进入权限审批，未执行该操作。`; it must not stream the requested tool as normal output.

### 4. Validation & Error Matrix

| Condition | Error / Event |
| --- | --- |
| selected workspace is unknown | `SELECTED_WORKSPACE_NOT_FOUND` |
| selected workspace has no root | `WORKSPACE_ROOT_REQUIRED` |
| runtime `cwd` differs from `workspaceRoot` | `RUNTIME_CWD_MISMATCH` |
| tool call workspace differs from selected workspace | `WORKSPACE_MISMATCH` |
| tool call cwd or target path is outside root | `OUTSIDE_WORKSPACE_ROOT` + `execution_blocked` |
| no approval decision | `approval_required`, `allowed=false` |
| rejected approval | `rejected` + `execution_blocked`, `allowed=false` |
| approved and inside root | `approved` + `execution_allowed`, `allowed=true` |
| native tool request missing runtime workspace context | `runtime_failed`, Chinese fail-closed error |
| approved action cwd outside selected root | `action_dispatch_failed`, `unavailable`, `该操作试图使用 workspace 外工作目录，已阻止。` |
| approved action command targets outside absolute path | `action_dispatch_failed`, `unavailable`, `该操作试图访问 workspace 外路径 ...，已阻止。` |

### 5. Good/Base/Bad Cases

- Good: selected workspace `test2-e427fab2` resolves root `/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2`; runtime cwd, session cwd, worker cwd, and CLI cwd all equal that root.
- Base: file candidates include host repo files; only workspace-relative visible files survive.
- Bad: CLI spawn uses `/Users/joytion/Documents/code/agenthub-worktrees/role-runtime-workspace-permissions`; reject with `RUNTIME_CWD_MISMATCH`.
- Bad: user approves an install command but target path points to the AgentHub host repo; reject with `OUTSIDE_WORKSPACE_ROOT`.
- Bad: runtime executor emits a native tool request without `workspaceId` / `sessionId` / `ownerId` / `workspaceRoot`; emit runtime failure and do not create a guessed approval.
- Bad: approval endpoint receives an already-approved shell action whose `cwd` points at the AgentHub host repo; record dispatch failure and do not call `createSession` or `enqueue`.

### 6. Tests Required

- Unit test selected workspace root resolution for Cloud and Local Desktop descriptors.
- Unit test visible file filtering against outside-root absolute paths and traversal.
- Unit test `/api/chat` contract creates `RuntimeInvokeInput` with workspace root cwd and context constraints.
- Unit test architect dispatch for the request `做一个加减乘除的简单网站，使用sqlite存储历史记录` targets backend and frontend roles.
- Unit test permission broker for write file, install dependency, start service, network request, external path access, and destructive command.
- Unit test executor parsing for Claude `tool_use` and Codex `exec_command` JSON records into native tool permission requests.
- Unit test runtime worker creates pending action + notification + `approval_requested` event and emits no `runtime_output` for the requested tool.
- Unit test approved action dispatch blocks outside-root `cwd` and outside-root absolute command paths before queueing.
- Desktop adapter test must assert CLI command planning rejects host repo cwd.

### 7. Wrong vs Correct

#### Wrong

```typescript
const cwd = process.cwd();
const contextPackage = buildContextFromRepo(cwd);
spawn("codex", args, { cwd });
```

#### Correct

```typescript
const runtimeInput = createRuntimeInvokeInputFromChat({
  selectedWorkspaceId,
  sessionId,
  roleAgentId,
  runtimeKind,
  workspaces,
  userMessage,
  fileCandidates,
});

assertRuntimeCwdMatchesWorkspaceRoot(runtimeInput);
spawn("codex", args, { cwd: runtimeInput.cwd });
```

The correct path derives every execution cwd from the selected workspace root and filters context before runtime invocation.
