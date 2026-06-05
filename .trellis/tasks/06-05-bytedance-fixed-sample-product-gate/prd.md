# 固定样本 Bytedance Product Gate Completion

## Goal

Use the fixed prompt as the acceptance standard for the real Bytedance AgentHub product flow:

```text
做一个加减乘除的简单网站，使用sqlite存储历史记录
```

The generated calculator + SQLite product must work, but product acceptance is only complete when AgentHub itself demonstrates the original Bytedance multi-Agent IM workflow: Orchestrator first response, explicit frontend engineer assignment, orchestrated execution, permission/approval control, Git/change/file/code-reference visibility, final Orchestrator validation, and three-surface readback.

## Source Of Truth

- Highest product source: `bytedance_init_prd.md`
- Supporting source: `bytedance_init_video_txt.txt`
- Public tracker: `research/project-tracker.md`
- Sequential queue: `research/sequential-execution-progress.md`
- Acceptance spec: `.trellis/spec/cross-layer/real-flow-acceptance.md`
- Prior blocker report: `research/execution-reports/approved-native-tool-execution-result-uat-2026-06-05.md`

## Current Baseline

Session `bd36feef-c731-45c8-8551-b1f29fb4940c` proved:

- Orchestrator/architect first response exists.
- Backend engineer node completed.
- Frontend engineer node/mailbox exists but remains `waiting`.
- Architect summary node remains `waiting`.
- Approved native tool execution-result continuation is fixed.
- Calculator + SQLite artifact works on Web/Mobile product UI.
- `/tmp` destructive validation command was correctly rejected by workspace isolation.

Therefore the prior task is accepted for the permission/result blocker only. The Bytedance product gate remains partial.

## Requirements

- Start from a clean committed worktree and use a real acceptance stack.
- Use the fixed prompt from the real AgentHub IM entry.
- The first assistant-visible response must be an Orchestrator/architect message with a concrete plan and explicit frontend engineer assignment.
- The frontend engineer must receive a durable plan node, mailbox item, attempt, and runtime execution, then complete through the Orchestrator-managed flow.
- Backend engineer execution must exist when SQLite/storage/backend work is required.
- Orchestrator must produce final summary/validation after worker completion or the run must be reported as partial/blocked with exact DB evidence.
- Permission requests must use real `actions` APIs for approve/reject. Rejecting workspace-outside paths is correct security behavior but cannot be counted as full product completion.
- Git/change state, file tree, and code/file references must be visible or queryable through AgentHub surfaces.
- Web and Mobile/PWA UAT must use OpenCLI. Electron should use OpenCLI if an AgentHub app adapter exists; otherwise Playwright Electron fallback is allowed and must be stated.
- Do not use fake/script runtime or direct DB mutation to satisfy product flows.
- Do not start not-yet-started P2 features such as deployment publishing, PPT browsing, version history, or selected local code edits.

## Acceptance Criteria

- [ ] OpenCLI Web sends or resumes the fixed prompt from the real workspace/session UI.
- [ ] DB evidence records `plans`, `plan_nodes`, `agent_mailbox_items`, `plan_node_attempts`, `runtime_sessions`, `messages`, and `actions`.
- [ ] Orchestrator first response and frontend engineer assignment are visible in Web and durable in DB.
- [ ] Frontend engineer node completes or the run is explicitly marked blocked with a valid permission/runtime reason.
- [ ] Architect summary/validation completes after worker nodes, or the report marks product gate partial.
- [ ] Permission approval and rejection are tested with real `/api/actions/:id/approve`.
- [ ] File tree/readback, code/file references, and Git/change state are verified through AgentHub UI/API.
- [ ] Calculator API/UI passes add/sub/mul/div, divide-by-zero, invalid input/operator, and SQLite history persistence.
- [ ] Mobile/PWA reads back the same session orchestration and permission state.
- [ ] Desktop/Electron evidence covers runtime supervision/build smoke or OpenCLI app-adapter UAT.
- [ ] `research/project-tracker.md`, `research/sequential-execution-progress.md`, and a new execution report are updated with pass/partial/blocked status.

## Non-Goals

- Do not implement or start P2 deployment publishing.
- Do not implement rich doc/PPT/version history/local selected edit features.
- Do not weaken workspace isolation to force a plan to complete.
