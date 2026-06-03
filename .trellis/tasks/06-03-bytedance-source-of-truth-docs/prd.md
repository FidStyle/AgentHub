# Bytedance Source of Truth Docs

## Goal

Make `bytedance_init_prd.md` the highest-priority product source for AgentHub and update downstream planning documents so future work does not treat the current PRD as an independent truth source when it conflicts with the original Bytedance assignment.

## Source of Truth

1. `bytedance_init_prd.md` is the canonical product assignment.
2. `bytedance_init_video_txt.txt` is supporting clarification from the assignment briefing.
3. `research/prd.md`, product design, technical design, contracts, trackers, and Trellis specs are derived documents.
4. When a derived document conflicts with the Bytedance source, the derived document must be corrected before implementation continues.

## Requirements

- Update `research/prd.md` so its priority and scope are explicitly derived from `bytedance_init_prd.md`.
- Update product and technical design docs to reference the Bytedance assignment as the root source, not only the current PRD.
- Preserve existing completed implementation evidence, but make gaps visible against the Bytedance assignment.
- Update Trellis planning/audit specs so future tasks read Bytedance source first and treat FR-IDs as a derived registry.
- Avoid changing production code.

## Acceptance Criteria

- [x] `research/prd.md` states the source priority and Bytedance-derived P0/P1/P2 interpretation.
- [x] `research/product/product-design.md` and `research/architecture/technical-design.md` state the same source hierarchy.
- [x] `research/index.md` points maintainers to the source hierarchy.
- [x] Trellis guide/spec files no longer imply `research/prd.md` is the highest product fact source.
- [x] The update records that unresolved Bytedance requirements include message operations, advanced artifact editing, deployment/publishing, richer documents/PPT, and full multi-surface completion.

## Out of Scope

- Implementing missing product features.
- Rewriting contracts for every completed task.
- Editing old execution reports.
