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
- [ ] Web/Mobile are described and implemented as control surfaces for both Cloud and Local Desktop Workspaces; local file writes, shell commands, and Runtime calls for Local Desktop Workspaces land only in Desktop Connector.
- [ ] User-facing chat targets are Role Agents, not Claude Code/Codex tool names.
- [ ] Confirmation UX is tied to plans, next steps, permissions, retries, or publish/deploy actions; Diff remains display material.
- [ ] Mobile and Desktop are not treated as full Web clones.

For Phase 2 technical selection:

- [ ] Module research documents under `research/modules/` cite the owning `FR-ID`.
- [ ] Reference repository evidence is recorded under `research/reference-repos/` and summarized in `research/modules/reference-projects.md`.
- [ ] Popularity and relevance are kept separate; low-star CLI/session/PTY/resume/runtime-adapter repositories are manually reviewed before being dismissed.
- [ ] Generated scores are treated as first-pass signals, not final architecture decisions.

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

### Mistake: Saying Web/Mobile Cannot Control Local Workspaces

**Symptom**: Copy or code treats "Web/Mobile do not directly write local files" as "Web/Mobile cannot control a user's local Desktop Workspace".

**Fix**: Web/Mobile can send task messages, approvals, and Action requests for Local Desktop Workspaces. The boundary is execution location: local file writes, shell commands, and Claude/Codex calls must go through the authenticated Desktop Connector.

### Mistake: Approving Diff Instead of Action

**Symptom**: A Git diff card asks for approval by itself.

**Fix**: Approval belongs to the task plan, permission escalation, next step, retry, or publish/deploy action. Diff is supporting context.

### Mistake: Letting Reference Repo Popularity Decide Architecture

**Symptom**: A high-star generic chat or client project becomes the default reference for Runtime Adapter, Desktop Connector, or Device Gateway decisions.

**Fix**: Use `research/reference-repos/repo-catalog.json` and `research/modules/reference-projects.md` together. Favor repositories with direct evidence for the module risk being evaluated, such as CLI subprocess control, native session resume, PTY handling, WebSocket gateway behavior, approval events, and artifact persistence.
