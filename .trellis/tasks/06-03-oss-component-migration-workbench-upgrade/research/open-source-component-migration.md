# Mature OSS Component Migration and Workbench Upgrade

Date: 2026-06-03
Task: `.trellis/tasks/06-03-oss-component-migration-workbench-upgrade`
Contract: `research/contracts/OSS-COMPONENT-MIGRATION-WORKBENCH-UPGRADE-2026-06-03.md`
Related gap map: `research/bytedance-gap-migration-map.md`

## 1. Baseline Plan

AgentHub should not keep hand-rolling generic AI application surfaces when mature open-source projects already solve the same component and interaction problems. The migration principle is:

* For permissive projects such as MIT or Apache-2.0, directly reuse packages, component structure, or source-level implementation where it fits AgentHub's architecture.
* For restricted or custom-license projects, do not copy source code, but do not compromise the product target. Rebuild the same mature capability in AgentHub's own framework using clean AgentHub types, APIs, tokens, and tests.
* External projects must not replace AgentHub's product facts: Workspace, Session, Message, Role Agent, Runtime, Tool Call, Approval, Action, Artifact, and DeviceChannel remain AgentHub-owned contracts.
* UI components render typed facts. They do not infer business semantics from Markdown text, string prefixes, status phrases, or mixed control events.

### 1.1 Current AgentHub Implementation

| Surface | Current implementation | Main gap |
| --- | --- | --- |
| Chat thread | `apps/web/components/workspace/ChatPanel.tsx` plus Zustand `session-store` | Page/store code owns too much message, runtime, SSE, tool, and approval logic. |
| Markdown | `MessageMarkdown.tsx` uses `react-markdown`, `remarkGfm`, `remarkMath`, `rehypeKatex`, custom code/table/link/image components | Direction is correct, but `normalizeMessageMarkdown()` is still a display-layer workaround. Long-term fix belongs in runtime/SSE/accumulator/persistence fidelity. |
| Message content | `MessageContent.tsx` smooths streaming text and renders runtime parts | Good split, but still reduces tool/permission/diff/artifact events in the client store. |
| Composer | Workspace composer is self-built around textarea, role picker, attachments, permission mode, send/stop | Needs mature prompt input anatomy, action bar, attachments, stop/regenerate/edit affordances. |
| Tool Call / Approval | Runtime parts are reduced in `session-store.ts` and rendered as cards in `MessageContent.tsx` | Needs structured event protocol, persisted lifecycle, human-confirmation component family, and real approval state refresh. |
| Artifact / Workbench | `ArtifactPanel.tsx` combines Role Agents, File Tree, Git Changes, Artifact list, preview | Needs type-specific artifact canvas, file tree, editor, preview, diff, terminal, and clear Web/Desktop/Mobile boundaries. |
| Session store | `session-store.ts` fetches messages, sends chat, parses SSE, accumulates runtime output, derives parts, displays status notices | Needs a transport/runtime adapter layer so UI stores subscribe to persisted message/runtime facts rather than parsing product semantics inline. |

### 1.2 Mandatory Markdown Lesson

The Markdown regression becomes a cross-component rule:

* Do not use display-layer heuristic regex to guess and repair upstream Markdown structure as a design solution.
* Runtime/SSE/accumulator/persistence must preserve original content fidelity: newlines, list markers, code fences, table separators, math, and raw tool output boundaries.
* Markdown rendering should use mature parser/renderer stacks such as `react-markdown + remarkGfm`, optionally `remark-math + rehype-katex`.
* Custom code block/table/link/image components must emit valid DOM. No `<pre><div>...` structures.
* AST-only props such as `node` must be stripped before DOM spread.
* `ack`, `status`, `tool`, `approval`, `runtime`, and other control events must be typed events or message parts; they must not be mixed into normal chat body text.
* The same rule applies to all future migrations: data protocol preserves facts, UI renders facts, UI does not guess business meaning.

## 2. Candidate Map

GitHub status was checked on 2026-06-03 with `gh repo view` and LICENSE files where needed.

