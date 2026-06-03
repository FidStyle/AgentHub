# Cross-Layer Thinking Guide

> **Purpose**: Think through data flow across layers before implementing.

---

## The Problem

**Most bugs happen at layer boundaries**, not within layers.

Common cross-layer bugs:
- API returns format A, frontend expects format B
- Database stores X, service transforms to Y, but loses data
- Multiple layers implement the same logic differently

---

## Before Implementing Cross-Layer Features

### Step 1: Map the Data Flow

Draw out how data moves:

```
Source → Transform → Store → Retrieve → Transform → Display
```

For each arrow, ask:
- What format is the data in?
- What could go wrong?
- Who is responsible for validation?

### Step 2: Identify Boundaries

| Boundary | Common Issues |
|----------|---------------|
| API ↔ Service | Type mismatches, missing fields |
| Service ↔ Database | Format conversions, null handling |
| Backend ↔ Frontend | Serialization, date formats |
| Component ↔ Component | Props shape changes |

### Step 3: Define Contracts

For each boundary:
- What is the exact input format?
- What is the exact output format?
- What errors can occur?

### Step 4: Fix Root Cause At The Owning Boundary

Before adding a local workaround, ask:
- Which layer owns the missing fact or invariant?
- Is the current fix reconstructing that fact from symptoms?
- Would a reference project solve this in a reducer/protocol/store instead of the visible component?
- Is there already an ideal path in `refer_proj/*` or AgentHub shared code that
  preserves the data without heuristic repair?

If the UI has to guess whether data is duplicated, stale, replayed, partial, authorized, or terminal, the contract is probably missing a field. Add the field and tests at the producer/consumer boundary first.

If the UI has to guess Markdown structure, terminal state, stream ordering,
message role semantics, or copy semantics from already-corrupted text, the ideal
path has already been bypassed. Restore the path before adding display logic.

---

## Common Cross-Layer Mistakes

### Mistake 1: Implicit Format Assumptions

**Bad**: Assuming date format without checking

**Good**: Explicit format conversion at boundaries

### Mistake 2: Scattered Validation

**Bad**: Validating the same thing in multiple layers

**Good**: Validate once at the entry point

### Mistake 3: Leaky Abstractions

**Bad**: Component knows about database schema

**Good**: Each layer only knows its neighbors

### Mistake 4: Symptom Heuristics In The Wrong Layer

**Bad**: Markdown renderer drops chunks because normalized text "looks replayed".

**Good**: Runtime producers emit explicit `mode` and monotonic `seq`; consumers use a shared accumulator and renderers only render final content.

### Mistake 5: Shallow Reference-Project Copying

**Bad**: Copy only a reference project's colors, spacing, or component shape while missing the state/reducer/protocol rule that makes the component reliable.

**Good**: Study how the reference project assigns responsibility: where IDs are stable, where append vs replace is decided, how duplicate events are ignored, and which layer owns copy controls. Then migrate the same responsibility boundary into AgentHub with AgentHub types and tests.

### Mistake 6: Bending The Ideal Path With Symptom Repair

**Bad**: A valid reusable path exists, but the fix starts by adding regex
normalizers, partial DOM cleanup, or UI masking. These patches may make the
current screenshot look better while changing the meaning of future valid input.

**Good**: Preserve the source contract first. For streaming messages, the ideal
path is:

```text
runtime event producer -> shared accumulator/reducer -> persistence -> API -> UI renderer
```

Each layer should pass through valid Markdown/content without reconstructing it
from symptoms. Renderers may normalize safe transport details such as CRLF line
endings, but must not infer Markdown block structure, replay boundaries, or
message role policy.

---

## Checklist for Cross-Layer Features

Before implementation:
- [ ] Mapped the complete data flow
- [ ] Identified all layer boundaries
- [ ] Defined format at each boundary
- [ ] Decided where validation happens
- [ ] 如果功能涉及本地 Claude Code / Codex Runtime，先检查 `.trellis/spec/cross-layer/runtime-credential-boundary.md`，确认没有把本地 CLI API Key 混入 Role Agent、Workspace、Session 或 Runtime Binding。
- [ ] 如果修复依赖“看起来像”“正则猜测”“归一化后比较”“UI 兜底”，先反查哪个协议/API/DB 字段缺失，并优先补契约。
- [ ] 参考项目调研必须记录责任边界，不只记录组件外观；例如 codeg/AionUi 的消息 append/replace、stable id、copy 控制分别在哪一层实现。
- [ ] 对 streaming/runtime/message 问题，先检查事件语义（append/replace/seq/id/terminal）再改 Markdown 或样式组件。
- [ ] 当已有参考实现或共享工具能走通理想路径时，禁止先提交 symptom repair；必须在代码或 PR 说明中写明采用/未采用参考路径的原因。
- [ ] Renderer 层只能做渲染和安全的传输归一化，不能负责恢复上游丢失的换行、围栏、消息角色或事件顺序。

