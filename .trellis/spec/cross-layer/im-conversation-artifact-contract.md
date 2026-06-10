# IM Conversation and Artifact Contract

## Scenario: Contacts, Groups, Rich Artifact Cards

### 1. Scope / Trigger

- Trigger: any change to Web IM contacts, session list, rich message cards, presentation generation, publish preview, or diff apply from IM.
- Applies to: `packages/shared/src/domain/*`, `docker/postgres/acceptance-schema.sql`, `/api/conversations*`, `/api/chat`, `/api/role-agents*`, `/api/artifacts*`, `/api/workspaces/:id/diff/apply`, `session-store`, `SessionList`, `ChatPanel`, and `MessageContent`.
- Role Agent tags/tools/runtime follow the project-wide contract in `role-agent-tools-contract.md`.

### 2. Signatures

- `GET /api/conversations?workspace_id=...&status=active|archived|all`
- `POST /api/conversations/groups` with `{ workspace_id, name, participant_role_agent_ids[] }`
- `PATCH /api/sessions/:id` with `{ name?, status?, is_pinned? }`
- `POST /api/role-agents/draft` with `{ workspace_id, prompt }`
- `POST /api/chat` with normal user text that expresses Agent creation intent, e.g. `创建一个文档工程师`
- `POST /api/artifacts/presentations/generate` with `{ workspace_id, session_id?, source_path?, prompt?, title? }`
- `POST /api/artifacts/:id/preview`
- Approved action dispatch for `action_type="presentation_generate"` or `action_type="ppt_generation"`.
- `POST /api/workspaces/:id/diff/apply` with `{ session_id, message_id?, diff }`
- DB: `sessions.chat_kind`, `sessions.direct_role_agent_id`, `sessions.participant_role_agent_ids`, `sessions.is_pinned`, `sessions.pinned_at`, `sessions.last_activity_at`, `session_participants`, `role_agents.capability_tags`, `role_agents.enabled_tool_ids`.

### 3. Contracts

