# Bytedance PRD Gap Migration Map

Date: 2026-06-03
Primary source: `bytedance_init_prd.md`
Secondary source: `bytedance_init_video_txt.txt`

## 1. Stricter Source Reading

`bytedance_init_prd.md` is the most reliable product source for this analysis.

Key source anchors:

* `bytedance_init_prd.md:7-17`: AgentHub is an IM-first multi-Agent collaboration platform. Agent outputs include code, web pages, documents, PPT, real-time preview, secondary code editing, and one-click deployment.
* `bytedance_init_prd.md:27-32`: IM requirements include new/pin/archive/search/sort conversation list, message types, reply, quote, regenerate, copy code, apply Diff, expand preview, and pin context.
* `bytedance_init_prd.md:36-38`: Orchestrator should support task decomposition, delegation, aggregation, parallel scheduling, failure degradation, and code-conflict handling.
* `bytedance_init_prd.md:42-44`: Users can create Agents conversationally and each Agent appears as an IM contact with avatar, name, and capability tags.
* `bytedance_init_prd.md:48-50`: Artifacts need inline preview, full-screen preview/editor, Diff, version history, and selected-code conversational modification.
* `bytedance_init_prd.md:54-55`: Deployment requires chat command, deployment status card, preview URL, static site deployment, containerized deployment, and source package download.
* `bytedance_init_prd.md:61-63`: Web is full-featured, Desktop owns local file/notification/process management, Mobile is lightweight IM/approval/preview.
* `bytedance_init_video_txt.txt:53`: In the explanation, "all artifacts" include Feishu-like documents, Markdown documents, web pages, preview, editing, second interaction, and deployment to third-party platforms.
* `bytedance_init_video_txt.txt:65`: Document/PPT/code artifacts should support preview, editing, Diff, version history, and selecting partial content for conversational modification.

## 2. Migration Convenience Summary

User decisions on 2026-06-03:

* Deployment should start as self-hosted deployment on the user's server, not a full PaaS. Static artifacts go into a dedicated deploy folder and are exposed by Caddy under a single domain plus hash path. Docker deployments map to internal container ports, also exposed by Caddy under hash paths. NoSQL/state can be minimal first and upgraded later.
* Selected-code modification is primarily a Trae/Cursor-style workflow: reference the selected range so the Agent knows what to change, then let the Agent return a patch/diff for user confirmation. It does not need a full semantic refactor engine in the first version.
* Full code editing should be a small IDE/workbench.
* Version history can start simple: commit-based history is acceptable.
* PPT/rich document generation, preview, and basic editing should be treated as feasible because there are enough mature reference projects. Multi-user document collaboration is outside the current Bytedance acceptance scope.
* Orchestrator parallel scheduling, failure degradation, and code conflict handling still need deeper research.

