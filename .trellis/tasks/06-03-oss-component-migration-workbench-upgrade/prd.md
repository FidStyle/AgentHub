# Mature OSS Component Migration and Workbench Upgrade

## Goal

Design a long-term, staged technical plan for upgrading AgentHub's Chat, Markdown, Artifact, Workbench, Composer, Tool Call, Approval, and related runtime UI surfaces by reusing mature open-source components or implementation patterns where practical, while preserving AgentHub's data fidelity, runtime semantics, and `shadcn/ui + Tailwind CSS 4 + lucide-react` visual direction.

## What I Already Know

* AgentHub should stop hand-rolling generic UI/runtime surfaces when mature OSS components or implementation patterns can be reused safely.
* User preference confirmed: product capability should not be compromised because of license friction. MIT/Apache-style projects can be used directly where appropriate; restricted/custom-license projects should be clean-room rebuilt into AgentHub's own framework at the same capability target.
* Markdown regressions showed that UI renderers must not heuristically repair upstream content. Runtime/SSE/accumulator/persistence must preserve original content, and control events must not be mixed into normal assistant text.
* The renderer direction should prefer mature Markdown parsing/rendering such as `react-markdown + remarkGfm`, with optional `remark-math + rehype-katex`.
* Custom code blocks, tables, links, and image components must produce valid DOM and must not leak AST-only props such as `node` to DOM elements.
* The plan must evaluate `assistant-ui`, `vercel/ai-elements`, `vercel/chatbot`, `CopilotKit`, `OpenHands`, `stackblitz/bolt.new`, `AionUi`, `codeg`, `cherry-studio`, plus any better candidates found during research.
* This task is planning only. It must not begin large-scale component replacement.

## Assumptions (Temporary)

* The preferred migration strategy will be incremental and adapter-led rather than a full UI rewrite.
* AgentHub's existing backend/session/runtime protocol should remain the source of truth unless a planned contract change is explicitly accepted.
* Candidate projects may be reused at different depths: dependency adoption, component extraction, interaction pattern reuse, architecture reference, or research-only.

## Open Questions

* None blocking for planning. Implementation phases still require focused spikes before production replacement.

## Requirements (Evolving)

* Produce `research/open-source-component-migration.md` under this task.
* Produce or update `research/contracts/<TASK-ID>.md` if cross-layer contracts are needed.
* Include a per-candidate comparison table covering current AgentHub implementation, future implementation, technical differences, reusable modules, required adapters, risks, and verification.
* Include phased rollout from Phase 0 through Phase 4 with measurable completion criteria.
* Explicitly classify recommendation priority: immediately do, spike then do, reference only, or not recommended.

## Acceptance Criteria (Evolving)

* [x] Every required candidate has a comparison table.
* [x] Every migration phase has clear, testable completion conditions.
* [x] The plan states which components can be directly reused and which can only be referenced.
* [x] License, dependency, style-system, and data-model risks are documented.
* [x] Playwright/opencli verification covers real UI behavior, not only component existence.
* [x] The plan preserves the current `shadcn/ui + Tailwind CSS 4 + lucide-react` visual direction.

## Definition of Done (Team Quality Bar)

* Planning documents are complete and internally consistent.
* Referenced local constraints and current implementation files have been inspected.
* OSS findings include source links and current license/status notes where available.
* No large-scale replacement code is started in this task.

## Out of Scope

* Replacing Chat, Markdown, Artifact, Workbench, Composer, Tool Call, Approval, or runtime components in production code.
* Adding new UI skin systems that compete with AgentHub's main visual language.
* Using mock runtime data to validate MVP product flows that require real database/API/session behavior.

## Technical Notes

* Task directory: `.trellis/tasks/06-03-oss-component-migration-workbench-upgrade`
* Required local inputs inspected: frontend component/style specs, IM foundation, UI visual testing, reference projects, Markdown regression ledger, current Markdown/message/artifact/session-store implementation.
* OSS research completed in [`research/open-source-component-migration.md`](research/open-source-component-migration.md).
* Cross-layer contract created at [`research/contracts/OSS-COMPONENT-MIGRATION-WORKBENCH-UPGRADE-2026-06-03.md`](../../../research/contracts/OSS-COMPONENT-MIGRATION-WORKBENCH-UPGRADE-2026-06-03.md).

