# 组件规范

> AgentHub 前端组件的实现方式。涉及 UI 的任务还必须读取 `./ui-style-guidelines.md` 和 `research/product/ui-design-system.md`。

---

## 概览

组件必须服务于 Bytedance 原始来源和派生 PRD 中的 `FR-ID`，不能为了局部页面临时堆样式。P0 组件基线为 `shadcn/ui + Tailwind CSS 4 + lucide-react`。

优先顺序：

1. 复用现有项目组件。
2. 复用或改造已授权参考项目中的组件/模块实现。
3. 按 shadcn/ui 模式抽取可组合组件。
4. 页面内写小型私有组件。
5. 只有在确实无法复用时，才新增组件变体。

### Convention: 已授权参考组件优先复用

**What**: `refer_proj/` 中已纳入项目参考范围、且用户明确授权的组件和模块，可以直接复用实现思路或代码结构，再按 AgentHub 的产品模型、类型、中文文案和样式系统改造。

**Why**: Markdown 渲染、消息气泡、代码块复制、审批卡、任务状态卡等通用能力不应重复从零试错。实现时优先把可复用部分落成本项目组件，而不是因为许可顾虑停在讨论阶段。

**Rules**:

- 复用时必须改成 AgentHub 的领域类型和 props，不能把参考项目的数据模型、路由、全局 store 或运行时假设原样带入。
- 复用 UI 时必须接入本项目的 Tailwind 变量、中文文案、`data-testid`、可访问名称和视觉测试要求。
- Markdown 渲染类组件优先直接复用并改造 `refer_proj/AionUi/packages/desktop/src/renderer/components/Markdown/` 的组件拆分：`Markdown/index.tsx`、`CodeBlock.tsx`、`markdownUtils.ts`。必须保留换行、列表、代码块、表格、链接、代码复制和宽表格横向滚动等富文本语义；禁止把 agent 消息作为普通纯文本 `<div>` 渲染后声称支持 Markdown。
- Agent/runtime 上游偶尔会把 Markdown 列表压成同一行；显示层可以对常见 `-` / `*` / `1.` 分点做保守换行恢复，但必须有纯函数单测并保护代码块内容。不要把普通 `+` 号当列表 marker，否则会误伤 `pg + drizzle`、`输入框 + 按钮` 等业务文本。
- 流式 Agent 回复不能直接按上游 SSE/CLI chunk 粒度刷新可见文本。UI 层必须有平滑显示缓冲、空内容时的“思考中”状态和稳定的 streaming/completed 标记；否则 CLI 偶发大块输出会表现为一卡一卡地跳字。Markdown 自定义 components 必须 memoize，避免流式更新时反复卸载代码块、表格和复制按钮。
- 可直接复用依赖组合、组件拆分、队列/lease 算法和边界处理；样式、类型、产品状态、权限语义和持久化模型必须按 AgentHub Bytedance 原始材料、派生 PRD 和 spec 调整。

**Example**:

```tsx
// Good: copy the reference renderer shape, but bind to AgentHub props and styling.
type MessageMarkdownProps = {
  content: string
  role: 'user' | 'agent' | 'orchestrator'
}

export function MessageMarkdown({ content, role }: MessageMarkdownProps) {
  return (
    <div data-testid={`message-markdown-${role}`} className="prose prose-sm max-w-none text-foreground">
      {/* Use the chosen markdown renderer stack here; component API remains AgentHub-owned. */}
      <MarkdownRenderer source={content} />
    </div>
  )
}
```

```tsx
// Bad: reference project store/model leaks into AgentHub UI.
export function MessageMarkdown({ externalConversationNode }: ReferenceProjectMessageProps) {
  return <div>{externalConversationNode.rawText}</div>
}
```

**Related**: `research/modules/im-foundation.md` requires Markdown rendering and code-block copy as P0 chat capability.

---

## 组件结构

组件文件应保持职责单一：