| Bytedance gap | Current completion impression | Migration convenience | Directly useful candidates | Expected result after migration |
| --- | --- | --- | --- | --- |
| Conversation list pin/sort/search/archive | Mostly done except pin and strict active sort | Easy | assistant-ui, AI Elements, Zulip/Mattermost interaction patterns | 1-2 focused PRs: pin, active-sort, better search/filter, stable tests. |
| Message types | Markdown/code/attachment/diff/artifact exist; deploy/web/doc/PPT cards incomplete | Easy for UI, medium for data | AI Elements, Vercel Chatbot, bolt.new, PptxGenJS, Coolify | Card rendering can finish quickly; real deploy/PPT needs separate adapters. |
| Message actions | Copy exists; reply/quote/regenerate/apply-diff/expand preview missing | Easy to medium | assistant-ui, AI Elements, Zulip/Element/Rocket.Chat patterns, react-diff-view, Cline | Reply/quote/regenerate easy; apply Diff needs approval + patch pipeline. |
| Agent contact UX | CRUD exists; avatar/contact information architecture weak | Easy | AionUi, cherry-studio patterns, LobeHub/NextChat IA, AI Elements | Agent becomes IM contact with avatar/status/capabilities/contact detail. |
| User-created Agent via conversation | Form CRUD exists; conversational creation/toolset config incomplete | Medium | CopilotKit generative UI, assistant-ui, OpenHands/AionUi agent settings | Needs a wizard/agent-builder flow plus toolset schema. |
| Orchestrator advanced behavior | DAG/mailbox/retry/resume strong; parallel/fallback/conflict UX partial | Medium to hard | LangGraph, CrewAI, OpenAI Agents SDK, AutoGen, OpenHands, codeg | UI can improve quickly; robust parallel/conflict semantics require protocol/data work. |
| Artifact preview/editor | Right panel exists; no mature full-screen canvas/editor | Medium | Vercel Chatbot artifacts, bolt.new workbench, Monaco/CodeMirror | Full-screen artifact canvas and code editor are feasible with adapters. |
| Full code editing / selected code modification / version history | Basic file ops and Git diff exist, not full editor workflow | Medium | bolt.new, Monaco, CodeMirror, react-diff-view, isomorphic-git, Cline/Continue, Aider, Void, Zed, GitButler | Small IDE + Trae/Cursor-style selected range reference + commit history is practical; advanced conflicts remain harder. |
| Deployment publishing | Action risk type exists; no deploy product chain | Medium for self-hosted v1 | AgentHub self-host adapter, Caddy, Coolify, Dokploy, CapRover, OpenHands/bolt status UI | Static hash-path deploy and Docker hash-path reverse proxy are practical v1 targets. |
| PPT / rich document artifacts | Markdown/HTML/code/image/diff downloads exist; rich docs/PPT incomplete | Medium | PptxGenJS, Slidev, Marp, reveal.js, Tiptap, MDXEditor, docxjs, mammoth.js, AFFiNE/Docmost/Outline/AppFlowy, ONLYOFFICE | Generation, preview, and basic editing are feasible. Multi-user editing is out of scope. |
| Desktop local file/notification/process surface | Runtime doctor/process management exists; file/notification product surface partial | Medium | cherry-studio patterns, AionUi local agents, codeg transport, Electron APIs | Rebuild in AgentHub Desktop with typed IPC and shared visual components. |
| Mobile lightweight complete experience | PWA chat/approval/preview exists; native/full mobile experience incomplete | Medium | LobeHub/NextChat IA, Element/Zulip patterns, AI Elements local wrappers | PWA improvements feasible; native RN parity is separate work. |

## 3. What Should Be Easy Through Migration

### 3.1 IM list and message operations

Expected easy items:

* Conversation pin.
* Strict recent-active sorting.
* Better search/filter.
* Reply and quote preview.
* Regenerate last assistant response.
* Expand preview action.
* Message action bar consistency.

Why easy:

* These are mostly UI state, persisted flags, and API endpoints.
* Mature IM products already demonstrate the interaction shape.
* AgentHub already has session/message storage and pin infrastructure.

Migration sources:

* assistant-ui: message actions, composer/action anatomy.
* Vercel AI Elements: shadcn-style message/action primitives.
* Zulip / Mattermost / Element / Rocket.Chat: reference only for IM behaviors such as reply thread, quote, unread/recent ordering, contact/message density.

AgentHub implementation target:

* Add `conversation.pinned_at` or equivalent session pin field.
* Add `reply_to_message_id`, `quoted_message_snapshot`, and `regeneration_of_message_id` message metadata.
* Render actions through AgentHub shared message action components.

### 3.2 Agent contact experience

Expected easy items:

* Agent avatar.
* Contact-style role list.
* Agent profile drawer.
* Capability tags and runtime status summary.
* "Start single chat with this Agent" action.

Why easy:

* AgentHub already has Role Agent CRUD, system prompt, runtime type, capability tags.
* Missing work is mostly information architecture and UI polish.

Migration sources:

* AionUi local agent cards and chat layout.
* cherry-studio settings density and grouping, rebuilt cleanly.
* LobeHub/NextChat contact IA as reference.

AgentHub implementation target:

* `AgentContactCard`, `AgentContactDrawer`, `RuntimeCapabilityBadge`.
* Keep Runtime names diagnostic/config-only; the chat object is Role Agent, not Codex/Claude itself.

### 3.3 Basic artifact cards and full-screen preview

Expected easy-to-medium items:

* Web preview card.
* Deploy status card UI shell.
* Document/PPT card shell.
* Full-screen artifact canvas shell.
* Expand preview action.

Why easy:

* AgentHub already persists artifacts and previews several file types.
* Vercel Chatbot and AI Elements provide mature component structure.

Migration sources:

