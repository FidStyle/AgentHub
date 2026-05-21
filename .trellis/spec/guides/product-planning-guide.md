# Product Planning Thinking Guide

> **Purpose**: Keep AgentHub implementation work bound to the approved product documents and FR-IDs.

---

## Before Implementing AgentHub Product Work

Read these documents first:

- `research/prd.md`
- `research/product-design.md`
- The active `.trellis/tasks/*/prd.md` slice

Then verify:

- [ ] Every task names the PRD `FR-ID` it implements.
- [ ] UI behavior matches the page, flow, component, and state design in `research/product-design.md`.
- [ ] Workspace execution domain is explicit: `Cloud Workspace` or `Local Desktop Workspace`.
- [ ] No code path mixes Cloud Runtime and Local Desktop Runtime inside one Workspace or Session.
- [ ] User-facing chat targets are Role Agents, not Claude Code/Codex tool names.
- [ ] Confirmation UX is tied to plans, next steps, permissions, retries, or publish/deploy actions; Diff remains display material.
- [ ] Mobile and Desktop are not treated as full Web clones.

---

## FR-ID Traceability Rule

Each implementation task should include:

- `FR-ID`: one or more requirement IDs from `research/prd.md`.
- `Product surface`: Web, Desktop, Mobile, Backend, Runtime Adapter, or shared domain model.
- `Acceptance source`: the exact PRD acceptance criteria or product-design flow being implemented.

If a behavior cannot be mapped to an existing `FR-ID`, pause and update the PRD before implementing it.

---

## Common Mistakes

### Mistake: Treating Runtime Names as Chat Participants

**Symptom**: UI says "send to Claude Code" or "assign to Codex".

**Fix**: UI should say "send to Frontend Engineer", "assign to Code Reviewer", or another Role Agent. Runtime names only appear in configuration and diagnostics.

### Mistake: Making Mobile a Small Web IDE

**Symptom**: Mobile includes complex code editing or Runtime binding.

**Fix**: Mobile P0 is lightweight IM, approval, progress, and preview.

### Mistake: Approving Diff Instead of Action

**Symptom**: A Git diff card asks for approval by itself.

**Fix**: Approval belongs to the task plan, permission escalation, next step, retry, or publish/deploy action. Diff is supporting context.
