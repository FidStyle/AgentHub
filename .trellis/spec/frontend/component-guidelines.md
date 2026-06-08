# Frontend Component Guidelines

## Scenario: AgentHub User-Visible Workbench Components

### 1. Scope / Trigger

- Trigger: modifying Web/Mobile chat, composer, role contacts, permission cards, right workbench, Git/File/Artifact panels, Markdown rendering, or publish controls.

### 2. Signatures

- Stable test IDs: `workspace-shell`, `session-sidebar`, `chat-panel`, `message-composer`, `artifact-overlay`, `artifact-resize-handle`, `authorization-card`, `artifact-panel`.
- Message readback: `GET /api/messages?session_id=...`
- Timeline readback: `GET /api/sessions/:sessionId/timeline`
- Git APIs: status, diff, stage, unstage, discard, commit.
- Artifact publish: `POST /api/artifacts/:id/publish` with `{ action: "start" | "stop" }`.

### 3. Contracts

- Reuse existing project components and shadcn/Tailwind/lucide patterns before adding new UI.
- User-visible text is Simplified Chinese unless it is a technical product/command name.
- Chat transcript must show IM-visible work: Orchestrator allocation, role replies, handoffs, validation, permission cards, and artifact recommendation.
- Right workbench tabs are single-responsibility: `过程`, `编排`, `文件`, `Git`, `产物`, `角色`.
- Right workbench width is draggable on desktop and persisted; mobile uses drawer behavior.
- File and Git trees default to zero expanded directories; selecting/creating deep items expands ancestors.
- Text-like files are editable in the viewer; binary/document/presentation files are read/download/preview only.
- File/code/artifact quote actions insert a visible composer quote with path/title, line range or summary, character count where applicable, and original snippet/summary.
- Git is progressive: file list first, selected diff on demand, then stage/unstage/discard/commit/reset controls.
- Runnable artifacts expose `启动发布`, `停止发布`, and a clickable link. Raw command copying is not the primary path.
- Role Agent tags render as colored `#xxx` chips; tools and runtime render separately.

### 4. Validation & Error Matrix

| Condition | Required UI behavior |
| --- | --- |
| Permission pending | risk/details plus `允许本次操作` and `拒绝` |
| Permission approved | buttons replaced by `已允许`/`已审批`; execution progress appears separately |
| Role acknowledgement exists | central transcript renders it with role badge |
| Git tab opened | shows file names/status before diff |
| File selection quoted | composer shows file path, line range, char count, snippet |
| Artifact runnable | start/stop publish controls and link are visible |
| Unimplemented button | disabled or removed with Chinese reason |

### 5. Good/Base/Bad Cases

- Good: One-prompt product run shows role process in chat, Git/File/Artifact tabs read back durable data, and publish starts by button.
- Base: Clean Git status shows an empty state with no diff.
- Bad: Right panel mixes Git, approvals, runtime logs, and artifacts in one generic changes tab.
- Bad: Backend supports code patching but UI gives no quote/select path.

### 6. Tests Required

- Component tests for role tags, permission labels, quote-to-composer, artifact publish controls, and rich message cards.
- Web E2E for transcript process, right panel resize, File quote, Git progressive diff, Artifact start/stop publish.
- Mobile/PWA readback for messages, approvals, and artifact/publish status when shared components are affected.
- Visual assertions: no horizontal overflow, no overlapping controls, stable composer after resize.

### 7. Wrong vs Correct

#### Wrong

- Show "已完成" because the right timeline has records while the chat transcript has no role replies.

#### Correct

- Show completion only after central transcript, timeline, artifact, and tests agree.
