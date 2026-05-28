# Thinking Guides

> **Purpose**: Expand your thinking to catch things you might not have considered.

---

## Why Thinking Guides?

**Most bugs and tech debt come from "didn't think of that"**, not from lack of skill:

- Didn't think about what happens at layer boundaries → cross-layer bugs
- Didn't think about code patterns repeating → duplicated code everywhere
- Didn't think about edge cases → runtime errors
- Didn't think about future maintainers → unreadable code

These guides help you **ask the right questions before coding**.

---

## Available Guides

| Guide | Purpose | When to Use |
|-------|---------|-------------|
| [Code Reuse Thinking Guide](./code-reuse-thinking-guide.md) | Identify patterns and reduce duplication | When you notice repeated patterns |
| [Cross-Layer Thinking Guide](./cross-layer-thinking-guide.md) | Think through data flow across layers | Features spanning multiple layers |
| [End-to-End Contract Planning Guide](./end-to-end-contract-planning.md) | Prevent fake product closure in plans and acceptance criteria | Before planning/reviewing auth, workspace, DB, runtime, E2E, or three-surface flows |
| [Product Planning Thinking Guide](./product-planning-guide.md) | Keep AgentHub work bound to PRD FR-IDs and product design | Before implementing AgentHub product slices |

---

## Quick Reference: Thinking Triggers

### When to Think About Cross-Layer Issues

- [ ] Feature touches 3+ layers (API, Service, Component, Database)
- [ ] Data format changes between layers
- [ ] Multiple consumers need the same data
- [ ] You're not sure where to put some logic

→ Read [Cross-Layer Thinking Guide](./cross-layer-thinking-guide.md)

### When to Think About Code Reuse

- [ ] You're writing similar code to something that exists
- [ ] You see the same pattern repeated 3+ times
- [ ] You're adding a new field to multiple places
- [ ] **You're modifying any constant or config**
- [ ] **You're creating a new utility/helper function** ← Search first!

→ Read [Code Reuse Thinking Guide](./code-reuse-thinking-guide.md)

### When to Think About Product Traceability

- [ ] You're implementing an AgentHub product feature
- [ ] The task touches Web, Desktop, Mobile, Runtime Adapter, Workspace, Session, or Role Agent behavior
- [ ] You're unsure which `FR-ID` owns the behavior
- [ ] A UI decision could change the PRD or product-design contract

→ Read [Product Planning Thinking Guide](./product-planning-guide.md)

### When to Think About End-to-End Contract Closure

- [ ] A plan claims P0/MVP flow completion
- [ ] The task touches auth, database, API, runtime, workspace, session, message, E2E, or Desktop/Web/Mobile consistency
- [ ] The acceptance criteria mention file existence, grep, mock APIs, placeholder responses, or `playwright --list`
- [ ] A known user-discovered issue is being converted into a plan

→ Read [End-to-End Contract Planning Guide](./end-to-end-contract-planning.md)

---

## Pre-Modification Rule (CRITICAL)

> **Before changing ANY value, ALWAYS search first!**

```bash
# Search for the value you're about to change
grep -r "value_to_change" .
```

This single habit prevents most "forgot to update X" bugs.

---

## How to Use This Directory

1. **Before coding**: Skim the relevant thinking guide
2. **During coding**: If something feels repetitive or complex, check the guides
3. **After bugs**: Add new insights to the relevant guide (learn from mistakes)

---

## Contributing

Found a new "didn't think of that" moment? Add it to the relevant guide.

---

**Core Principle**: 30 minutes of thinking saves 3 hours of debugging.