## Research References

* [`research/open-source-component-migration.md`](research/open-source-component-migration.md) — Full candidate comparison, phased roadmap, verification plan, and recommendation priority.
* [`research/bytedance-gap-migration-map.md`](research/bytedance-gap-migration-map.md) — Bytedance PRD gap map showing which incomplete functions are easy to complete through migration and which need deeper GitHub-backed adapters or clean-room rebuilds.
* [`research/contracts/OSS-COMPONENT-MIGRATION-WORKBENCH-UPGRADE-2026-06-03.md`](../../../research/contracts/OSS-COMPONENT-MIGRATION-WORKBENCH-UPGRADE-2026-06-03.md) — Shared implementation contract for future Trellis/Maestro/Ralph work.

## Research Notes

### What Similar Tools Do

* `assistant-ui` and `vercel/ai-elements` split AI chat into Thread, Message, Composer, ActionBar, Tool, Reasoning, and Approval primitives instead of page-local message loops.
* `vercel/chatbot` and `bolt.new` treat artifacts/workbench as typed product surfaces: code/text/image/sheet artifacts, file tree, editor, preview, diff, terminal, and running state.
* `OpenHands`, `AionUi`, `codeg`, and `ClawWork` show that runtime status, transport replay, gateway frames, local agent inventory, and approval/audit must be explicit architecture, not UI string parsing.
* The Bytedance gap map reclassifies the 12 incomplete acceptance points: IM list/actions and Agent contact UX are quick wins; code editing, artifact canvas, Desktop/Mobile completion are medium; deployment, version history, PPT/rich-doc editing, safe parallel coding are hard and need dedicated adapters.
* Follow-up user decisions refine that classification: deployment v1 should be self-hosted static/Docker behind Caddy hash routes; selected-code modification follows Trae/Cursor-style selected range context plus patch confirmation; full editing is a small IDE; version history can start from Git commits; rich document/PPT generation, preview, and basic editing are feasible; Orchestrator parallel/fallback/conflict handling requires deeper framework/workflow research.

### Constraints From AgentHub

* AgentHub's source of truth remains its own Workspace, Session, Message, Role Agent, Runtime, Action, Approval, Artifact, and DeviceChannel contracts.
* Main UI remains `shadcn/ui + Tailwind CSS 4 + lucide-react`; no external visual skin becomes the product skin.
* Markdown and control-event fidelity must be solved upstream, not by display-layer guessing.
* Real UI verification must use Playwright/opencli against actual workspace/session/API/runtime flows.

### Feasible Approach

**Approach A: Adapter-led OSS migration** (Recommended)

* Use assistant-ui and AI Elements immediately for Chat/Message/Composer/Tool/Approval component anatomy.
* Use Vercel Chatbot and bolt.new after spikes for Artifact/Workbench target capability.
* Use AionUi/codeg/ClawWork architecture where compatible.
* Rebuild OpenHands/cherry-studio/LobeHub-style capabilities cleanly when source/license/product model blocks direct migration.

## Decision (ADR-lite)

**Context**: AgentHub currently owns too much generic Chat, Markdown, Composer, Tool Call, Approval, Artifact, and Workbench UI logic. The Markdown regression showed that hand-rolled display-layer heuristics create fragile behavior.

**Decision**: Use an adapter-led migration toward mature OSS-quality implementations. Directly adopt permissive components where they fit. For restricted/custom-license projects, rebuild equivalent capability in AgentHub's own architecture instead of lowering product quality. Preserve AgentHub data/protocol contracts and visual system.

**Consequences**: The first implementation work must focus on adapters, shared types, and verification gates before broad UI replacement. This lowers regression risk and keeps future migrations from importing incompatible stores, schemas, styles, or runtime assumptions.
