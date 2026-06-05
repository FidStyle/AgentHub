# Frontend Workbench User Flow Closure Report

Date: 2026-06-06

Task: `.trellis/tasks/06-06-frontend-workbench-user-flow-closure`

TASK-ID: `FRONTEND-WORKBENCH-USER-FLOW-CLOSURE-2026-06-06`

Regression closed: `REG-20260606-001`

## Result

PASS for the scoped P0 frontend workbench closure. The Web workbench now exposes the user-visible path that was missing after backend/runtime product delivery passed:

- Chat transcript keeps role acknowledgement and process messages visible.
- Permission cards use approval wording (`已允许`, `已执行`) instead of using `执行中` as approval state.
- Right workbench tabs are split into `角色 / 编排 / 文件 / Git / 产物`.
- Git is single-purpose and progressive: file list first, selected file diff second.
- File preview exposes selection quote and patch draft controls.
- Code blocks expose `引用代码`.
- Runnable artifacts can generate a persistent workspace-relative launch script and command.

## Implementation Summary

| Area | Change |
| --- | --- |
| Transcript | `session-store` no longer filters `role_acknowledgement`; streamed acknowledgement events become visible messages. |
| Permission UI | `MessageContent` maps approved/running to `审批状态：已允许` and completed to `审批状态：已执行`; pending action remains `允许本次操作 / 拒绝`. |
| Code reference | `MessageMarkdown` adds `引用代码`; `ChatPanel` listens for `agenthub:quote-to-composer`; `FileTreeTab` adds `引用选区`. |
| Workbench tabs | `ArtifactPanel` replaces mixed `变更` with `编排` and `Git`; Git tab no longer renders orchestrator/runtime records. |
| Git disclosure | Git rows have `data-testid="git-change-row"` and file buttons; clicking file opens selected diff. |
| Artifact launch | Added `POST /api/artifacts/:id/launch-script`; scripts are written under `.agenthub/run-artifact-*.sh` and metadata stores `startCommand` / `startScriptPath`. |
| Spec | `.trellis/spec/frontend/component-guidelines.md` now contains Scenario `用户可见工作台闭环`. |

## Automated Evidence

```bash
pnpm --filter @agenthub/web test -- __tests__/message-markdown.test.ts __tests__/workspace-files-artifacts.test.ts __tests__/session-store.test.ts
```

Result: PASS, 3 files / 38 tests.

```bash
pnpm --filter @agenthub/web type-check
```

Result: PASS.

```bash
git diff --check
```

Result: PASS.

```bash
python3 ./.trellis/scripts/task.py validate .trellis/tasks/06-06-frontend-workbench-user-flow-closure
```

Result: PASS.

## OpenCLI Web UAT Evidence

Environment:

- `opencli doctor`: daemon and extension OK.
- `pnpm dev:acceptance`: started Postgres, Redis, Web server and runtime worker.
- Browser session used acceptance test auth cookie from `docker/.acceptance.env`.

Workspace/session:

| Item | Value |
| --- | --- |
| Workspace | `58a63e3f-5ca7-457b-af02-2824d02ab9fa` |
| Session | `bbea8366-1e19-4ccc-9eb7-2a5d2fde6dbe` |
| Runnable artifact created for this UI check | `7f65e4b8-8b42-4770-aa8e-c8b5e8d6f097` |
| Generated start command | `bash .agenthub/run-artifact-7f65e4b8-8b4.sh` |

Screenshot directory:

```text
e2e/artifacts/opencli-uat/frontend-workbench-user-flow-closure-2026-06-06/
```

Evidence files:

| Screenshot | Assertion |
| --- | --- |
| `workbench-tabs.png` | Right workbench shows `角色 / 编排 / 文件 / Git / 产物`, no horizontal overflow. |
| `git-tab.png` | Git tab is single-purpose and shows file rows, not orchestrator/runtime records. |
| `git-diff.png` | Clicking a Git file reveals `git-diff-preview` for that selected file. |
| `files-tab.png` | File tree and file preview entry are visible. |
| `file-editor.png` | Opening `README.md` shows `选区编辑草案`, `引用选区`, and `生成 diff`. |
| `artifacts-tab.png` | Artifact cards show an `启动产物` panel and non-runnable state for document/deployment artifacts. |
| `runnable-artifact-before-script.png` | Runnable HTML artifact shows `生成启动脚本`. |
| `runnable-artifact-after-script.png` | Clicking `生成启动脚本` produces `bash .agenthub/run-artifact-7f65e4b8-8b4.sh` and `复制启动命令`. |

OpenCLI DOM checks also confirmed:

- `artifact-tab-角色`, `artifact-tab-编排`, `artifact-tab-文件`, `artifact-tab-Git`, `artifact-tab-产物` are present.
- Git tab has `11` `git-change-row` entries; selected manifest diff appears only after file click.
- `document.body.scrollWidth <= innerWidth + 1` for checked states.

## Non-Passing Adjacent Check

`pnpm env:acceptance:smoke` was run while the acceptance stack was up. CRUD passed and cloud SSE connected, but the chat smoke failed because `verify-acceptance-chat-api.ts` did not observe a required explicit runtime terminal event:

```text
SUMMARY: 10 passed, 1 failed, status=FAIL
cloud SSE 有明确 runtime 终态 ... failed
```

This is recorded as an adjacent runtime/chat acceptance issue and is not counted as a pass for this frontend workbench task. The scoped frontend UI and artifact launch checks above use direct focused tests plus OpenCLI browser UAT evidence.

## Residual Risk

This task fixed and verified Web user-visible workbench closure. It did not rerun a fresh strict single-prompt full product delivery gate, and it did not claim Mobile/PWA or Desktop/Electron parity for the newly split workbench UI. Those remain governed by their existing strict product delivery and three-surface gates.