- 展示组件只接收 typed props，不直接读取跨层全局数据。
- 容器组件负责数据读取、状态派发和页面级编排。
- 富内容组件必须显式处理 loading、empty、error、success 状态。
- 关键 UI 容器必须提供稳定定位点，供 Playwright 使用。

推荐定位点：

- `data-testid="workspace-shell"`
- `data-testid="session-sidebar"`
- `data-testid="chat-panel"`
- `data-testid="message-composer"`
- `data-testid="artifact-panel"`
- `data-testid="authorization-card"`
- `data-testid="desktop-main-shell"`
- `data-testid="runtime-status-card"`
- `data-testid="mobile-session"`

---

## Props 约定

- props 使用 TypeScript 明确类型，禁止把跨层领域对象直接传到深层组件后随意读取。
- 状态类 props 使用有限枚举，例如 `pending | running | succeeded | failed`。
- 组件需要触发动作时，使用语义回调名，例如 `onAuthorize`、`onCancel`、`onRetry`、`onOpenPreview`。
- 文案由上层传入时也必须是中文；组件内部默认文案同样使用中文。
- Runtime 名称只作为配置或诊断摘要出现，不作为聊天对象或主要行动对象。

示例：

```tsx
type RuntimeStatus = 'ready' | 'not_installed' | 'auth_required' | 'error'

type RuntimeStatusCardProps = {
  runtimeName: 'Claude Code' | 'Codex'
  status: RuntimeStatus
  version?: string
  onDetectAgain: () => void
}
```

---

## 样式模式

- 使用 Tailwind CSS 4 和语义变量，例如 `bg-card`、`text-muted-foreground`、`border`。
- 使用 `cn()` 或等价工具组合 class，避免字符串拼接失控。
- 动态样式只用于少量尺寸、位置或颜色变量，禁止用大段 `style={{ ... }}` 复刻 CSS。
- 卡片默认圆角不超过 8px；页面 section 不做装饰性浮卡。
- 工具按钮优先使用 lucide 图标，并提供中文 `aria-label` 或 tooltip。

错误：

```tsx
<button style={{ padding: 12, borderRadius: 999, background: 'linear-gradient(...)' }}>
  Send
</button>
```

正确：

```tsx
<button className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm text-primary-foreground">
  发送
</button>
```

---

## 可访问性

- 交互按钮必须有可访问名称。
- Dialog、Dropdown、Tabs、Tooltip 优先使用成熟组件模式，避免手写不可访问浮层。
- 授权、失败、高风险动作必须有清晰文本说明，不能只依赖颜色。
- 错误信息必须能被屏幕阅读器感知；表单错误应绑定到输入控件。
- 移动端触控目标不小于 40px。

---

## 核心组件清单

P0 UI 任务优先围绕以下组件复用或抽取：

| 组件 | 所属端 | 绑定需求 |
| --- | --- | --- |
| `WorkspaceShell` | Web/Mobile | `FR-WEB-001`, `FR-MOB-001`, `FR-UI-001` |
| `ChatPanel` | Web/Mobile | `FR-CHAT-001`, `FR-UI-001` |
| `MessageComposer` | Web/Mobile | `FR-CHAT-001`, `FR-UI-001` |
| `OrchestratorPlanCard` | Web/Mobile | `FR-ORCH-001`, `FR-PERM-001` |
| `TaskResultCard` | Web/Mobile | `FR-RESULT-001`, `FR-ARTIFACT-001` |
| `AuthorizationCard` | Web/Mobile | `FR-PERM-001`, `FR-NOTIFY-001` |
| `DesktopPolicyPanel` | Desktop | `FR-PERM-001`, `FR-DESK-001` |
| `RuntimeStatusCard` | Web/Desktop | `FR-RUNTIME-001`, `FR-DESK-001` |
| `DesktopMainShell` | Desktop | `FR-DESK-001`, `FR-UI-001` |
| `ArtifactPanel` | Web/Mobile | `FR-ARTIFACT-001`, `FR-RESULT-001` |

---

## Scenario: 用户可见工作台闭环

### 1. Scope / Trigger