| Candidate | Public repo | License/status note | AgentHub use depth | Main fit | Direct migration boundary |
| --- | --- | --- | --- | --- | --- |
| assistant-ui | https://github.com/assistant-ui/assistant-ui | MIT, active | Reuse package/components + custom runtime adapter | Chat, Message, Composer, Actions, Tool UI, human approval | Do not adopt assistant-cloud/store as source of truth. |
| vercel/ai-elements | https://github.com/vercel/ai-elements | LICENSE is Apache-2.0, GitHub classifier reports Other, active | Reuse components/registry patterns | shadcn-style AI components | Copy/adapt into AgentHub design system; keep Chinese text and tokens. |
| vercel/chatbot | https://github.com/vercel/chatbot | LICENSE is Apache-2.0, active | Reuse architecture + artifact modules | Next.js chat, resumable stream, artifact canvas | Do not replace AgentHub schema/auth/runtime. |
| CopilotKit | https://github.com/CopilotKit/CopilotKit | MIT, active | Spike then selective protocol/UI reuse | AG-UI, generative UI, tool/action UI | Do not let AG-UI conflict with AgentHub Action/Approval contracts. |
| OpenHands | https://github.com/OpenHands/OpenHands | Root license: MIT outside enterprise directory, active | Rebuild architecture patterns | Agent workbench, runtime status, recovery, audit | Do not migrate backend/frontend stack wholesale. |
| stackblitz/bolt.new | https://github.com/stackblitz/bolt.new | MIT, active | Reuse workbench interaction/components where practical | FileTree, EditorPanel, Preview, Terminal | Do not adopt WebContainer as AgentHub execution substrate. |
| AionUi | https://github.com/iOfficeAI/AionUi | Apache-2.0, active; local clone in `refer_proj/AionUi` | Reuse components + architecture patterns | Markdown, local agents, chat layout, ACP/team flow | Do not import Arco skin/store/product model. |
| codeg | https://github.com/xintaofei/codeg | Apache-2.0, active; local clone in `refer_proj/xintaofei__codeg` | Reuse architecture + transport patterns | Transport, reconnect, event stream, permission request | Do not migrate Tauri/Rust host into AgentHub. |
| cherry-studio | https://github.com/CherryHQ/cherry-studio | AGPL-3.0, active | Reference only / clean-room rebuild | Desktop density, settings grouping, Electron structure | Do not copy source into AgentHub. Rebuild equivalent patterns. |
| ClawWork | https://github.com/clawwork-ai/ClawWork | Apache-2.0, active | Reuse architecture patterns | Gateway protocol, artifacts, approvals, PWA/Desktop split | Low-star but highly relevant; spike before code reuse. |
| LobeHub | https://github.com/lobehub/lobehub | Custom Community License | Reference only | Device gateway, agent operation, mobile IA | Do not copy code; use as product/architecture reference only. |

## 3. What Cannot Directly Migrate

| Item | Cannot directly migrate because | AgentHub-owned replacement |
| --- | --- | --- |
| External DB schema/auth/session model | AgentHub already has Workspace/Session/Message/Artifact/Action/Approval contracts and ownership checks. | Keep AgentHub database/API. Add adapters from external UI component state to AgentHub typed DTOs. |
| External runtime protocol | AgentHub runtime spans public cloud worker, local Desktop Connector, Role Agent binding, native CLI session resume, and approval gating. | Define `RuntimeEventEnvelope`, `MessagePart`, `ToolCall`, `ApprovalRequest`, `ArtifactRef` in `packages/shared`. |
| Arco, Ant, UnoCSS, or another visual skin | Project contract requires `shadcn/ui + Tailwind CSS 4 + lucide-react`. | Recreate UI with AgentHub tokens and shared components. |
| AGPL/custom-license source code | Direct source copy can impose unwanted obligations or commercial restrictions. | Rebuild the same product capability in AgentHub's own files from the observed interaction principle. |
| WebContainer execution substrate | AgentHub execution is Cloud Runtime Gateway and Desktop Connector, not browser-contained execution. | Reuse bolt.new workbench surface; execution remains AgentHub runtime/device protocol. |
| Markdown/content repair in UI | It repeats the known regression cause. | Preserve Markdown at runtime/SSE/accumulator/persistence; renderer only parses and renders. |

## 4. Technical Comparisons

### 4.1 assistant-ui

