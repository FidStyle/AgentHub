# Fix Approved Native Tool Continuation

## Goal

Fix the blocked OpenCLI UAT finding where approving a native CLI tool request starts a new malformed shell action instead of resuming or faithfully executing the approved tool request inside the selected workspace root.

## Background

Task `06-05-opencli-role-runtime-uat` ran the fixed sample:

- Workspace root: `/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2`
- Prompt: `做一个加减乘除的简单网站，使用sqlite存储历史记录`

The runtime correctly created a permission card for a Claude native `Read` tool request, but approval dispatched a new runtime prompt containing:

```text
shell_command: /Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2
```

That is not the original tool operation. The approved runtime therefore completed by asking for a real command instead of continuing the original `Read` action.

## Requirements

- Preserve enough native tool request metadata to execute or continue the approved action faithfully.
- Do not convert non-shell native tools into malformed shell commands.
- Approved actions must re-check `cwd`, `workspaceRoot`, target paths, and absolute command/path tokens before dispatch.
- Reject behavior must remain exact: `已拒绝，未执行该操作。`
- Approved execution must remain constrained to `/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2` for the fixed sample.
- The fix must not reintroduce fake/script runtime success into product UAT.
- Mobile/PWA must be able to read back pending/decided permission state durably, or the report must explicitly split that as a separate defect if out of scope.

## Acceptance Criteria

- [ ] Unit/API coverage proves approved `Read`/file-read style native tool requests are not transformed into `shell_command: <workspaceRoot>`.
- [ ] Approved native tool dispatch carries the selected workspace root and blocks outside-root cwd/path attempts.
- [ ] Reject path still persists `rejected` and shows `已拒绝，未执行该操作。`.
- [ ] Re-run Web OpenCLI fixed-sample UAT through the first approval and verify the approved action continues meaningfully instead of asking for a missing command.
- [ ] Re-run Mobile/PWA OpenCLI readback for the same session/action.
- [ ] Re-run Electron fallback or OpenCLI app adapter if available.
- [ ] Update `research/execution-reports/opencli-role-runtime-uat-2026-06-05.md` or create a new rerun report with exact pass/fail evidence.

## References

- `research/execution-reports/opencli-role-runtime-uat-2026-06-05.md`
- `research/contracts/ROLE-RUNTIME-WORKSPACE-PERMISSIONS-2026-06-03.md`
- `research/contracts/ACCEPTANCE-REAL-FLOW-2026-06-01.md`
- `.trellis/spec/backend/runtime-workspace-contract.md`
- `.trellis/spec/cross-layer/real-flow-acceptance.md`
- `.trellis/spec/cross-layer/runtime-gateway-contract.md`
