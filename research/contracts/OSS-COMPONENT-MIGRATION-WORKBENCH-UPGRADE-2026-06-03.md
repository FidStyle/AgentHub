# Mature OSS Component Migration And Workbench Upgrade Contract

TASK-ID: `OSS-COMPONENT-MIGRATION-WORKBENCH-UPGRADE-2026-06-03`
Trellis task: `.trellis/tasks/06-03-oss-component-migration-workbench-upgrade`
Priority: P1 architecture / P0 regression-prevention guardrail
Status: planning

## 1. Bound Requirements

FR-ID:

* `FR-WEB-001`
* `FR-MOB-001`
* `FR-DESK-001`
* `FR-CHAT-001`
* `FR-ORCH-001`
* `FR-PERM-001`
* `FR-ACTION-001`
* `FR-ARTIFACT-001`
* `FR-RESULT-001`
* `FR-RUNTIME-001`
* `FR-UI-001`

Source documents:

* `.trellis/spec/frontend/component-guidelines.md`
* `.trellis/spec/frontend/ui-style-guidelines.md`
* `research/modules/im-foundation.md`
* `research/modules/ui-and-visual-testing.md`
* `research/modules/reference-projects.md`
* `research/regression-ledger.md`
* `.trellis/tasks/06-03-oss-component-migration-workbench-upgrade/research/open-source-component-migration.md`
* `.trellis/tasks/06-03-oss-component-migration-workbench-upgrade/research/bytedance-gap-migration-map.md`

## 2. Product Contract

AgentHub must migrate generic AI UI/workbench surfaces toward mature OSS-quality implementations without compromising AgentHub's own product model.

The target surfaces are:

* Chat Thread
* Message Bubble
* Markdown Renderer
* CodeBlock
* Composer
* Tool Call
* Human Approval
* Runtime Status
* Artifact Canvas
* Workbench
* FileTree
* Diff
* Preview
* Terminal

AgentHub-owned facts:

* Workspace
* Session
* Message
* Role Agent
* Runtime Session
* Runtime Event
* Tool Call
* Approval Request
* Action
* Artifact
* DeviceChannel

External projects may influence or supply UI components and architecture patterns. They must not overwrite these facts.

## 3. Data Fidelity Contract

Markdown and runtime regression prevention is mandatory:

1. Runtime/SSE/accumulator/persistence must preserve original message content and structured control events.
2. UI renderers must not infer business meaning from text.
3. `ack`, `status`, `tool`, `approval`, `runtime`, `diff`, and `artifact` events must be typed facts or message parts.
4. Normal assistant Markdown must not contain hidden control events.
5. Display-layer Markdown normalization may exist only as a temporary compatibility shim with tests and an upstream-removal plan.
6. Markdown custom components must produce valid DOM and strip AST-only props before DOM spread.

## 4. OSS Adoption Contract

| Candidate | Required decision |
| --- | --- |
| assistant-ui | Primary immediate candidate for Chat/Message/Composer/Tool/Human Approval. Use direct package/components where adapter proves safe. |
| vercel/ai-elements | Immediate component source for shadcn-style AI primitives. Copy/adapt into AgentHub UI. |
| vercel/chatbot | Spike then use artifact/resumable-stream architecture and type-specific artifact canvas. |
| CopilotKit | Spike after Tool/Approval protocol stabilizes; do not replace AgentHub Action/Approval contracts. |
| OpenHands | Rebuild workbench/runtime/recovery/audit principles in AgentHub framework. |
| stackblitz/bolt.new | Spike Workbench/FileTree/Editor/Preview/Terminal patterns; do not adopt WebContainer execution path. |
| AionUi | Reuse Markdown/local-agent/chat-layout patterns where compatible; no Arco skin. |
| codeg | Reuse transport/reconnect/permission/event-stream principles. |
| cherry-studio | Reference only / clean-room rebuild due AGPL and product-model differences. |
| ClawWork | Spike shared gateway/artifact/approval/session protocol patterns. |
| LobeHub | Reference only due custom Community License and provider-model differences. |
| AgentHub self-host deploy adapter + Caddy hash routes | Preferred v1 deployment route: static deploy folder plus Docker internal-port reverse proxy under single domain/hash path. |
| Coolify/Dokploy/CapRover | Future reference/adapter candidates for PaaS-grade deployment, not required for first self-host v1. |
| Monaco/CodeMirror/react-diff-view/isomorphic-git/Aider/Cline/Continue-style references | Spike small IDE, Trae/Cursor-style selected range context, patch preview/apply, and Git commit-based version history. |
| Slidev/Marp/PptxGenJS/Tiptap/MDXEditor/docxjs/mammoth.js/AFFiNE-style references | Spike rich document, deck/PPT, Markdown/MDX editing, DOCX/PPTX preview, basic editing, and document workspace artifact types. |
| LangGraph/CrewAI/OpenAI Agents SDK/AutoGen/Temporal/Inngest/Trigger.dev/Hatchet | Compare orchestration semantics against AgentHub durable DAG/mailbox for parallel scheduling, fallback, retries, cancellation, recovery, and conflicts. |