assistant-ui is the strongest immediate candidate for Chat/Message/Composer/Tool/Human Approval. Its value is not just components; it gives the right component anatomy for AI chat: Thread, Message, Composer, ActionBar, Attachments, Tool Calls, and runtime adapters.

| Required field | Assessment |
| --- | --- |
| Original AgentHub implementation | `ChatPanel`, `MessageContent`, `MessageMarkdown`, and `session-store` manually render message loops, composer, streaming, runtime parts, and approval cards. |
| Implementation after using repo | Introduce `AgentHubThreadAdapter` over AgentHub sessions/messages; render through assistant-ui Thread/Message/Composer primitives or matching local wrappers; tool and approval parts become first-class UI items. |
| Core thinking / technical difference | From page-owned message loops to composable AI thread primitives with explicit runtime adapter boundaries. |
| Reusable files/modules/components | `packages/react/src/primitives`, `packages/react/src/hooks`, `packages/react-markdown/src`, runtime adapter patterns. |
| Required adapter layer | `AgentHubAssistantRuntimeAdapter`, `AgentHubMessageMapper`, `AgentHubToolCallMapper`, `AgentHubApprovalAdapter`, Chinese labels and shadcn token wrappers. |
| Risks | Adapter may duplicate existing store during migration; assistant-ui runtime assumptions may conflict with persisted AgentHub event model if adopted too deeply. |
| Verification | Unit-test DTO mapping; Playwright real Web thread with streaming, stop, copy, regenerate/edit states, tool card, pending approval, approval POST, reload persistence, and no layout overlap. |

### 4.2 vercel/ai-elements

AI Elements is a shadcn/ui-based AI component registry. It fits AgentHub's visual route better than most libraries because its components are meant to be copied/adapted, not treated as an opaque design skin.

| Required field | Assessment |
| --- | --- |
| Original AgentHub implementation | AgentHub has self-built message, composer, reasoning/thinking, tool, code block, and response components with mixed local styles. |
| Implementation after using repo | Copy/adapt AI Elements component patterns into `packages/ui` and `apps/web/components/ai/*`, localized to Chinese and Tailwind 4 tokens. |
| Core thinking / technical difference | From one-off workspace components to shared AI UI primitives aligned with shadcn registry conventions. |
| Reusable files/modules/components | `packages/elements`, `packages/shadcn-ui/components`, docs/examples for conversation, message, prompt input, response, reasoning, tool, code block. |
| Required adapter layer | Component prop types must use AgentHub domain types; icons from `lucide-react`; variants/tokens from AgentHub UI; no Vercel-only assumptions in runtime data. |
| Risks | GitHub classifier marks license as Other although LICENSE text is Apache-2.0; registry APIs may evolve quickly; component copy must avoid visual drift. |
| Verification | Component tests for every state; Playwright screenshot matrix for desktop/mobile with long Chinese text, code block copy, tool collapse, reasoning collapse, and button size stability. |

### 4.3 vercel/chatbot

Vercel Chatbot is useful as a complete Next.js AI chat implementation with typed artifacts and stream organization. AgentHub should use it to raise the artifact/workbench bar, not to replace AgentHub's DB, auth, or runtime.

| Required field | Assessment |
| --- | --- |
| Original AgentHub implementation | `ArtifactPanel` combines files, changes, artifacts, and previews; chat streaming is parsed in client store; artifact types are present but not a mature canvas. |
| Implementation after using repo | Rebuild AgentHub artifact canvas around typed `code`, `text`, `image`, `sheet/structured`, `diff`, and `preview` surfaces; borrow stream/resume architecture principles. |
| Core thinking / technical difference | From a generic side panel to a typed artifact system with artifact-specific UI actions and persistent stream/run state. |
| Reusable files/modules/components | `components/chat`, `artifacts/actions.ts`, `artifacts/code`, `artifacts/image`, `artifacts/sheet`, `artifacts/text`, `lib/artifacts`, `lib/ai`. |
| Required adapter layer | `AgentHubArtifactAdapter`, artifact route DTOs, artifact action authorization, stream persistence mapper, shadcn/Tailwind 4 style normalization. |
| Risks | Its schema/auth/deployment stack is not AgentHub's; stream protocol may assume AI SDK patterns that differ from Runtime Gateway events. |
| Verification | API tests for durable artifacts; Playwright opens artifact from chat, reloads, switches artifact types, edits/saves where supported, verifies no fake data and no cross-session leak. |

