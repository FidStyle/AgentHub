# State Management

> How state is managed in this project.

---

## Overview

<!--
Document your project's state management conventions here.

Questions to answer:
- What state management solution do you use?
- How is local vs global state decided?
- How do you handle server state?
- What are the patterns for derived state?
-->

(To be filled by the team)

---

## State Categories

<!-- Local state, global state, server state, URL state -->

(To be filled by the team)

---

## When to Use Global State

<!-- Criteria for promoting state to global -->

(To be filled by the team)

---

## Server State

<!-- How server data is cached and synchronized -->

### Pattern: Readback Revision For Identical Server Payloads

When UI behavior must react to a successful server readback, do not rely only on array identity or derived content signatures. A refresh can return the exact same rows while still being a meaningful user-visible event, such as a command approval polling `GET /api/messages` to confirm that runtime state has been read back.

For Zustand stores, keep a small local revision counter next to the readback state and increment it only after a successful fetch:

```ts
set((state) => ({
  messages,
  messagesRevision: state.messagesRevision + 1,
  loading: false,
}))
```

Components that need to react to readback completion should subscribe to both semantic content changes and the revision. This keeps full API refreshes correct without introducing fake message changes or UI-only heuristics.

---

## Common Mistakes

<!-- State management mistakes your team has made -->

- Treating "same response body" as "nothing happened" when the product behavior depends on the readback event itself. Add a local revision instead of mutating message content or skipping the refresh.