- Trigger: 修改 Web 工作台的消息流、权限卡、右侧工作台、Git/文件/产物面板、代码块引用、文件选区编辑、artifact 发布入口，或任何声称“用户一句话可交付产物”的前端验收。
- Applies to: `ChatPanel`, `MessageContent`, `MessageMarkdown`, `ArtifactPanel`, `OrchestratorPanel`, `ActionCard`, `session-store`, workspace file/Git/artifact API consumers, and Web/Mobile readback tests.
- This is a frontend acceptance contract. Backend/API/runtime tests are required but not sufficient; the user must see and operate the feature from the UI.

### 2. Signatures

- Message readback:
  - `GET /api/messages?session_id=<id>`
  - UI fields: `message_type`, `sender_type`, `role_agent_id`, `content`, `metadata.runtimeParts`.
  - `role_acknowledgement` and visible process/status messages must render in the chat transcript.
- Chat SSE:
  - `role_acknowledgement`, `runtime_status`, `runtime_output`, `approval_requested`, `diff_created`, `artifact_created`, terminal events.
  - UI must convert these into durable visible rows or runtime cards, not hidden control-only events when they describe user-facing work.
- Permission decision:
  - `POST /api/actions/:actionId/approve`
  - Request: `{ approved: boolean }`
  - Chat permission card states: `pending`, local `approving/rejecting`, durable `approved/rejected/running/completed/failed`.
- Session process timeline:
  - `GET /api/sessions/:sessionId/timeline`
  - Response: `{ sessionId, workspaceId, items: TimelineItem[] }`.
  - `TimelineItem.kind`: `message | plan | plan_node | attempt | mailbox | runtime | action | artifact | deployment`.
  - The right workbench must use this read model for the user-visible `过程` tab and deployment-only filtered `部署` tab.
- Git workbench:
  - `GET /api/workspaces/:id/git/status`
  - `GET /api/workspaces/:id/git/diff?path=<path>&staged=<bool>`
  - `POST /api/workspaces/:id/git/stage|unstage|discard`
  - `POST /api/workspaces/:id/git/commit` with `{ message: string }`, committing only staged changes and returning fresh status/history.
  - UI must first show file names/status, then reveal diff only after the user selects a file.
- File/code reference:
  - code block action emits `agenthub:quote-to-composer`.
  - file preview selection emits `agenthub:quote-to-composer` with `{ author, preview, text, suggestedPrompt }`.
  - file preview `preview` must include workspace-relative path, line range, and character count; `text` must include the selected source snippet; `suggestedPrompt` should prefill a sendable edit request.
  - UI must expose an obvious select/capture/quote path; backend patch capability alone does not count, and the file panel must not become a direct inline patch editor for user-written changes.
- Publishable artifact:
  - `POST /api/artifacts/:id/publish` with `{ action: "start" | "stop" }`.
  - Start response returns `{ status: "running", url, pid, port, artifact? }`; stop response returns `{ status: "stopped", pid }`.
  - artifact metadata may include `publishStatus`, `publishUrl`, `publishPid`, `publishPort`, `startScriptPath`, `launchSourcePath`.
  - UI must offer user-facing `启动发布` / `停止发布` buttons and a clickable `打开发布链接`; command copying must not be the primary or only path for runnable web artifacts.
  - Artifact cards must use `引用产物` to send artifact title/type/source/preview summary into IM for AI iteration. Do not add a second free-form "AI edit" textarea inside the artifact card.

### 3. Contracts