- Contact rows are derived from `role_agents`; they are not deleted or hidden by archiving a direct session.
- Web IM entry points are contacts and groups. Loading a workspace must not auto-create an empty chat or auto-open the first row; users choose a contact or group, and direct sessions are created lazily only after selecting a contact.
- Mobile/PWA `/m` uses the same conversation entry model as Web: workspace selection must load `GET /api/conversations` and render contact/group rows. It must not regress to the legacy `/api/sessions` blank-chat list or expose a generic “new empty chat” primary path. Contact taps lazily create direct sessions through `POST /api/sessions` with `chat_kind="direct"` and `direct_role_agent_id`; group rows open their existing `sessionId`.
- Unauthenticated Mobile/PWA `/m/*` requests redirect to `/m/login?callbackUrl=<original mobile path>` instead of the desktop root `/`. `/m/login` reuses the existing GitHub/Auth.js sign-in and may only redirect to sanitized `/m...` callback paths.
- Direct sessions bind one `direct_role_agent_id`; `/api/chat` rejects attempts to target a different role.
- Group sessions bind participant role IDs; `/api/chat` rejects mentions outside participants and defaults to the group orchestrator or all participants.
- Conversation sorting is pinned first, then `lastActivityAt desc`.
- Role Agent tags/tools/runtime are not defined here; use `role-agent-tools-contract.md`.
- Conversational Role Agent creation is a chat-first flow. When the user asks to create/configure/add an Agent in a normal conversation or direct chat with `Agent 创建助手`, `/api/chat` must persist an agent reply containing a `RuntimeMessagePart` with `type="agent_draft"`. The right Role Agent panel may manage/edit existing agents, but it must not contain a conversational draft creator, call `/api/role-agents/draft`, or render an `agent_draft` confirmation flow.
- Agent-draft intent must be explicit. Prompts that ask an existing architect/orchestrator to assign a backend/frontend/document/PPT engineer for implementation or permission validation are product-work requests, not Agent creation requests, even if they contain role names such as `后端工程师`.
- `Agent 创建助手` is a built-in contact from the default role-agent config. It can prepare drafts and explain tool/permission boundaries, but it must not execute engineering implementation work.
- Rich IM cards must use `RuntimeMessagePart` discriminants, not parse arbitrary text to infer card kinds.
- Diff apply creates a pending action; it does not directly mutate files before approval.
- Presentation generation must create a durable `presentation` artifact and a real `.pptx` file, or return an explicit dependency/workspace error.
- `presentation_generate` / `ppt_generation` actions are first-class `ppt_master` executions: after approval they must call the same presentation artifact service as `POST /api/artifacts/presentations/generate`, create the `.pptx`, persist the artifact row, and insert the IM `artifact` + `presentation_preview` result card. They must not fall through to generic Runtime enqueue after merely passing tool validation.
- Final artifact recommendation is agent/manifest first: if `.agenthub/delivery.json` exists, use its `source_path`, `artifact_type`, and optional `start_command` instead of asking the user to choose a file. Without a manifest, fallback scanning is typed: HTML -> `web_preview` iframe, Markdown/document -> `document_preview`, PPT/PPTX -> `presentation_preview`, runnable `package.json` -> service publish/start command.
- `publish_status` cards are only for artifacts with an explicit service start instruction (`startCommand` or `packageScript`). Static HTML and document-like artifacts must show preview/download cards and must not be forced through a publish command path.
- `full_control` and `dangerous_bypass` may auto-start a service artifact after final recommendation and must show a `publish_status` audit card with `status="running"` or `status="failed"`. Standard/sandbox/auto modes can recommend the same artifact after user-approved flow completion, but service start remains a user action through the publish controls.
- `full_control` / `dangerous_bypass` auto-approved permission cards are completed audit records, not pending approval boundaries. If runtime later fails after completed auto-approval cards, the plan/node must fail closed rather than showing `等待授权`.
- Product-delivery orchestration must include the built-in `产物助手` as the artifact closure role after implementation workers and before architect summary whenever the session membership allows it. `产物助手` owns final artifact registration, IM artifact/preview/publish cards, and right-side artifact list synchronization. It does not generate PPT content by default; PPT content generation belongs to `演示稿工程师` or another PPT-specific role such as a `ppt_master` role.
- PPT/product-delivery orchestration must route PPT intent (`PPT`, `演示稿`, `幻灯片`, `presentation`, `deck`) to `演示稿工程师` before `产物助手收口` when that role is available. Pure PPT tasks do not need frontend/backend workers unless the user also asks for web/service implementation.
- The right artifact panel is a read/operate surface for produced artifacts. It must not expose chat-bypassing “新建富文档” or “新建演示稿” buttons; users create or request artifacts in the conversation, and `产物助手` performs the delivery closure.
- A delivery run has one primary `final_product_candidate` used for launch/publish. Additional Markdown/document/PPT/image/static files found in the same closure may be inserted as `supporting_product_artifact` rows and preview parts so the right artifact list can show mixed outputs without redefining the launch entry.

### 4. Validation & Error Matrix

| Condition | Error / Behavior |
| --- | --- |
| Missing `workspace_id` | `400 缺少 workspace_id` |
| Chat asks to create an Agent | Persist user message, then persist an agent `result_card` with `metadata.runtimeParts[0].type="agent_draft"` and do not invoke runtime implementation |
| Chat asks an existing role to assign/execute implementation work | Route to Direct/Orchestrated Flow; do not emit `agent_draft` |
| Group has no participants | `400 至少选择一个联系人` |
| Group participant is not in workspace | `403 群聊联系人不存在或无权限` |
| Direct session missing bound contact | `409 单聊缺少绑定联系人` |
| Direct session targets another role | `400 单聊不能 @ 其他联系人` |
| Group mentions non-participant | `400 群聊只能 @ 已加入的联系人` |
| Invalid diff | `400 不是合法 unified diff` |
| Diff path outside workspace | `400 Diff 包含 workspace 外路径` |
| Presentation preview without `soffice` | `summary` fallback with slide summaries, not a claimed PDF preview |
| Approved `presentation_generate` action | Validate `ppt_master`, create `.pptx` + durable `presentation` row + IM preview card, then mark action completed |
| Approved `presentation_generate` cannot write/read source inside workspace | Fail the action and notification with an explicit workspace/dependency error; do not enqueue generic Runtime as fake completion |
| Final artifact is Markdown/document/PPT | Render preview/download card, no publish card unless manifest also declares a start command |
| Final artifact is service with start command | Persist artifact metadata and expose publish start/stop controls; full-control may auto-start and write running/failed status into the IM card |
| Product run generates web + Markdown/PPT | Web/service entry remains the primary final product; Markdown/PPT files are supporting artifacts with document/presentation preview cards |