### 4.4 CopilotKit

CopilotKit is strong for generative UI and AG-UI. It should be spiked after AgentHub's own Tool/Approval protocol is clean, because adopting another agent protocol too early could create two sources of truth.

| Required field | Assessment |
| --- | --- |
| Original AgentHub implementation | Tool, approval, question, diff, and artifact parts are AgentHub-specific `RuntimeMessagePart` records. |
| Implementation after using repo | Evaluate AG-UI as a bridge for generative UI rendering; selectively reuse React UI components for action/result surfaces where they can map cleanly. |
| Core thinking / technical difference | From fixed card rendering to event-driven generative UI and agent component rendering. |
| Reusable files/modules/components | `packages/react-ui`, `packages/react-core`, `packages/runtime`, `packages/shared`, AG-UI examples. |
| Required adapter layer | `AgentHubAgUiBridge` that maps AgentHub `Action`, `ToolCall`, `ApprovalRequest`, and `ArtifactRef` to AG-UI-compatible events without replacing AgentHub storage. |
| Risks | Protocol collision with AgentHub Runtime Gateway; premature adoption can obscure approval security boundaries. |
| Verification | Spike with one low-risk action card and one artifact result; assert AgentHub action IDs, approval statuses, and audit logs remain canonical. |

### 4.5 OpenHands

OpenHands is a mature agent development workbench. It should guide AgentHub's runtime status, task recovery, local GUI, audit, and workspace operations, but AgentHub should rebuild the relevant patterns in its own architecture.

| Required field | Assessment |
| --- | --- |
| Original AgentHub implementation | Runtime status, plan timeline, logs, approvals, and recovery exist across Web/Desktop APIs and UI but are still fragmented. |
| Implementation after using repo | Model a mature run/workspace status plane: run health, runtime events, failure reasons, recovery actions, permission/audit views. |
| Core thinking / technical difference | From IM-first progress display to an auditable software-agent workbench with recoverable task state. |
| Reusable files/modules/components | `frontend/src/components`, `frontend/src/routes`, `frontend/src/services`, runtime/workspace status patterns, local GUI concepts. |
| Required adapter layer | `AgentHubRunStatusViewModel`, `RuntimeHealthCard`, `ExecutionTimeline`, `RecoveryActionAdapter`, audit log DTOs. |
| Risks | Backend and frontend stack differ; enterprise directory has separate license; direct wholesale migration would overfit OpenHands product semantics. |
| Verification | Real plan/run with failed runtime, retry/resume, approval, artifact output, reload; verify timeline and audit entries match database/runtime logs. |

### 4.6 stackblitz/bolt.new

bolt.new is the strongest Workbench interaction reference. AgentHub should target its file/editor/preview/terminal quality while keeping AgentHub runtime execution outside the browser.

| Required field | Assessment |
| --- | --- |
| Original AgentHub implementation | `ArtifactPanel` has file tree, preview, Git changes, and artifacts, but no mature editor/terminal/workbench composition. |
| Implementation after using repo | Create `WorkbenchPanel` with `FileTree`, `EditorPanel`, `Preview`, `Diff`, `Terminal`, and `ArtifactInspector` using AgentHub runtime/file APIs. |
| Core thinking / technical difference | From side-panel data browser to full coding workbench surface with stable regions and tool-specific affordances. |
| Reusable files/modules/components | `app/components/workbench/Workbench.client.tsx`, `FileTree.tsx`, `FileBreadcrumb.tsx`, `EditorPanel.tsx`, `Preview.tsx`, `PortDropdown.tsx`, `terminal`, `app/components/editor/codemirror`. |
| Required adapter layer | `AgentHubFileTreeProvider`, `AgentHubPreviewProvider`, `AgentHubTerminalSessionAdapter`, `AgentHubDiffAdapter`, execution-domain guard for cloud vs local desktop. |
| Risks | Remix/UnoCSS/WebContainer assumptions; terminal and preview must not bypass Desktop Connector or Cloud Runtime Gateway. |
| Verification | Playwright desktop: open file, preview HTML/Markdown/code/image, show diff, run terminal output via real runtime/log channel, no local shell bypass, reload restores selected artifact. |

