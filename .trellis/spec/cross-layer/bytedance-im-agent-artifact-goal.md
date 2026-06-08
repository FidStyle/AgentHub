# Bytedance IM / Agent / Artifact Goal Contract

## Purpose

This file is the durable plan file for `/goal` mode when continuing the Bytedance P1 completion work. The goal text should stay short and reference this file; this file carries the detailed scope, decisions, phase plan, and acceptance evidence requirements.

## Source Priority

Use this source order when resolving conflicts:

1. `bytedance_init_prd.md`
2. `bytedance_init_video_txt.txt`
3. `research/prd.md`
4. `research/product/product-design.md`
5. `research/architecture/technical-design.md`
6. Current user decisions recorded in this file
7. Current implementation and historical reports

Historical pass reports are leads only. They are never final evidence for this goal.

## Scope

### In Scope

- Remaining Bytedance P1 IM, Role Agent, tool, artifact, file, Git, publish, and three-surface readback requirements.
- Fresh Web user flow from a single prompt to visible product delivery.
- Role Agent direct chat, group chat, Orchestrator coordination, message operations, and inline rich artifact cards.
- Concrete built-in tool selection for Role Agents.
- Web full operation plus Mobile/PWA and Desktop/Electron light readback, approval, preview, and status coverage.
- Focused phase tests during implementation.
- One final fresh Bytedance Real-Step UAT after all phases are complete.

### Out Of Scope

- Not-yet-started P2 work unless needed to make a P1 requirement honest.
- Demo video and 3-minute presentation material.
- Release history, rollback release timelines, or historical deployment archives.
- Full collaborative online PPT editing.
- User-defined custom tool plugins.

## Locked Product Decisions

| Area | Decision |
| --- | --- |
| Source of truth | Bytedance original PRD is the highest product source. |
| Capability tags | Display-only tags rendered as colored `#xxx`; stored without `#`; user can add/delete; tags do not grant permission. |
| Tools | Toolset means concrete built-in tools, not abstract categories. |
| Built-in tools v1 | `file_read`, `file_write`, `shell`, `git_cli`, `web_search`, `web_fetch`, `browser_preview`, `diff_apply`, `artifact_store`, `publish_service`, `ppt_master`. |
| Runtime | Claude Code, Codex, and OpenCode are runtime bindings, not tools. |
| Permission | Enabling a tool only lets an Agent request it. Actual execution still follows permission mode and approval policy. |
| Direct chat | Direct chat routes to that Agent by default. Only explicit `@Orchestrator` or Agent escalation enters Orchestrator flow. |
| Group chat | New group chat includes Orchestrator by default. Orchestrator coordinates unless the user directly `@` mentions a participant. |
| Agent creation | User asks in chat to create an Agent; system returns an editable draft card with name, System Prompt, `#tags`, concrete tools, and runtime before saving. |
| Message operations | P1 includes reply, quote, regenerate, copy code, one-click apply diff, and expand preview. |
| Regenerate | Regenerate reruns that Role Agent's previous input/context only; it does not rerun the whole orchestration by default. |
| Quote | Quote supports message, code/file selection, diff snippet, and whole artifact card. |
| Artifact placement | Inline chat cards are primary. Right panel is details, list, file editor, and fullscreen workspace. |
| Web preview | Preview a started service URL in the current interface. Do not treat static HTML `srcDoc` rendering as the publish preview. |
| Publish | Publish/start gives the user a link and preview. Stop publish shuts the service down. Full-control mode may auto-start after final artifact confirmation. |
| Preview URL | External preview URL must use environment configuration such as `PUBLIC_PREVIEW_BASE_URL`, not hardcoded localhost. |
| PPT | Use `ppt_master` to generate editable `.pptx`; produce PDF or equivalent preview when supported; card supports preview, download, and expand. |
| Diff apply | Full-control can auto-apply; standard/manual creates approval card; reject stops that action. |
| Attachments | Uploaded files/images render as attachment cards and pass as Agent context references. Full multimodal understanding is not required for P1. |
| Git | P1 includes status tree, stage/unstage, commit, commit diff, and reset hard with a strong irreversible warning. |
| Files | Text-like files are directly editable in the right viewer; binary files are read-only. Quote-to-AI remains available. |
| Folder download | User can download a folder as an archive. |
| Three surfaces | Web is full operation. Mobile/PWA and Desktop/Electron provide light readback, approval, preview, and status. |

## Phase Plan

### Phase 1: IM, Agent, Tool Model

Goal:

- Make the IM information architecture match Bytedance requirements: contacts and groups are first-class, direct chat and group chat are distinct, Role Agents are visible contacts, and tools/tags/runtime are separate concepts.

Required work:

- Ensure conversation list supports new, pin, archive, search, and sorting by pinned first then recent activity.
- Ensure Role Agents appear as contacts with avatar/name/colored `#tags` and runtime/tool summary.
- Ensure direct chat binds exactly one Agent and rejects sending to another Agent.
- Ensure group chat stores participants, includes Orchestrator by default, and rejects mentions outside the group.
- Replace abstract toolset handling with concrete `enabled_tool_ids` from the built-in catalog.
- Keep `capability_tags` as display-only colored `#xxx` tags.
- Add or keep `GET /api/tools/catalog`.
- Add or keep conversation-based Agent draft creation.

Focused evidence:

- API and DB tests for contacts/groups/session sorting.
- API tests for role-agent draft, create, update, invalid tool rejection, and runtime-as-tool rejection.
- Web UI test showing tags/tools/runtime separated.
- Mobile/PWA and Desktop/Electron readback for the same Agent/contact data.