- Chat transcript:
  - Mention role button must remain visibly clickable in idle and hover states. Do not render it as low-contrast transparent ghost text/icon against the composer background.
  - Role colors are deterministic across the IM transcript and the right `角色` workbench. New roles use the shared role-color helper automatically; custom color control is optional future scope.
  - Do not filter out role acknowledgements, planning/process messages, or final validation summaries when they are part of the user's workflow.
  - The transcript must show more than the initial prompt plus permission cards for multi-agent delivery runs.
  - Orchestrator allocation must appear in the IM transcript before the user is expected to inspect the right workbench. The allocation must explain which roles will handle frontend, backend/storage, validation, and artifact recommendation.
  - Assigned roles must produce visible IM replies tied to their `role_agent_id`. A `plan_node`, `mailbox`, or `runtime_session` row that only appears in the right panel does not count as a role conversation.
  - Handoff/reply semantics must be visible or auditable from message metadata. Downstream role replies must include a quote/reference to upstream context or durable `handoffsReceived`/`roleHandoffs` metadata.
  - Orchestrator must return to the transcript after role completion and either redispatch, fail visibly, or approve the result. A final deployment/result card without this validation message is incomplete.
  - Artifact recommendation and confirmation must be represented as an IM-visible final step before deploy/publish. Full-auto mode may auto-confirm only when the original user prompt asked for full-auto delivery, but the recommendation remains visible and durable.
  - Do not expose private chain-of-thought; show audited process states and role messages.
- Permission card:
  - The primary status text is approval state, not tool execution state.
  - Pending buttons are `允许本次操作` and `拒绝`.
  - After approval, replace buttons with `已允许` or `已审批`; after durable execution, `已执行` may be shown as the action result.
  - Tool execution progress belongs in a tool/action/process card, not as the permission decision label.
- Right workbench:
  - Desktop right workbench width must be draggable through a visible resize handle, constrained to a stable min/max width, and persisted across reload. Mobile uses drawer behavior instead of column resizing.
  - The desktop resize target must be the visible divider between the central chat column and `artifact-overlay`, with a discoverable hit area and hover/focus affordance. Do not hide it as a transparent absolute child inside the right panel.
  - `过程` shows the same-session durable timeline: role acknowledgement/messages, plans, nodes, attempts, mailbox handoffs, runtime sessions, actions, artifacts and deployments.
  - `编排` shows plan nodes and authorization/action cards.
  - `Git` shows only Git status, staged/unstaged groups, selected-file diff, stage/unstage/discard, and commit history.
  - `文件` shows file tree, preview, selection capture, code/reference actions, and IM quote-to-edit actions.
  - `产物` shows durable artifacts and publish/download/edit actions.
  - `部署` shows deployment action, manifest path, preview path and deployment artifact references, filtered from the same session timeline.
  - Do not mix permission approvals, runtime records, and Git file changes in one generic `变更` tab.
- Git progressive disclosure:
  - First level: VSCode-like file tree with staged/unstaged grouping, folder rows, file path and status badge.
  - Git tree ordering must match the file tree: directories before files, then same-level items sorted by name.
  - Git tree defaults to 0 expanded directories: show only root-level rows until the user expands folders.
  - The unstaged group header exposes a root-level `+` quick action that stages all unstaged workspace-root changes, equivalent to `git add .` inside the selected workspace root.
  - The staged group header exposes a root-level `-` quick action that unstages all staged workspace-root changes. This must work before the first commit by falling back from `git restore --staged` to `git rm --cached` when HEAD does not exist.
  - Unstaged file and folder rows expose a right-side `+` quick action; staged file and folder rows expose a right-side `-` quick action. Clicking the row opens/expands; clicking `+/-` must not also open diff.
  - Git UI must support commit of staged changes through a visible commit message input and submit button.
  - Second level after click: diff preview and file-specific actions.
  - Large diffs must scroll inside their own container.
- File tree and wide workbench:
  - `文件` must expose `workspace-file-tree`, `workspace-file-viewer`, and `workspace-new-file-button` so users can browse, create and inspect files without hidden backend-only APIs.
  - File trees default to 0 expanded directories. Selecting or creating a deep file must still automatically expand its ancestor directories so the active file is visible.
  - File viewer should be a single content surface. For editable text/code, selecting text should reveal an inline `引用内容` affordance that quotes file path, line range, character count, and original snippet into IM. Do not add a separate mini-IDE form for user-written patch text in the viewer.
  - Opening a file or Git diff should request a wide right workbench; the wide surface uses a left tree and right viewer/diff layout instead of squeezing content into a narrow single column.
  - Wide mode must be reversible and must not hide or block the central chat composer.