### 4.7 AionUi

AionUi is already referenced in project specs and has Apache-2.0 licensing. It is immediately useful for Markdown component decomposition, local agent cards, chat layout density, and ACP/team-mode state-machine thinking.

| Required field | Assessment |
| --- | --- |
| Original AgentHub implementation | Markdown is currently one component plus local helpers; Desktop/Web local agent cards are still AgentHub-specific and uneven. |
| Implementation after using repo | Reuse Markdown decomposition and local-agent UI patterns, rewritten with AgentHub props/tokens; use ACP/team flow as state-machine reference. |
| Core thinking / technical difference | From ad hoc display helpers to explicit renderer modules and centralized agent/team runtime state. |
| Reusable files/modules/components | `packages/desktop/src/renderer/components/Markdown/index.tsx`, `CodeBlock.tsx`, `MermaidBlock.tsx`, `markdownUtils.ts`, `pages/settings/AgentSettings/LocalAgents.tsx`, `AgentCard.tsx`, `pages/conversation/components/ChatLayout`. |
| Required adapter layer | `AgentHubMarkdownRenderer`, `AgentHubCodeBlock`, runtime/local-agent DTO mapper, Tailwind 4/lucide/shadcn style rewrite, Chinese labels. |
| Risks | AionUi uses different UI stack and Desktop assumptions; old spec allowed conservative Markdown normalization, but long-term AgentHub must fix upstream fidelity instead. |
| Verification | Unit tests for Markdown AST rendering and no DOM prop leakage; Playwright streaming Markdown/code/table/math; Desktop Runtime cards show CLI status without API key fields. |

### 4.8 codeg

codeg is valuable for transport and permission architecture. It shows how to make Web/Desktop/remote transports explicit rather than letting UI code directly parse and attach events.

| Required field | Assessment |
| --- | --- |
| Original AgentHub implementation | `session-store.ts` reads `/api/chat` SSE, parses frames, reduces runtime parts, and handles status notices inline. |
| Implementation after using repo | Introduce shared transport/event stream adapter with reconnect, ready handshake, snapshot/replay, and permission request modeling. |
| Core thinking / technical difference | From "stream chunks into UI store" to explicit transport abstraction with recovery and persisted event truth. |
| Reusable files/modules/components | `src/lib/transport/types.ts`, `web-event-stream.ts`, `web-transport.ts`, `remote-desktop-transport.ts`, `tauri-transport.ts`, `permission-request.ts`, `session-attachment-events.ts`. |
| Required adapter layer | `AgentHubTransport`, `RuntimeEventStream`, `ReplayCursor`, `PermissionRequestAdapter`, database-backed snapshot reconciler. |
| Risks | Tauri/server assumptions do not match Electron/Next exactly; direct migration could create redundant transport APIs. |
| Verification | SSE/WebSocket reconnect tests; event sequence dedupe; reload after disconnect reconstructs message/tool/approval/artifact state from persisted facts. |

### 4.9 cherry-studio

Cherry Studio is a strong desktop AI app reference, but AGPL-3.0 makes direct source migration unsuitable for AgentHub. The product target should still be adopted: dense desktop settings, provider/runtime grouping, typed IPC, and clear main/preload/renderer separation.

| Required field | Assessment |
| --- | --- |
| Original AgentHub implementation | Desktop has Electron main/preload/renderer and runtime detector, but the settings/runtime inventory can be more mature. |
| Implementation after using repo | Rebuild equivalent Desktop grouping and process-boundary discipline in AgentHub's own code. |
| Core thinking / technical difference | From minimal runtime console to a dense desktop control surface with typed IPC and grouped runtime capability cards. |
| Reusable files/modules/components | Reference only: `src/main/ipc.ts`, `src/preload/index.ts`, `packages/aiCore`, provider/settings grouping concepts. No direct source copy. |
| Required adapter layer | `DesktopRuntimeInventoryViewModel`, typed IPC/preload contracts, settings grouping with AgentHub runtime/auth boundaries. |
| Risks | AGPL-3.0; provider/API-key product model conflicts with AgentHub local CLI credential boundary. |
| Verification | Electron Playwright: runtime cards, local auth status, no API Key/Base URL fields, IPC fallback errors in Chinese, screenshot density matches shared token system. |