After implementation:
- [ ] Tested with edge cases (null, empty, invalid)
- [ ] Verified error handling at each boundary
- [ ] Checked data survives round-trip
- [ ] 增加了能证明“治本”的测试：生产端字段、共享 reducer/accumulator、所有消费端行为，而不是只测某个 UI 症状消失。

---

## Cross-Platform Template Consistency

In Trellis, command templates (e.g., `record-session.md`) exist in **multiple platforms** with identical or near-identical content. This is a cross-layer boundary.

### Checklist: After Modifying Any Command Template

- [ ] Find all platforms with the same command: `find src/templates/*/commands/trellis/ -name "<command>.*"`
- [ ] Update all platform copies (Markdown `.md` and TOML `.toml`)
- [ ] For Gemini TOML: adapt line continuations (`\\` vs `\`) and triple-quoted strings
- [ ] Run `/trellis:check-cross-layer` to verify nothing was missed

**Real-world example**: Updated `record-session.md` in Claude to use `--mode record`, but forgot iFlow, Kilo, OpenCode, and Gemini — caught by cross-layer check.

---

## Generated Runtime Template Upgrade Consistency

Some generated files are both documentation and runtime input. In Trellis,
`.trellis/workflow.md` is parsed by `get_context.py`, `workflow_phase.py`,
SessionStart filters, and per-turn hooks. Template changes must be validated
against both fresh init and upgrade paths.

### Checklist: After Modifying A Runtime-Parsed Template

- [ ] Identify every runtime parser that reads the template, not just the file
  writer that installs it
- [ ] Check whether relevant syntax lives outside obvious managed regions
  such as tag blocks
- [ ] Verify fresh `init` output and a versioned `update` scenario that writes
  the older `.trellis/.version`
- [ ] Add an upgrade regression using an older pristine template fixture, then
  assert the installed file reaches the current packaged shape
- [ ] Update the backend spec that owns the runtime contract

**Real-world example**: Codex inline mode changed workflow platform markers from
`[Codex]` / `[Kilo, Antigravity, Windsurf]` to `[codex-sub-agent]` /
`[codex-inline, Kilo, Antigravity, Windsurf]`. Fresh init was correct, but
`trellis update` only merged `[workflow-state:*]` blocks and preserved stale
markers outside those blocks. Result: upgraded projects got new hook scripts
but old workflow routing, so `get_context.py --mode phase --platform codex`
could return empty Phase 2.1 detail.

---

## Mode-Detection Probe Checklist

When a CLI auto-detects a mode by probing a remote resource (e.g., checking if `index.json` exists to decide marketplace vs direct download):

### Before implementing:
- [ ] Probe runs in **ALL** code paths that use the result (interactive, `-y`, `--flag` combos)
- [ ] 404 vs transient error are distinguished — don't treat both as "not found"
- [ ] Transient errors **abort or retry**, never silently switch modes
- [ ] Shared state (caches, prefetched data) is **reset** when context changes (e.g., user switches source)
- [ ] **Shortcut paths** (e.g., `--template` skipping picker) must have the same error-handling quality as the probed path — check that downstream functions don't call catch-all wrappers

### After implementing:
- [ ] Trace every path from probe result to the mode-decision branch — no fallthrough
- [ ] External format contracts (giget URI, raw URLs) are tested or at least documented as comments
- [ ] Metadata reads consume a complete response or use a streaming parser — never parse a fixed-size prefix as full JSON
- [ ] When reconstructing a composite identifier from parsed parts, verify **all** fields are included and in the **correct position** (e.g., `provider:repo/path#ref` not `provider:repo#ref/path`)
- [ ] Verify that **action functions** called after a shortcut don't internally use the old catch-all fetch — they must use the probe-quality variant when error distinction matters

**Real-world example**: Custom registry flow had 8 bugs across 3 review rounds: (1) probe only ran in interactive mode, (2) transient errors fell through to wrong mode, (3) giget URI had `#ref` in wrong position, (4) prefetched templates leaked across source switches, (5) `--template` shortcut bypassed probe but `downloadTemplateById` internally used catch-all `fetchTemplateIndex`, turning timeouts into "Template not found".

**Real-world example**: Agent-session update hints fetched npm `latest` metadata with `response.read(4096)` and then parsed it as complete JSON. The `@mindfoldhq/trellis` package metadata exceeded 4 KB, so the JSON was truncated, parse failed silently, and the first session injection showed no update hint. Fix: read the complete response before parsing, and add a regression where `version` is followed by an 8 KB metadata tail.

---

## When to Create Flow Documentation

Create detailed flow docs when:
- Feature spans 3+ layers
- Multiple teams are involved
- Data format is complex
- Feature has caused bugs before