* Vercel Chatbot artifact directories.
* bolt.new workbench preview shell.
* AI Elements response/tool/card patterns.

AgentHub implementation target:

* `ArtifactCard`, `ArtifactCanvas`, `ArtifactActions`, `PreviewFrame`, `ArtifactStatusCard`.
* Real content still comes from AgentHub artifact APIs, not message text.

## 4. What Is Not Yet Easy And Needs More GitHub-Backed Migration

### 4.1 Deployment publishing

Bytedance target:

* Chat command "deploy".
* Deployment status card.
* Preview URL.
* Static site deployment.
* Containerized deployment.
* Source package download.

Why self-hosted v1 is now practical:

* User has a server and wants one external domain plus hash paths.
* Static artifacts can be served directly from a dedicated deployment folder.
* Docker apps can bind internal ports; Caddy can reverse proxy `/{hash}` or a hash-scoped route to the internal port.
* A minimal NoSQL or file-backed deployment registry is acceptable for v1.

What remains non-trivial:

* Build packaging, env/secrets, deployment logs, rollback/failure states, and audit still need explicit product contracts.
* Hash-path reverse proxy must handle static assets, base paths, client routing, and security boundaries.
* Docker deploy needs port allocation, process health, log streaming, cleanup, and collision handling.

Best migration candidates:

| Candidate | Repo | Fit | How to use |
| --- | --- | --- | --- |
| Coolify | https://github.com/coollabsio/coolify | Strongest self-hosted PaaS reference; Apache-2.0; covers static, full-stack, services | Prefer external integration adapter or rebuild deployment run model/status UI from its concepts. |
| Dokploy | https://github.com/Dokploy/dokploy | Vercel/Netlify/Heroku alternative; deployment product model | Spike API and status model; likely reference/integration rather than source migration. |
| CapRover | https://github.com/caprover/caprover | Docker/nginx PaaS model | Useful for container deployment states and rollback concepts. |
| bolt.new | https://github.com/stackblitz/bolt.new | Deployment/workbench UX inspiration | Use status-card and preview interaction, not execution substrate. |

Recommended AgentHub route:

1. Add `DeploymentRequest`, `DeploymentRun`, `DeploymentArtifact`, `DeploymentLog`, `PreviewUrl`, `DeploymentRoute` shared types.
2. Implement `deploy` as an approved Action type.
3. Static v1: copy generated artifact directory into `<deployRoot>/<hash>/`, write registry entry, expose via Caddy static route.
4. Docker v1: generate `docker-compose` or single container spec, allocate internal port, start container, expose via Caddy reverse proxy route.
5. Source package download: zip artifact/workspace output and expose as controlled artifact download.
6. Coolify/Dokploy/CapRover remain reference or future adapter, not required for first deploy v1.

Convenience rating: medium for self-hosted v1; hard only for full PaaS-grade deployment.

### 4.2 Full code editor, selected-code modification, and version history

Bytedance target:

* Full-screen code editor.
* Select code, ask Agent to modify selected region.
* Diff view.
* Version history.
* Code conflict handling.

Why v1 is now practical:

* "Selected code modification" should follow Trae/Cursor interaction: selected range becomes structured context for the Agent, then the Agent proposes a patch/diff.
* A small IDE is enough: file tree, Monaco/CodeMirror editor, selected range, prompt box, preview, diff, apply/reject.
* Version history can start as Git commit history instead of a separate artifact timeline.

What remains non-trivial:

* Patch provenance, conflict resolution, approvals, and rollback still need explicit data contracts.
* Existing AgentHub Git features cover status/diff/stage/unstage/discard, but not selected-range context and patch lineage.

Best migration candidates:

| Candidate | Repo | Fit | How to use |
| --- | --- | --- | --- |
| bolt.new | https://github.com/stackblitz/bolt.new | Workbench/FileTree/EditorPanel/Preview/Terminal | Directly target workbench interaction quality; adapt to AgentHub APIs. |
| Monaco Editor | https://github.com/microsoft/monaco-editor | Mature browser code editor | Direct dependency candidate for full code editor. |
| CodeMirror | https://github.com/codemirror/dev | Mature editor project, archived dev repo but ecosystem active | Better for lightweight editing if bundle/control matters. |
| react-diff-view | https://github.com/otakustay/react-diff-view | MIT git diff component | Direct candidate for file-level diff and apply/selection views. |
| isomorphic-git | https://github.com/isomorphic-git/isomorphic-git | JS Git implementation | Useful if browser/node-side Git operations need deeper modeling. |
| Cline | https://github.com/cline/cline | Agent coding edit/apply/review workflow | Rebuild interaction patterns for selected-code patch, approval, retry. |
| Continue | https://github.com/continuedev/continue | Source-controlled AI checks and coding workflows | Reference for AI coding workflow and source-control-aware actions. |
| Aider | https://github.com/Aider-AI/aider | AI pair programming in terminal | Reference for patch generation, commit workflow, and Git-backed edits. |
| Void | https://github.com/voideditor/void | Open-source Cursor-like editor, archived but relevant | Reference only for Cursor-like UI and edit/apply interaction. |
| Zed | https://github.com/zed-industries/zed | High-performance code editor | Reference for editor/workspace UX; not a direct web component migration. |
| GitButler | https://github.com/gitbutlerapp/gitbutler | Git-backed version-control client and virtual-branch concepts | Reference for branch/change-set UX and conflict-aware history. |

Recommended AgentHub route:

1. Phase A: add Monaco/CodeMirror viewer/editor in Artifact Canvas.
2. Phase B: add `SelectedRangeContext` and "ask Agent to modify selection".
3. Phase C: agent returns structured patch, not raw prose.
4. Phase D: patch preview uses diff viewer and approval.
5. Phase E: create a Git commit for accepted changes and show commit-based version history.
6. Later: persist `FileRevision` / `ArtifactRevision` / `PatchAttempt` if commit history is not enough.

Convenience rating: medium for v1 small IDE + selected range + commit history; hard for advanced branch/conflict semantics.

### 4.3 PPT and rich document artifacts

Bytedance target:

* Document rendering.
* PPT browsing.
* Artifact editing.
* Select paragraph/section and ask Agent to modify.
* Possible Feishu-like document workflow.

Why this is feasible:

* Markdown/deck generation has mature projects.
* DOCX/PPTX preview can be read-only first.
* Basic artifact editing is enough for the Bytedance source.

Best migration candidates:

| Candidate | Repo | Fit | How to use |
| --- | --- | --- | --- |
| PptxGenJS | https://github.com/gitbrent/PptxGenJS | Generate PPTX from JS | Direct dependency candidate for PPT generation/export. |
| Slidev | https://github.com/slidevjs/slidev | Markdown-to-slides developer workflow | Strong for Agent-generated deck artifacts and live preview. |
| Marp | https://github.com/marp-team/marp | Markdown presentation ecosystem | Strong alternative for Markdown-to-slide export. |
| reveal.js | https://github.com/hakimel/reveal.js | HTML presentation framework | Good for web-native slide preview/export bridge. |
| PPTXjs | https://github.com/meshesha/PPTXjs | PPTX to HTML preview | Low-star but direct PPTX preview candidate; spike only. |
| Tiptap | https://github.com/ueberdosis/tiptap | MIT headless rich text editor | Direct candidate for rich document editing. |
| MDXEditor | https://github.com/mdx-editor/editor | Markdown rich editor React component | Direct candidate for Markdown/MDX artifact editing. |
| docxjs | https://github.com/VolodymyrBaydalka/docxjs | DOCX rendering | Direct candidate for document preview. |
| mammoth.js | https://github.com/mwilliamson/mammoth.js | DOCX to HTML | Direct candidate for lightweight DOCX preview. |
| AFFiNE | https://github.com/toeverything/AFFiNE | Notion/Miro-like knowledge workspace | Reference for document/canvas UX, not source migration by default. |
| Docmost | https://github.com/docmost/docmost | Open-source Confluence/Notion alternative | Reference for wiki/document IA; AGPL means clean-room rebuild. |
| Outline | https://github.com/outline/outline | Markdown-compatible team knowledge base | Reference for document IA. |
| AppFlowy | https://github.com/AppFlowy-IO/AppFlowy | AI workspace / Notion alternative | Reference for document workspace behavior; AGPL. |
| Yjs / y-websocket | https://github.com/yjs/yjs / https://github.com/yjs/y-websocket | Shared data model and websocket connector | Future-only reference; not part of current acceptance scope. |
| ONLYOFFICE DocumentServer | https://github.com/ONLYOFFICE/DocumentServer | Full document/spreadsheet/presentation editor | Heavy service/reference; AGPL; use external-service integration only if needed. |