### 4.10 ClawWork

ClawWork is lower-star but highly relevant for AgentHub's gateway, artifact, approval, PWA/Desktop split, and session key discipline. It should be spiked before broad adoption.

| Required field | Assessment |
| --- | --- |
| Original AgentHub implementation | DeviceChannel, runtime events, artifact persistence, and approval APIs exist but are distributed across Web/Desktop/shared packages. |
| Implementation after using repo | Reuse protocol and package-boundary ideas: shared gateway frames, session key builder, approval/artifact stores, PWA/Desktop adapters. |
| Core thinking / technical difference | From endpoint-specific logic to shared protocol frames and durable session/artifact contracts. |
| Reusable files/modules/components | `packages/shared/src/gateway-protocol.ts`, `types.ts`, `constants.ts`, desktop gateway/artifact/approval tests. |
| Required adapter layer | `AgentHubGatewayFrame`, `SessionKeyBuilder`, artifact metadata index, approval store mapper, PWA supervision adapter. |
| Risks | Smaller ecosystem; needs manual quality review; product scope differs. |
| Verification | Contract tests for req/res/event frames; Desktop/PWA/Web round-trip with approval and artifact update; replay after reconnect. |

### 4.11 LobeHub

LobeHub is useful as a product and architecture reference for device gateway and agent operation, but its custom Community License means no direct code migration.

| Required field | Assessment |
| --- | --- |
| Original AgentHub implementation | AgentHub has Desktop Connector and Role Agent runtime binding, but can improve device gateway and mobile information architecture. |
| Implementation after using repo | Rebuild gateway/mobile IA patterns in AgentHub's own code after clean-room analysis. |
| Core thinking / technical difference | From local runtime status pages to agent operation/control surfaces across devices. |
| Reusable files/modules/components | Reference only: device gateway concepts, agent operation IA, mobile session supervision ideas. |
| Required adapter layer | AgentHub DeviceChannel contract, mobile supervision view model, runtime capability summary. |
| Risks | Custom license; model/provider product assumptions differ. |
| Verification | Web/Desktop/Mobile UAT for device online/offline, runtime status, mobile approval, and no provider-key leakage. |

## 5. Phased Roadmap

### Phase 0: Research And Technical Spikes, No Main-Path Changes

Scope:

* Create adapter spike branches or local prototypes only.
* Evaluate assistant-ui runtime adapter feasibility.
* Copy/adapt two AI Elements components into a sandbox story/test page.
* Prototype typed `RuntimeEventEnvelope` and `MessagePart` contract.
* Prototype Workbench skeleton from bolt.new/Vercel Chatbot patterns without changing production routes.

Completion conditions:

* Every required candidate has a final adoption depth: direct dependency, component reuse, interaction reuse, architecture reuse, reference only, or not recommended.
* License and dependency impact recorded per candidate.
* Spike proves assistant-ui or local equivalent can render AgentHub persisted messages without changing backend facts.
* Spike proves Workbench can use AgentHub file/artifact APIs without WebContainer or fake data.
* No production chat/workbench route changes.

### Phase 1: Chat / Message / Composer / Markdown / CodeBlock Upgrade

Scope:

* Extract `MessageThread`, `MessageBubble`, `MessageContent`, `MessageActions`, `MessageComposer`.
* Adopt assistant-ui primitives or AI Elements-style local components.
* Keep `react-markdown + remarkGfm`, optional `remark-math + rehype-katex`; improve code block/table/link/image components.
* Move display-layer Markdown normalization behind a temporary feature flag and open upstream fidelity task.
* Composer gains stable action bar: role mention, attachment, permission mode, stop, retry/regenerate/edit where supported.

Completion conditions:

* Existing Markdown regression tests still pass, plus new tests for raw newline preservation from persisted messages.
* No `<pre><div>` invalid DOM; no `node` prop leaks to DOM.
* Chat E2E covers streaming, completed, failed, empty thinking, code copy, table scroll, link/image, long Chinese text, mobile no horizontal scroll.
* Composer E2E covers send/stop/disabled state and no layout jump.
* UI remains `shadcn/ui + Tailwind CSS 4 + lucide-react`.

### Phase 2: Tool Call / Approval / Human Confirmation / Runtime Status Card Upgrade

Scope:

* Define structured tool/approval/runtime event envelopes in `packages/shared`.
* Move event reduction out of `session-store.ts` into a tested adapter/reconciler.
* Build `ToolCallCard`, `ApprovalCard`, `QuestionCard`, `RuntimeStatusCard`, `ExecutionTimelineItem`.
* Human approval must bind to AgentHub `Action` / `ApprovalRequest` IDs, not Markdown text.
* Runtime status cards show CLI/device/cloud health and failure reasons; no API key fields for local CLI.

Completion conditions:

* Unit tests cover event ordering, dedupe, replay, status transitions, and ack/control-event separation from message body.
* Real approval calls `/api/actions/:id/approve`, refreshes state, persists after reload.
* Playwright/opencli verifies tool started/delta/completed/failed, approval allow/reject, runtime offline/error, and audit/log consistency.
* No control event text is appended into normal assistant Markdown.

### Phase 3: Artifact / Workbench / Preview / FileTree / Diff / Terminal Upgrade

Scope:

* Replace generic right panel with `WorkbenchPanel` and tabs/regions: Files, Artifact, Preview, Diff, Terminal, Activity.
* Use Vercel Chatbot artifact type model and bolt.new workbench interaction model.
* Add type-specific artifact components: markdown/text/code/image/html/diff/generic file.
* Terminal UI reads AgentHub runtime/log sessions; it does not execute shell directly from renderer.
* Diff and destructive file actions use structured approval.

Completion conditions:

* FileTree loads from real workspace files and survives reload.
* Artifact list reads durable artifacts, not message metadata only.
* Preview covers Markdown/code/html/image/text/binary fallback.
* Diff stage/unstage/discard/revert uses real Git API/approval and refreshes status.
* Terminal panel shows real runtime/log output and cannot bypass Cloud Runtime Gateway/Desktop Connector.
* Desktop 1440/1024 and mobile 390 screenshots have no overlap, no horizontal scroll, and stable panel dimensions.

### Phase 4: Three-Surface Consistency / Visual E2E / Component Hardening

Scope:

* Promote shared components into `packages/ui` or shared app-level component packages.
* Align Web, Desktop, Mobile/PWA message bubbles, composer, approval cards, runtime cards, artifact cards, and status badges.
* Add visual state matrix and Playwright screenshot gates.
* Create migration documentation and deprecate old one-off components.

Completion conditions:

* Web desktop 1440x900 and 1024x768, Mobile/PWA 390x844, Electron 1200x800 all pass layout and screenshot checks.
* `document.body.scrollWidth <= window.innerWidth + 1` for Web/Mobile.
* Key regions do not overlap: sidebar, chat, composer, artifact/workbench, approval card.
* Long paths, long Chinese text, long code, and long tool outputs do not overflow parent containers.
* Shared component usage is asserted; no single-surface private skin becomes the default.

## 6. Verification Strategy

| Area | Verification |
| --- | --- |
| Data fidelity | Contract tests for runtime/SSE/accumulator/persistence preserving Markdown and structured events. |
| Markdown | Unit tests for GFM, code fence, table, math, image, link, no AST prop leaks, no invalid DOM; Playwright real rendering. |
| Chat/Composer | Playwright/opencli from real workspace/session: send, stream, stop, reload, role mentions, attachments, permission mode. |
| Tool/Approval | API + UI tests for pending/running/completed/failed/rejected; real approve/reject calls; persisted audit. |
| Workbench | Real file/artifact/git/runtime APIs; no mock runtime data; reload and reconnect recovery. |
| Visual | Screenshot matrix plus geometry assertions, no horizontal scroll, no overlap, stable button/card dimensions. |
| Security/boundary | No local CLI API key/Base URL fields; no shell execution from renderer; destructive actions require approval. |

## 7. Recommendation Priority

### Immediately Do