### Phase 2: Message Operations, Rich Media, File, Git

Goal:

- Make chat messages operational, not just textual. The user can reply, quote, regenerate, copy code, apply diffs through approval, preview artifacts, edit files, and manage Git from the workbench.

Required work:

- Implement message operations: reply, quote, regenerate, copy code, one-click apply diff, expand preview.
- Render message part types for text, code block, image, file attachment, web preview card, diff card, artifact card, and optional publish status card.
- Ensure diff cards create pending actions instead of mutating files directly before permission approval.
- Ensure runtime command cards show a concise command preview, not verbose raw JSON.
- Ensure selected file/code content can be quoted into the composer with file path and line range.
- Make text-like files directly editable and savable in the right viewer.
- Detect binary/text by file content where possible, not only by extension.
- Support folder archive download.
- Make Git show a file-like status tree, default collapsed, with stage/unstage actions, commit, commit diff, and reset hard warning flow.

Focused evidence:

- Component/API tests for each message operation.
- Browser tests for quote-to-composer from message, file selection, diff snippet, and artifact card.
- API/DB tests for diff action creation and permission state.
- Workbench tests for file edit/save, folder archive download, Git stage/unstage/commit/diff/reset warning.

### Phase 3: Publish, PPT, Three-Surface Closure

Goal:

- Make final artifacts usable from the chat flow and current UI. Publish/start and stop are user-facing controls; PPT/document/web previews are reusable artifact cards; all P1 claims are checked on Web/Mobile/Desktop.

Required work:

- Put final artifact cards inline in the Agent reply, with preview/download/expand/open actions.
- Keep right-panel artifact list/details as secondary.
- Put publish/start access at the top of the artifact area.
- Implement publish/start and stop publish as controls; do not require users to copy commands.
- Preview web artifacts through a started service URL in an iframe or equivalent current-interface preview.
- Render Markdown documents as artifact previews with image reference support.
- Generate PPT artifacts through `ppt_master` when requested and expose downloadable `.pptx` plus preview fallback.
- Ensure full-control calculator prompt can run from one user message to final product delivery and auto-start when policy allows.
- Ensure manual allow and manual reject permission paths remain distinct and visible.
- Run final fresh Bytedance Real-Step UAT only after all phase tests pass.

Focused evidence:

- Publish service start/stop API and UI tests.
- Artifact card preview/download/expand tests.
- PPT generation tests that either produce real `.pptx` or fail visibly with dependency/workspace error.
- Web/Mobile/PWA/Desktop/Electron readback for same session/artifact/permission states.
- Final fresh Bytedance UAT evidence.

## Final UAT Contract

Run the final gate only after the three phases pass focused tests.

Final UAT must follow:

- `.agents/skills/bytedance-real-step-uat/SKILL.md`
- `.trellis/spec/cross-layer/real-flow-acceptance.md`
- `.trellis/spec/cross-layer/real-flow-bytedance-uat.md`
- `research/contracts/BYTEDANCE-P0-P1-REAL-STEP-UAT.md`

Canonical prompt:

```text
做一个加减乘除的简单网站，使用sqlite存储历史记录
```

The final run must use:

- A fresh workspace.
- A fresh session.
- A fresh marker.
- Real current UI/API paths.
- Real runtime messages and role handoffs.
- Evidence recorded for Web, Mobile/PWA, and Desktop/Electron.

Minimum final evidence:

- `sessionId`, `workspaceId`, `planId`, artifact IDs, and fresh marker.
- `GET /api/messages?session_id=<sessionId>` readback.
- `GET /api/sessions/<sessionId>/timeline` readback.
- DB/readback evidence for messages, plans, nodes, mailbox items, actions, runtime sessions, artifacts, and role handoffs.
- Permission evidence for full-control, manual allow, and manual reject.
- Workbench evidence for Git, file tree, code references, file edit, artifact, publish/start-stop, and refresh/readback.
- Product evidence for add/subtract/multiply/divide, validation guards, SQLite insert/readback, refresh persistence, and history ordering.

Completion rule:

- Do not say `完全通过` unless every required P1 line in the current fresh run is `pass`.
- Any `partial`, `blocked`, `not-run`, skipped surface, missing readback, historical-only evidence, or fake/mock runtime success means the goal remains incomplete.

## Suggested `/goal` Text

```text
/goal 按 .trellis/spec/cross-layer/bytedance-im-agent-artifact-goal.md 完成 Bytedance 原始 PRD 的剩余 P1 功能，直到所有阶段测试和最终一次全新 workspace 的 Bytedance 全真实验收通过。验收必须证明：真实 Orchestrator 编排、真实角色会话消息、权限控制、Git、文件树/编辑/引用、富媒体消息、内联产物、发布启动/停止、Agent 联系人/群聊、自建 Agent、具体工具集、三端读回均符合标准。只做 P1，未开始的 P2、Demo、3 分钟素材不做。每阶段完成后运行对应测试并修复失败，最终提交 commit。若无法继续，必须给出已尝试路径、真实证据、阻塞原因和解锁条件。
```

## Blocked Reporting

If work cannot continue, report:

- The phase and requirement that is blocked.
- What was attempted.
- The current evidence path, command, session ID, workspace ID, or API response.
- Why the blocker prevents honest P1 completion.
- The smallest user input, dependency, environment change, or design decision needed to unblock.

Do not mark the goal complete because a budget is low, a historical report passed, a unit test passed, or the generated calculator product alone works.