Recommended AgentHub route:

1. Treat rich documents as artifact types: `markdown_doc`, `rich_doc`, `slide_deck`, `pptx`, `docx`.
2. Start with Markdown/MDX editor and Slidev/reveal.js web-native deck.
3. Add PptxGenJS export from slide artifact.
4. Add DOCX/PPTX preview as read-only.
5. Use AFFiNE/Docmost/Outline/AppFlowy as product interaction references for document workspaces.
6. Only consider ONLYOFFICE-like full editing as optional external integration.

Convenience rating: medium for generated slide/doc artifacts, preview, and basic editing.

### 4.4 Orchestrator parallel scheduling, failure degradation, conflict handling

Bytedance target:

* Parallel scheduling.
* Failure degradation.
* Code conflict handling.

Why not easy:

* AgentHub's DAG/mailbox/retry/resume foundation is strong, but these features need productized scheduling policy, per-role/worktree isolation, conflict detection, and visible recovery decisions.
* Component migration helps display the state, not define the orchestration semantics.

Best migration candidates:

| Candidate | Repo | Fit | How to use |
| --- | --- | --- | --- |
| LangGraph | https://github.com/langchain-ai/langgraph | Resilient graph/stateful agent workflows | Reference or partial adoption for graph execution and recovery semantics. |
| CrewAI | https://github.com/crewAIInc/crewAI | Role-playing multi-agent orchestration | Reference for role/task/team decomposition. |
| OpenAI Agents SDK | https://github.com/openai/openai-agents-python | Lightweight multi-agent workflows | Reference for handoff/tool/run semantics. |
| AutoGen | https://github.com/microsoft/autogen | Agentic programming framework | Reference only; license/docs classification needs care. |
| OpenHands | https://github.com/OpenHands/OpenHands | Mature coding-agent runtime/workspace | Reference for failure/recovery/workspace states. |
| Temporal | https://github.com/temporalio/temporal | Durable workflow engine | Reference for durable execution, retries, timeouts, cancellation, and recovery semantics. |
| Inngest | https://github.com/inngest/inngest | Stateful step functions and AI workflows | Reference for event-driven step orchestration. |
| Trigger.dev | https://github.com/triggerdotdev/trigger.dev | AI agents and durable workflows | Reference or service candidate for background jobs. |
| Hatchet | https://github.com/hatchet-dev/hatchet | Background tasks, AI agents, durable workflows | Reference for durable task queues and workflow execution. |
| GitButler | https://github.com/gitbutlerapp/gitbutler | Git change-set/branch UX | Reference for conflict-aware change grouping. |

Recommended AgentHub route:

1. Keep AgentHub's durable DAG/mailbox model as source of truth unless a spike proves a workflow engine should own execution.
2. Compare four execution strategies:
   * AgentHub-native DAG/mailbox plus Redis/job worker.
   * Temporal-style durable workflow engine.
   * Inngest/Trigger/Hatchet-style event step runner.
   * LangGraph/CrewAI/OpenAI Agents-style agent graph layer above AgentHub persistence.
3. Add lane/worktree isolation before real parallel code writes.
4. Add conflict detector based on changed files, patch base revision, Git status, and accepted commit.
5. Render fallback/conflict decisions in Orchestrator timeline and message cards.

Convenience rating: medium for UI, hard for safe concurrent code execution.

## 5. Reclassification Of The 12 Incomplete Points

| Point | Convenient via migration? | Reason |
| --- | --- | --- |
| 1. Deployment publishing | Partly convenient | Self-hosted static/Docker + Caddy hash route is a practical v1; full PaaS remains later. |
| 2. Full code editor/local modification/version history | Partly convenient | Small IDE + Trae/Cursor-style selected range reference + commit history is practical; advanced conflict semantics later. |
| 3. PPT/rich document artifacts | Convenient for generation/preview/basic editing | Slide/doc generation, preview, and basic editing have strong references. |
| 4. Conversation list pin/strict sort | Convenient | Mostly local UI/API additions. |
| 5. Message type completion | Partly convenient | Cards easy; deploy/doc/PPT backend semantics remain. |
| 6. Message operations | Convenient except apply Diff | Reply/quote/regenerate easy; apply Diff requires patch approval. |
| 7. Orchestrator advanced behavior | Partly convenient | UI/status easy; parallel/fallback/conflict policy is core architecture. |
| 8. Conversational Agent creation/toolset config | Medium | Needs Agent builder flow and tool schema, but CopilotKit/assistant-ui patterns help. |
| 9. Agent contact experience | Convenient | Agent data exists; needs contact-style UI. |
| 10. Artifact preview/editing/full-screen | Medium | Workbench/artifact canvas can migrate; editing semantics need adapters. |
| 11. Desktop local file/notification surface | Medium | Electron patterns available; must preserve typed IPC/security. |
| 12. Mobile full/lightweight parity | Medium | PWA can improve quickly; native RN full experience is separate. |