* assistant-ui: adopt as primary Chat/Message/Composer/Tool/Human Approval target, starting with an adapter spike and then production component migration.
* vercel/ai-elements: copy/adapt shadcn-style AI primitives into AgentHub UI.
* AionUi Markdown decomposition: reuse/refactor into AgentHub Markdown renderer and code block/table behavior, while moving content repair upstream.
* codeg transport principles: start extracting AgentHub transport/event adapter out of `session-store.ts`.

### Do After Technical Spike

* vercel/chatbot: use artifact and resumable-stream architecture after confirming fit with AgentHub Runtime Gateway.
* stackblitz/bolt.new: use Workbench/FileTree/Editor/Preview/Terminal interaction model after proving execution remains AgentHub-owned.
* ClawWork: evaluate gateway protocol/session/artifact/approval packages for direct reuse or adaptation.
* CopilotKit: evaluate AG-UI/generative UI once AgentHub Tool/Approval protocol is stable.
* Monaco/CodeMirror + react-diff-view + Aider/Cline/Continue-style references: use for full-screen code editor, Trae/Cursor-style selected range context, patch preview, apply/reject, and Git commit-based version history.
* AgentHub self-host deployment adapter + Caddy hash routes: implement static deploy folder and Docker internal-port reverse proxy as v1; keep Coolify/Dokploy/CapRover as future PaaS references/adapters.
* Slidev/Marp/PptxGenJS/Tiptap/MDXEditor/docxjs/mammoth.js/AFFiNE-style references: evaluate rich document, PPT/deck, Markdown/MDX editing, DOCX/PPTX preview, basic artifact editing, and document workspace artifact types.
* LangGraph/CrewAI/OpenAI Agents SDK/Temporal/Inngest/Trigger.dev/Hatchet: compare against AgentHub's durable DAG/mailbox for parallel scheduling, fallback, conflict policy, retries, cancellation, and recovery.

### Reference Only / Rebuild In AgentHub

* OpenHands: rebuild mature workbench/runtime/recovery/audit patterns inside AgentHub architecture.
* cherry-studio: rebuild desktop density, typed IPC, settings grouping, and runtime inventory concepts; do not copy AGPL source.
* LobeHub: use device gateway/mobile IA concepts only; custom license prevents direct source migration.
* Cline/Continue-style IDE agents, if added later: use diff/approval/retry interaction principles, not source migration.
* ONLYOFFICE DocumentServer: use only as optional external-service/reference for heavy Office-like editing; Bytedance scope only requires preview and editing.

### Not Recommended

* Replacing AgentHub's DB/API/session/runtime contracts with any external project's schema.
* Introducing Arco/Ant/UnoCSS as AgentHub's main visual system.
* Using WebContainer as AgentHub execution substrate.
* Keeping display-layer Markdown repair as the long-term solution.
* Letting frontend stores parse business semantics from raw SSE strings instead of typed persisted events.

## 8. Sources

* assistant-ui: https://github.com/assistant-ui/assistant-ui
* Vercel AI Elements: https://github.com/vercel/ai-elements
* Vercel Chatbot: https://github.com/vercel/chatbot
* CopilotKit: https://github.com/CopilotKit/CopilotKit
* OpenHands: https://github.com/OpenHands/OpenHands
* bolt.new: https://github.com/stackblitz/bolt.new
* AionUi: https://github.com/iOfficeAI/AionUi and `refer_proj/AionUi`
* codeg: https://github.com/xintaofei/codeg and `refer_proj/xintaofei__codeg`
* cherry-studio: https://github.com/CherryHQ/cherry-studio and `refer_proj/cherry-studio`
* ClawWork: https://github.com/clawwork-ai/ClawWork and `refer_proj/clawwork-ai__ClawWork`
* LobeHub: https://github.com/lobehub/lobehub
* Local AgentHub docs inspected: `.trellis/spec/frontend/component-guidelines.md`, `.trellis/spec/frontend/ui-style-guidelines.md`, `research/modules/im-foundation.md`, `research/modules/ui-and-visual-testing.md`, `research/modules/reference-projects.md`, `research/regression-ledger.md`, `research/reference-repos/agent-ui-component-evolution-roadmap.md`.
