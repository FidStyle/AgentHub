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

## Scenario: Approved Native Tool Continuation Metadata

### 1. Scope / Trigger

- Trigger: any runtime executor, runtime worker, Redis job, action approval, or action dispatcher change that handles native CLI tool permission requests.
- This is a cross-layer contract spanning streamed CLI JSON parsing, pending action creation, action `result` metadata, approval dispatch, worker queued/running/terminal updates, and runtime session/native session continuity.

### 2. Signatures

- `CliOutputParser.parseLine(line): CliOutputChunk[]`
- `RuntimeJob.actionResult?: Record<string, unknown> | null`
- `RuntimeJob.roleAgentId?: string | null`
- `processJob(job, executor)`
- `dispatchApprovedAction(db, action)`
- `enqueueRuntimeJob(job)`

Concrete sources:

- `apps/web/lib/runtime/executor.ts`
- `apps/web/server/runtime-worker.ts`
- `apps/web/lib/orchestrator/action-dispatcher.ts`
- `apps/web/lib/runtime/redis-client.ts`

### 3. Contracts

- Claude streamed `tool_use` input can arrive as `content_block_start` with empty `input`, followed by `input_json_delta.partial_json`. The executor parser must buffer the tool request until `content_block_stop` before emitting the permission request.
- Native tool names `Read`, `View`, and `Open` must classify as `read_file` even if path extraction has not completed yet.
- Pending actions created by the runtime permission broker must store broker metadata in `actions.result`:
  - `source = "runtime_permission_broker"`
  - `toolCallId`
  - `toolName`
  - `actionKind`
  - `input`
  - `targetPaths`
  - `cwd`
  - `workspaceRoot`
  - `runtimeType`
  - `roleAgentId`
  - `nativeSessionId`
  - `runtimeSessionId`
  - `originalRuntimeSessionId`
- Permission action command labels must describe the approved native tool, for example `Read: <path>`. They must not fall back to `shell_command: <workspaceRoot>` when the request is not a shell command.
- `dispatchApprovedAction` must detect `actions.result.source === "runtime_permission_broker"` and enqueue a native tool continuation prompt that includes the original tool id/name/input/target paths/cwd. It must use broker `runtimeType`, `roleAgentId`, and `nativeSessionId` when available.
- Worker running/completed/failed updates for an approved action must merge existing `job.actionResult` into terminal `actions.result`; terminal output/error fields must not erase broker metadata.

### 4. Validation & Error Matrix

| Condition | Error / Event |
| --- | --- |
| Claude streamed tool input not complete yet | no `approval_requested` action until `content_block_stop` |
| native `Read`/`View`/`Open` has path input | `action_type = read_file`, `command = Read: <path>` or equivalent tool label |
| native permission broker result missing executable metadata | `action_dispatch_failed`, `Runtime 原生工具审批缺少可执行元数据，已阻止。` |
| broker `cwd` outside selected workspace root | `action_dispatch_failed`, `该操作试图使用 workspace 外工作目录，已阻止。` |
| broker `workspaceRoot` differs from selected workspace root | `action_dispatch_failed`, `该操作绑定的 workspace root 与当前工作区不一致，已阻止。` |
| broker `targetPaths` contains outside-root absolute path | `action_dispatch_failed`, `该操作试图访问 workspace 外路径 ...，已阻止。` |
| worker terminal update receives `job.actionResult` | merge broker metadata with `terminal`, `output`, `error`, and final `runtimeSessionId` |

### 5. Good/Base/Bad Cases

- Good: Claude emits `Read` with streamed input for `/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2/README.md`; worker creates `read_file`, stores `targetPaths`, `roleAgentId`, and `nativeSessionId`; approval queues a continuation in the same workspace/native session; terminal result still contains broker metadata.
- Base: a shell-like native tool has a real command preview; approval can still use normal command dispatch after cwd/path validation.
- Bad: `content_block_start` with `input: {}` immediately creates `Read (read_file)` with empty `targetPaths`; delay until final streamed input is parsed.
- Bad: approval of `Read` creates `command = shell_command: <workspaceRoot>` and a prompt asking the CLI to run a directory path.
- Bad: worker marks the approved action failed/completed with `{ output, terminal, runtimeSessionId }` only, erasing `toolName`, `targetPaths`, `nativeSessionId`, or `originalRuntimeSessionId`.

### 6. Tests Required

- Unit test `CliOutputParser` buffers Claude `input_json_delta` and emits one `Read` request at `content_block_stop`.
- Unit test native `Read`/`View`/`Open` classification never falls back to `shell_command` when target paths are available.
- Unit test runtime worker creates pending `read_file` action with broker metadata and no `shell_command: <workspaceRoot>` fallback.
- Unit test runtime worker records discovered native session id and role agent id in pending broker metadata.
- Unit test approved action dispatch builds a native tool continuation prompt and preserves broker metadata in queued action result.
- Unit test approved action dispatch blocks broker `targetPaths` outside the selected workspace root.
- Unit test worker running/terminal updates preserve `job.actionResult` broker metadata.
- UAT must approve at least one real Claude `Read` permission on the fixed sample and inspect DB rows before approval, during running, and after terminal update.

### 7. Wrong vs Correct

#### Wrong

```typescript
const command = `${request.actionKind}: ${job.cwd}`;
await db.from('actions').insert({
  action_type: request.actionKind,
  command,
  result: { source: 'runtime_permission_broker', targetPaths: [] },
});

await enqueueRuntimeJob({
  prompt: `Command: ${command}`,
  cwd: job.cwd,
});
```

#### Correct

```typescript
const result = {
  source: 'runtime_permission_broker',
  toolCallId: request.id,
  toolName: request.toolName,
  actionKind: request.actionKind,
  input: request.input,
  targetPaths: request.targetPaths,
  cwd: job.cwd,
  workspaceRoot: job.workspaceRoot,
  runtimeType: job.runtimeType,
  roleAgentId: job.roleAgentId,
  nativeSessionId,
  runtimeSessionId: job.runtimeSessionId,
  originalRuntimeSessionId: job.runtimeSessionId,
};

await db.from('actions').insert({
  action_type: request.actionKind,
  command: `Read: ${request.targetPaths[0]}`,
  cwd: job.cwd,
  result,
});

await enqueueRuntimeJob({
  prompt: buildApprovedNativeToolContinuationPrompt(result),
  cwd: job.cwd,
  nativeSessionId: result.nativeSessionId,
  roleAgentId: result.roleAgentId,
  actionResult: result,
});
```

The correct path treats approval as continuation of a specific native tool request, not as a synthetic shell command.