## 6. Recommended Execution Order

### Quick Wins

1. Conversation list pin/sort/search polish.
2. Message reply/quote/regenerate action bar.
3. Agent contact cards/profile drawer.
4. Artifact card/full-screen preview shell.
5. Web preview/deploy/doc/PPT card shells with placeholder-free real status models.

### Spike Then Build

1. Monaco/CodeMirror editor + Trae/Cursor-style selected range context.
2. react-diff-view + structured patch approval.
3. Slidev/Marp/PptxGenJS deck artifact generation/export.
4. Self-hosted static/Docker deployment adapter and deployment run status cards.
5. LangGraph/CrewAI/OpenAI Agents SDK/Temporal/Inngest/Trigger/Hatchet comparison against AgentHub durable DAG.

### Hard / Do Not Treat As UI Migration

1. PaaS-grade deployment with secrets, env, rollback, and production logs.
2. Selected-code conversational modification with conflict-safe patch application.
3. Durable file/artifact version history beyond Git commits.
5. Safe parallel code-writing agents.

## 7. Source Links

* Coolify: https://github.com/coollabsio/coolify
* Dokploy: https://github.com/Dokploy/dokploy
* CapRover: https://github.com/caprover/caprover
* Monaco Editor: https://github.com/microsoft/monaco-editor
* CodeMirror: https://github.com/codemirror/dev
* react-diff-view: https://github.com/otakustay/react-diff-view
* isomorphic-git: https://github.com/isomorphic-git/isomorphic-git
* Cline: https://github.com/cline/cline
* Continue: https://github.com/continuedev/continue
* Aider: https://github.com/Aider-AI/aider
* Void: https://github.com/voideditor/void
* Zed: https://github.com/zed-industries/zed
* PptxGenJS: https://github.com/gitbrent/PptxGenJS
* Slidev: https://github.com/slidevjs/slidev
* Marp: https://github.com/marp-team/marp
* reveal.js: https://github.com/hakimel/reveal.js
* PPTXjs: https://github.com/meshesha/PPTXjs
* Tiptap: https://github.com/ueberdosis/tiptap
* MDXEditor: https://github.com/mdx-editor/editor
* docxjs: https://github.com/VolodymyrBaydalka/docxjs
* mammoth.js: https://github.com/mwilliamson/mammoth.js
* AFFiNE: https://github.com/toeverything/AFFiNE
* Docmost: https://github.com/docmost/docmost
* Outline: https://github.com/outline/outline
* AppFlowy: https://github.com/AppFlowy-IO/AppFlowy
* Yjs: https://github.com/yjs/yjs
* y-websocket: https://github.com/yjs/y-websocket
* ONLYOFFICE DocumentServer: https://github.com/ONLYOFFICE/DocumentServer
* LangGraph: https://github.com/langchain-ai/langgraph
* CrewAI: https://github.com/crewAIInc/crewAI
* OpenAI Agents SDK: https://github.com/openai/openai-agents-python
* AutoGen: https://github.com/microsoft/autogen
* Temporal: https://github.com/temporalio/temporal
* Inngest: https://github.com/inngest/inngest
* Trigger.dev: https://github.com/triggerdotdev/trigger.dev
* Hatchet: https://github.com/hatchet-dev/hatchet
* GitButler: https://github.com/gitbutlerapp/gitbutler
* Zulip: https://github.com/zulip/zulip
* Mattermost: https://github.com/mattermost/mattermost
* Element Web: https://github.com/element-hq/element-web
* Rocket.Chat: https://github.com/RocketChat/Rocket.Chat