### 5. Good/Base/Bad Cases

- Good: `GET /api/conversations` returns `contact` rows for role agents and `group` rows for group sessions in one sorted list.
- Base: a contact without a direct session is selectable; the UI lazily creates the direct session before loading messages.
- Good: user sends `创建一个文档工程师`, the chat transcript shows an `Agent 草稿` card with System Prompt, tags, runtime, concrete tools, and a `确认保存` action.
- Good: final architect summary writes `.agenthub/delivery.json` for a generated service, and the IM result card contains change summary, diff, artifact, web/service preview, and running publish status in full-control.
- Good: product delivery DAG shows `产物助手收口`; the result card is authored by `产物助手`, not the architect, and right-side artifacts are derived from the same durable artifact rows.
- Good: a PPT-only request creates `架构师规划 -> 演示稿工程师执行 -> 产物助手收口 -> 架构师汇总`, and the generated PPTX appears as a downloadable `presentation` artifact with a mobile preview fallback.
- Base: a generated Markdown file becomes a document preview card and downloadable artifact without a deployment button.
- Bad: `fetchSessions` auto-creates a blank session or auto-opens the first conversation, reintroducing a duplicate "new session" product path.
- Bad: self-built Agent creation only exists as a right-side form and cannot be started from normal chat.
- Bad: a manual permission verifier prompt mentions `后端工程师`, so `/api/chat` creates an `agent_draft` instead of dispatching the implementation action and permission card.
- Bad: the right artifact panel creates rich docs/presentations through local buttons while bypassing the chat transcript and artifact assistant closure.
- Bad: UI hides the role picker for direct chat but `/api/chat` still accepts a different `roleAgentIds` target.
- Bad: diff card applies patches immediately from the browser click without creating an approval action.
- Bad: PPT endpoint returns success while only storing JSON and no downloadable PPTX file.
- Bad: `presentation_generate` passes `ppt_master` validation but then queues a generic Runtime job instead of creating the PPTX/artifact/card.
- Bad: every artifact receives a publish card even when it is a Markdown/PPT/document render artifact.

### 6. Tests Required

- API tests for conversation merge/sort/filter and group creation.
- API tests for role-agent draft and the project-wide tool contract where this flow creates/updates agents.
- Chat API tests for conversational Agent creation intent producing an `agent_draft` message part without invoking runtime execution.
- Chat API tests for negative Agent-draft classification: implementation and permission-validation prompts with role names must not emit `agent_draft`.
- API tests for valid/invalid diff apply action creation.
- Chat API tests for direct/group recipient enforcement when those session fields are present.
- Chat API tests for final artifact recommendation by type: static HTML iframe without publish card, service manifest/package with publish status, and render-only document/presentation preview cards.
- Chat API tests for artifact-assistant closure role ownership, including result-card `role_agent_id`, plan node label `产物助手收口`, and mixed supporting artifacts when present.
- Dispatch tests for approved `presentation_generate` / `ppt_generation`: `ppt_master` validation, real `.pptx` write, artifact row, IM `presentation_preview`, action completion, and no generic Runtime enqueue.
- Store/component tests for `/api/conversations` consumption and contact/group rendering.
- E2E tests must enter direct chat by clicking a contact and group chat by creating/selecting a group; do not use a blank "new session" button as setup.
- Type-checks for shared `RuntimeMessagePart` union consumers, including Mobile/PWA.
- Mobile/PWA E2E must assert the `/m` conversation list, chat header, composer, and `/api/chat` send path. In no-worker runtime mode, immediate explicit error/notice is required, but persisted role process messages may remain visible after reload; tests must reject fake success replies rather than requiring zero role badges.
- Mobile/PWA auth E2E must assert unauthenticated `/m` and deep links redirect to `/m/login` with preserved callbackUrl, and authenticated users can still enter `/m` without a desktop-root bounce.

### 7. Wrong vs Correct

#### Wrong

- UI-only direct chat hides the role picker, but backend still accepts arbitrary `roleAgentIds`.
- User says `创建一个文档工程师`, but the product tells them to open the right-side Role Agent form.

#### Correct

- Backend owns the invariant and rejects direct-chat requests targeting any role other than `direct_role_agent_id`.
- Chat creates a durable `agent_draft` card first; clicking `确认保存` calls `POST /api/role-agents`, refreshes contacts, and the right panel remains an editing surface.
