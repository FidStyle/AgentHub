# Fix Approved Native Tool Execution Result

## Goal

Fix the fixed-sample P0 blocker where approving a Claude native tool action resumes the native session but does not actually satisfy the approved tool request. The approved tool must execute once under the selected workspace boundary, then the original role runtime may continue to the next step without repeating the same pending action.

## Source Of Truth

- Highest product source: `bytedance_init_prd.md`
- Supporting source: `bytedance_init_video_txt.txt`
- Current fixed-sample UAT task: `.trellis/tasks/06-05-opencli-role-runtime-uat/prd.md`
- Contract: `research/contracts/ROLE-RUNTIME-WORKSPACE-PERMISSIONS-2026-06-03.md`
- Spec: `.trellis/spec/backend/runtime-workspace-contract.md`
- Evidence: `e2e/artifacts/opencli-uat/role-runtime-uat-rerun-2026-06-05/`

## Blocking Evidence

Fixed sample session `4475f073-f580-40cc-8409-ab836a98c610` reached a valid `Write` approval for:

```text
/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2/server.js
```

After approving action `a563a3d7-9e25-4e55-bd98-e115e580d0a1`, the continuation runtime produced another identical pending `Write` action `35a92485-ea1a-49fc-84f4-83062b320967` instead of executing the approved native tool and returning the tool result to the resumed Claude session.

## Requirements

- Approval dispatch must preserve broker metadata: tool id/name/input/target paths/cwd/workspace root/runtime type/role/native session.
- For supported file tools (`Read`, `Write`, `Edit`, `MultiEdit`), AgentHub must execute the exact approved native tool once inside the selected workspace boundary and pass the tool result into the resumed CLI invocation.
- The worker must suppress the first matching already-executed approved tool request from re-entering the AgentHub permission broker; a different or later tool request must still create a new pending action.
- If the approved tool executes and the resumed runtime then asks for the next permission, the already approved action must not be marked failed. It should be recorded as completed with evidence that execution reached the next approval boundary.
- Workspace root checks must remain strict. Do not use global `--dangerously-skip-permissions` or any broad bypass.
- Fixed sample UAT must continue to request distinct follow-up permissions when needed, but must not repeat the same approved `Read`/`Write` action indefinitely.

## Acceptance Criteria

- [ ] Unit tests prove Claude approved native tool continuations carry broker-executed approved tool metadata/result.
- [ ] Unit tests prove the executor suppresses exactly one matching approved native tool request and does not suppress different tool requests.
- [ ] Unit tests prove a previously approved action is not marked failed when the continuation reaches a new permission boundary after executing the approved tool.
- [ ] Web/Mobile/Electron fixed-sample UAT is re-run with OpenCLI/Web + OpenCLI Mobile/PWA + Electron fallback if needed.
- [ ] Public ledgers and reports record the rerun result and any remaining blocker before moving to P1.

## Bytedance Fixed-Sample Product Gate

The approved native tool fix may be accepted only for its own blocker. It must not be used to claim the full Bytedance product flow complete unless the fixed prompt:

```text
做一个加减乘除的简单网站，使用sqlite存储历史记录
```

also proves the following end-to-end AgentHub flow from the real IM entry:

- The first assistant-visible response is an Orchestrator/architect response that plans the work and explicitly assigns the frontend engineer.
- The assigned frontend engineer receives a durable orchestrated work item and contributes through the Orchestrator-managed flow, not an out-of-band script-only path.
- The Orchestrator progresses the plan through implementation steps and final validation/summary after worker completion.
- Permission control, approval/rejection, workspace file tree/readback, code/file reference, and Git/change evidence are visible or queryable through AgentHub surfaces.
- Web, Mobile/PWA, and Desktop/Electron acceptance evidence covers the AgentHub orchestration surfaces, not only the generated calculator product URL.

Current fixed-sample status: approved-result continuation and calculator artifact verification passed, but the full Bytedance product gate is still partial because the frontend node and architect summary remain waiting after a valid permission boundary.

## Non-Goals

- Do not implement not-yet-started P2 rich document/PPT work.
- Do not weaken workspace isolation.
- Do not replace real runtime UAT with fake/script executor.