- Artifact publish:
  - A runnable artifact must not depend on only the current preview iframe.
  - The artifact card must let the user click `启动发布` to start the service and receive a link, then click `停止发布` to stop that service.
  - `发布访问` belongs at the top of the artifact card. It is a local temporary access link for previewing the current artifact.
  - `部署` is the formal deployment flow: deployment tab, approval, manifest path, preview path, and deployment artifact records. Artifact publish must explain that formal deployment lives in the `部署` tab.
  - Artifact iteration belongs in the main IM transcript. The artifact card may expose `引用产物`, but must not include a separate free-form AI instruction box such as `二次交互编辑`, `二次交互迭代`, or `记录迭代说明`.
  - The UI should hide raw commands from the main path. A generated workspace script may exist internally or in metadata, but the user-facing completion path is link-based.
  - Leaving the AgentHub page may stop a preview process; the artifact metadata should still record the last publish status/link/script evidence for readback.

### 4. Validation & Error Matrix

| Condition | Required UI result | Forbidden result |
| --- | --- | --- |
| User sends the fixed calculator prompt | transcript shows Orchestrator allocation and role assignment | only right-panel plan/timeline updates |
| Assigned role starts | transcript shows a role message with role badge/context | role activity is hidden in plan/runtime rows only |
| Role hands off to another role | downstream reply references upstream context or message metadata stores handoff | role outputs appear as unrelated generic messages |
| Orchestrator validates | transcript shows accept/redispatch/fail decision | deployment/result card appears without validation |
| Artifact is recommended | transcript shows concrete artifact recommendation/confirmation | all files are marked as products by default |
| SSE contains role acknowledgement | visible chat message with role badge/context | silently ignore it as control-only |
| Permission pending | shows risk/details plus `允许本次操作` and `拒绝` | generic text with no actionable buttons |
| Permission approved | buttons replaced by `已允许`/`已审批` badge | badge says `执行中` as approval status |
| Tool still running after approval | separate tool/process card shows running/waiting | permission card alone claims execution status |
| User opens Process tab | sees same-session timeline from real DB/API | only deployment approval/result cards are visible |
| User opens Deploy tab | sees deploy action + manifest/artifact refs for same session | lists every artifact or every file as deployment result |
| User opens Git tab | sees staged/unstaged file list first | starts with mixed approval/runtime/Git records |
| User clicks a Git file | selected diff appears for that file | all diffs expanded by default |
| User creates a deep file | parent folders expand and the file is selected/open | file is created but remains hidden in collapsed tree |
| File selection backend exists | UI exposes selection/capture and quotes path + line range + char count + snippet into IM | backend supports patching but user cannot find it |
| Runnable artifact exists | artifact card exposes `启动发布` / `停止发布` and clickable publish link | only a transient iframe preview or raw command copy exists |
| Desktop user drags right panel edge | panel width changes, middle chat remains usable, reload keeps width | fixed-width right sidebar with no handle |
| Frontend path missing | task remains partial/failed | backend tests mark feature complete |

### 5. Good/Base/Bad Cases

- Good: A strict calculator delivery session shows architect acknowledgement, backend/frontend role process messages, permission decisions as `已允许`, a separate `Git` tab with file list then diff, a `文件` tab with visible selection quote-to-edit, and a `产物` card with start/stop publish controls plus a link.
- Good: The same session transcript shows `用户请求 -> 架构师分工 -> 后端工程师回复 -> 前端工程师回复 -> 架构师验收 -> 产物推荐确认`; the right `过程` tab shows matching durable state, not a replacement transcript.
- Base: Git API works but no file changes exist; the `Git` tab shows a clean empty state and no approval cards.
- Base: Artifact is a static document; the card shows download/edit but no launch script.
- Bad: The chat transcript only shows the user prompt, several permission cards, and a final `已发布`.
- Bad: The right `过程` tab has many records, but the central IM transcript has no role assignment, no frontend/backend role messages, and no Orchestrator acceptance decision.
- Bad: The right panel has one `变更` tab containing Orchestrator cards, permission approvals, Git diff, runtime logs, and message metadata together.
- Bad: Code selection/patch APIs pass tests, but the UI has no visible control for selecting or referencing code.
- Bad: Runnable artifact UI asks the user to copy a command as the main publish path instead of clicking start and opening a generated link.