Legal/licensing is not a reason to lower product quality. If code cannot be copied, the same capability target must be rebuilt in AgentHub's own architecture.

## 5. UI/UX Contract

Mandatory:

* Main visual route remains `shadcn/ui + Tailwind CSS 4 + lucide-react`.
* All user-visible copy is Simplified Chinese except product/library/command names.
* Cards use restrained radius and shared tokens.
* Buttons and tool actions use lucide icons with Chinese accessible labels/tooltips.
* Web/Desktop/Mobile must look like the same AgentHub product.
* No Arco/Ant/UnoCSS/default external skin becomes the main UI.
* No local CLI API Key/Base URL forms appear in Runtime/Desktop surfaces.

## 6. Phase Contract

### Phase 0: Research And Technical Spike

No production main-path replacement.

Must prove:

* assistant-ui adapter can render AgentHub messages.
* AI Elements components can be adapted to AgentHub tokens.
* Workbench skeleton can use AgentHub file/artifact APIs.
* Runtime events can be represented as typed envelopes.

### Phase 1: Chat/Message/Composer/Markdown/CodeBlock

Must deliver:

* Extracted Thread/Message/Composer components.
* Mature Markdown renderer and CodeBlock.
* No invalid DOM or AST prop leakage.
* Playwright/opencli real chat verification.

### Phase 2: Tool Call/Approval/Human Confirmation/Runtime Status

Must deliver:

* Typed runtime/tool/approval event contract.
* Store-level event reduction moved into tested adapter/reconciler.
* Real approval allow/reject and persisted state.
* Runtime status cards with real runtime/device/cloud health.

### Phase 3: Artifact/Workbench/Preview/FileTree/Diff/Terminal

Must deliver:

* Type-specific artifact canvas.
* FileTree, Preview, Diff, Terminal surfaces.
* Real AgentHub file/artifact/git/runtime APIs only.
* No renderer-side shell bypass.

### Phase 4: Three-Surface Consistency And Visual E2E

Must deliver:

* Shared component hardening across Web/Desktop/Mobile.
* Screenshot and geometry tests for required viewports.
* No horizontal scroll, overlap, text overflow, or sensitive configuration leakage.

## 7. Testing Contract

Minimum automated verification:

* Unit tests for Markdown fidelity, renderer DOM validity, adapter mapping, runtime event ordering, dedupe, replay.
* API tests for message, approval, action, artifact, git, runtime status persistence.
* Playwright Web desktop: 1440x900 and 1024x768.
* Playwright Mobile/PWA: 390x844.
* Playwright Electron: 1200x800.
* opencli UAT for at least one real Chat -> Tool/Approval -> Artifact/Workbench flow before broad rollout.

Assertions:

* `document.body.scrollWidth <= window.innerWidth + 1`.
* Chat, composer, side/workbench panels do not overlap.
* Long Chinese text, long paths, long code, and large tool output do not overflow.
* Loading/running/disabled states do not resize fixed-format controls.
* Reload restores persisted message/tool/approval/artifact state.
* No mock runtime data is used to satisfy flows that require real runtime/API/session behavior.

## 8. Prohibited Patterns

* Replacing AgentHub DB/API/runtime contracts with external project schemas.
* Copying restricted-license source directly into AgentHub.
* Introducing another main UI skin.
* Parsing tool/approval/status business semantics from Markdown text.
* Treating `status.json completed`, component existence, or screenshot-only evidence as completion.
* Using fake/script runtime as product proof for real runtime flows.
* Allowing Web/Mobile/Desktop to diverge into three unrelated UI systems.

## 9. Completion Gate

This contract is complete for planning when:

* The Trellis PRD references this contract and the open-source migration research.
* Every candidate has an adoption depth and comparison table.
* Phase 0-4 completion conditions are testable.
* Recommended priority is recorded.

This contract is complete for implementation only after the relevant phase has:

* Passing unit/API tests.
* Passing Playwright/opencli evidence.
* Updated task report/tracker where applicable.
* No unresolved P0 Markdown/runtime/UI fidelity regression.