### 6. Tests Required

- Unit/component tests:
  - `/api/chat` or a source-level contract test must prove Orchestrator allocation, role runtime replies, handoff metadata, validation, and artifact recommendation are inserted into IM-visible `messages`.
  - `session-store` keeps historical and streamed `role_acknowledgement` rows as visible messages.
  - permission card maps approved/running/completed to approval/result wording without using `执行中` as the approval label.
  - code block quote button emits `agenthub:quote-to-composer` and composer displays the quote.
  - file selection quote emits path, line range, character count, selected text, and suggested prompt into the composer; no direct apply/diff editor is required in the file panel.
  - artifact quote button emits artifact title, type, source file/id, preview state, optional publish link and content summary into the composer; no artifact-card AI instruction textarea is allowed.
  - `WorkspaceShell` right panel resize contract includes `artifact-resize-handle`, pointer drag handling, min/max width, and `agenthub:right-panel-width` persistence.
  - `ArtifactPanel` exposes `artifact-publish-panel`, `artifact-publish-start`, `artifact-publish-stop`, and `artifact-publish-link`, and does not expose `artifact-start-command` as the primary path.
- Web E2E:
  - send the fixed calculator prompt once and assert the central transcript shows Orchestrator allocation, assigned role replies, Orchestrator validation, and artifact recommendation/confirmation before counting the run as passed.
  - send or seed a session with role acknowledgements/process messages and assert the transcript shows them after reload.
  - open `过程` and assert same-session message/plan/node/runtime/action/artifact timeline items are visible.
  - drag the right panel resize handle, assert width changes within bounds, middle chat/composer remains usable, then reload and assert width persists.
  - open `部署` and assert only deploy action/manifest/artifact refs are visible.
  - open `编排` and assert plan/action cards are present without Git diff content.
  - open `Git` and assert file names are visible before diff; click one file and assert diff appears.
  - create a nested file from the `文件` tab and assert the tree expands to the new file, the viewer opens it, and wide mode is active.
  - open `文件`, select code, quote it to the composer, and assert the quote includes file path, line range, character count, and original snippet.
  - open `产物`, click `启动发布`, assert a link appears and is reachable, then click `停止发布` and assert the service stops.
- Backend/API integration:
  - keep workspace file/Git/artifact APIs workspace-root bound.
  - artifact publish metadata and internal launch script paths must be workspace-relative and reject paths outside the selected workspace root.

### 7. Wrong vs Correct

#### Wrong

```text
右栏「变更」
- 编排计划
- 授权卡
- Git diff
- 运行消息 metadata
```

#### Correct

```text
右栏「编排」: plan nodes + action approvals
右栏「Git」: file list -> selected diff -> stage/unstage/discard
右栏「文件」: tree -> preview -> selection quote to IM
右栏「产物」: artifact preview/edit/download/start publish/stop publish/open link
```

---

## 常见错误

### 错误：本地 Runtime 组件里放 API Key 表单

修正：本地 Claude Code / Codex 只展示检测和本机登录引导。平台托管模型 Provider 凭证属于未来独立能力，不能混入本地 CLI 绑定 UI。

### 错误：页面能跑但没有视觉契约

修正：UI 任务必须引用 `FR-UI-001`，并提前写 Playwright 截图、布局和文本溢出断言。

### 错误：复制参考项目但带入错误产品模型

修正：AionUi/codeg/lobehub/cherry-studio 只作为布局、密度和组件行为参考。AgentHub 的执行域、Runtime 凭证边界和三端职责以 PRD 为准。
