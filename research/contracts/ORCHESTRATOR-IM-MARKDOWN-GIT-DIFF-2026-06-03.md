# ORCHESTRATOR-IM-MARKDOWN-GIT-DIFF-2026-06-03: Orchestrator IM、Markdown、权限确认与 Git 变更面板共享合同

> 本合同是 Trellis 与 Maestro/Ralph 的共享事实接口。实现、测试、验收和执行报告都必须引用本文件。

---

## 1. 元信息

| 字段 | 内容 |
| --- | --- |
| TASK-ID | `ORCHESTRATOR-IM-MARKDOWN-GIT-DIFF-2026-06-03` |
| 优先级 | `P0` |
| 绑定 FR-ID | `FR-CHAT-001`, `FR-ORCH-001`, `FR-AGENT-001`, `FR-RUNTIME-001`, `FR-PERM-001`, `FR-ACTION-001`, `FR-ARTIFACT-001`, `FR-RESULT-001`, `FR-WEB-001`, `FR-MOB-001`, `FR-UI-001` |
| 来源 | `research/prd.md`, `research/modules/im-foundation.md`, `research/modules/orchestrator.md`, `research/modules/orchestrator-plan-dag.md`, `research/modules/action-cli-adapter.md`, `research/modules/reference-projects.md`, `research/modules/ui-and-visual-testing.md`, `research/contracts/COMPLETE-MULTI-AGENT-ORCHESTRATION-2026-06-02.md`, `.trellis/spec/cross-layer/real-flow-acceptance.md`, `.trellis/spec/frontend/component-guidelines.md` |
| 负责人角色 | Codex 控制流程；Trellis 管实现规范；Maestro/Ralph 管大范围执行 |
| 状态 | `active` |

---

## 2. 背景与目标

用户在真实 IM 工作台里向多个自定义 Role Agent 发起任务时，产品必须表现得像一个可被审计的公司协作群，而不是一段自由 Markdown 日志：

1. 主控角色命名为 `Orchestrator`，不再使用“架构师”作为系统概念。
2. Role Agent 是用户可定义角色；前端工程师、后端工程师、测试、PM 只是模板或示例，不得硬编码为唯一角色集合。
3. 多个角色被 `@` 时，每个被提及角色都应在 IM 流里给出简短、任务相关的确认，例如“收到，我会先检查现有页面组件和消息渲染入口。”，而不是固定回复“收到”两个字。
4. P0 默认在同一 workspace/session 中串行推进角色工作。允许只读查看并发发生，但同一时间只能有一个角色进入会修改共享文件系统、调用 runtime 或推进 plan node 的 active 状态。
5. Markdown 消息必须正确渲染换行、列表、表格、代码块、链接和复制按钮；直接复用并改造 AionUi Markdown 组件拆分。
6. 权限请求必须是结构化交互卡片，而不是在 Markdown 中用自然语言要求用户“批准一下”。
7. Changes/Get Diff 不只是显示 diff 文本，还必须提供真实 Git 变更面板：状态分组、staged/unstaged、per-file diff、stage、unstage、discard/revert、撤销本次暂存等操作，并按权限策略控制破坏性动作。

目标是让真实用户能解释：Orchestrator 如何拆解、哪些自定义角色收到了任务、为什么当前只能一个角色执行、权限为什么需要确认、文件改动是什么、哪些改动已暂存或可撤销。

---

## 3. 用户链路合同

### 3.1 多角色 IM 协作

1. 用户进入 Web Workspace 的真实 Session。
2. 用户在 Composer 中输入任务，例如：`@前端工程师 @后端工程师 修复消息 Markdown 渲染并补 Git 变更面板`。
3. 系统从真实 `GET /api/role-agents` 或等价服务解析被提及的 Role Agent，进入 Orchestrated Flow。
4. IM 流出现用户消息，并紧跟每个被提及角色的短确认消息。确认消息必须包含该角色名、任务理解或第一步动作，不得固定成纯“收到”。
5. Orchestrator 创建或更新结构化 plan，并把 role work item 放入串行队列。
6. 队列中第一个角色获得 active lease；其他角色显示 queued/waiting 状态。
7. 当前 active 角色完成或进入 blocked/needs_approval 后，Orchestrator 再调度下一个角色。
8. 刷新页面后，用户消息、角色确认、plan 状态、active/queued 状态仍可从真实 DB/API 恢复。

完成条件：用户从真实入口可看到完整 IM 交互；每个被 `@` 的自定义角色有任务相关确认；任意时刻同一 workspace/session 只有一个执行型 active lease。

### 3.2 Markdown 渲染

1. 用户或 Agent 发送包含多段落、列表、表格、链接和代码块的消息。
2. 消息气泡使用统一 Markdown renderer，而不是普通 `<div>{content}</div>`。
3. 代码块展示语言标签、复制按钮和横向滚动；宽表格在消息气泡内横向滚动，不撑破布局。
4. 换行、空行、列表嵌套、引用和 inline code 在 Web/Mobile 可读。
5. Playwright 或组件测试覆盖包含表格、代码块、长行和链接的消息。

完成条件：刷新后同一消息仍按 Markdown 渲染，移动和桌面视口没有文本重叠或横向页面滚动。

### 3.3 结构化权限确认

1. 当 Orchestrator plan、权限升级、shell 命令、文件写入、discard/revert 或其他超出当前权限策略的动作需要确认时，系统产生结构化 approval/action record。
2. IM 流或右栏展示 `AuthorizationCard`/`ActionCard`，包含动作类型、请求方、workspace/session、影响范围、风险等级、可选项。
3. 用户可以选择允许单次执行、拒绝；如策略允许，可选择本 session/workspace 的自动执行范围。
4. 用户选择后通过真实 API 更新 approval/action 状态，不能只改前端本地状态。
5. 危险动作，例如 discard/revert、删除文件、强制 reset，不得因“自动执行”默认通过；必须遵守权限总控。

完成条件：权限询问不再以 Markdown 普通文本出现；所有审批状态刷新后可读回。

### 3.4 Git Changes/Get Diff

1. 用户打开 Workspace 右栏的“变更”或任务结果卡片里的 diff 入口。
2. 前端调用真实 Git status/diff API 或 Desktop Connector bridge，按 workspace root 获取变更。
3. UI 分组展示 staged、unstaged、untracked、conflicted 文件，并标识新增/修改/删除/重命名。
4. 用户点击文件查看 per-file diff；二进制或过大文件展示明确不可预览状态。
5. 用户可对单文件执行 stage、unstage、discard/revert；可对当前暂存执行撤销暂存；批量操作必须有清晰影响范围。
6. 破坏性 discard/revert 触发结构化权限确认；用户批准后才执行真实 Git 操作。
7. 操作完成后重新读取 status/diff，UI 与 Git 状态一致。

完成条件：`git status --porcelain` 与 UI 分组一致；stage/unstage/discard/revert 后刷新仍一致；错误态中文可见。

---

## 4. 三端职责边界

| 端 | 职责 | 不做什么 |
| --- | --- | --- |
| Web | 主工作台；IM 消息、Orchestrator plan、角色确认、权限卡、Changes 面板、Markdown 渲染、Git diff 审阅和操作入口 | 不直接绕过后端/Connector 写本地文件；不把 Diff 本身当审批对象；不把 runtime 名称当聊天对象 |
| Desktop | 本地 workspace root、Git 命令、本地文件系统和 runtime 执行能力承载；按权限策略执行 stage/unstage/discard 等本地动作 | 不做审批中心；不替 Web 伪造聊天成功；不保存本地 Claude/Codex API Key |
| Mobile/PWA | 轻量 IM、审批/拒绝、任务状态和产物预览；可查看精简 diff 摘要 | 不提供复杂代码编辑或大屏 Diff 合并；不执行本地 Git 写操作 |

---

## 5. 数据与后端合同

### 5.1 Role acknowledgement

确认消息必须是持久化消息或等价 durable event，最小字段：

```typescript
type RoleAcknowledgementMessage = {
  id: string
  workspaceId: string
  sessionId: string
  roleAgentId: string
  roleName: string
  sourceUserMessageId: string
  messageType: 'role_acknowledgement'
  content: string
  createdAt: string
  metadata: {
    mentionedRoleIds: string[]
    acknowledgementKind: 'task_understood'
    plannedFirstStep?: string
  }
}
```

规则：

- `content` 由角色配置、用户任务和当前 flow 生成，可使用模板，但必须带任务语义。
- 不允许只创建隐藏状态，不落 IM 可见消息。
- 不允许把 `roleName` 写死为前端工程师/后端工程师；角色来自 workspace role agents。

### 5.2 Serial execution lease

P0 串行控制必须有后端真相源，不能只靠前端按钮 disabled。推荐字段或等价模型：

```typescript
type RoleExecutionLease = {
  id: string
  workspaceId: string
  sessionId: string
  planId?: string
  planNodeId?: string
  roleAgentId: string
  state: 'queued' | 'active_reading' | 'active_executing' | 'active_waiting_approval' | 'blocked' | 'completed' | 'cancelled'
  leaseOwner: 'orchestrator'
  startedAt?: string
  expiresAt?: string
  completedAt?: string
}
```

硬规则：

- 同一 `(workspaceId, sessionId)` 内最多一条 `state in ('active_reading','active_executing','active_waiting_approval')`。
- 只读 context gathering 可以作为 `active_reading` 排队执行；不能多个角色同时读取并推进同一个 plan 状态。
- 如果未来开启并行，必须先引入 lane/worktree 隔离；本合同 P0 明确不做并行写同一文件系统。
- lease 过期或 worker 崩溃必须可恢复为 blocked/queued，不能永久卡死。

### 5.3 Permission/approval

结构化权限记录最小字段：

```typescript
type ApprovalRequest = {
  id: string
  workspaceId: string
  sessionId: string
  requesterRoleAgentId?: string
  planNodeId?: string
  actionId?: string
  kind: 'plan_confirm' | 'permission_escalation' | 'command_execute' | 'git_discard' | 'git_revert' | 'retry' | 'deploy'
  riskLevel: 'low' | 'medium' | 'high' | 'destructive'
  status: 'pending' | 'approved_once' | 'approved_policy' | 'rejected' | 'expired'
  title: string
  description: string
  impact: string[]
  allowedScopes: Array<'once' | 'session' | 'workspace'>
  createdAt: string
  decidedAt?: string
}
```

规则：

- Diff 展示不是审批对象；审批对象是 plan、action、权限升级或破坏性 Git 操作。
- `approved_policy` 只能在权限总控允许自动化时出现。
- destructive 操作默认至少需要 `approved_once`。

### 5.4 Git status/diff/actions

Git 服务最小接口：

```typescript
type GitFileStatus = {
  path: string
  oldPath?: string
  indexStatus: 'unmodified' | 'added' | 'modified' | 'deleted' | 'renamed' | 'copied' | 'untracked' | 'conflicted'
  workingTreeStatus: 'unmodified' | 'added' | 'modified' | 'deleted' | 'renamed' | 'copied' | 'untracked' | 'conflicted'
  staged: boolean
  unstaged: boolean
  binary?: boolean
}

type GitDiffRequest = {
  workspaceId: string
  path?: string
  staged?: boolean
}

type GitActionRequest = {
  workspaceId: string
  action: 'stage' | 'unstage' | 'discard' | 'revert'
  path?: string
  approvalId?: string
}
```

最小 API 或 bridge：

| 能力 | 接口 | 说明 |
| --- | --- | --- |
| status | `GET /api/workspaces/:workspaceId/git/status` 或 Desktop bridge 等价接口 | 返回分组前的完整 file list，由前端分组 |
| diff | `GET /api/workspaces/:workspaceId/git/diff?path=&staged=` | 返回 unified diff 或 binary/too_large 状态 |
| stage | `POST /api/workspaces/:workspaceId/git/stage` | 支持单文件；批量需明确 paths |
| unstage | `POST /api/workspaces/:workspaceId/git/unstage` | 撤销暂存 |
| discard/revert | `POST /api/workspaces/:workspaceId/git/discard` 或 `revert` | 破坏性，必须校验 approval |

安全规则：

- path 必须归一化并限制在 workspace root 内，拒绝 `..`、绝对路径越界、危险 symlink。
- Git 命令参数必须用 argv 数组或成熟库传参，禁止拼接 shell 字符串。
- binary/too_large diff 不得尝试全文渲染。
- 所有写操作必须记录 action/approval 审计事件。

产品运行时是否允许 mock 主链路数据：**否**。

---

## 6. UI/UX 合同

### 6.1 信息架构

- 中栏：IM 消息流，包含用户消息、角色确认、Orchestrator plan、权限卡、任务结果卡。
- 右栏：角色、文件、变更、产物。变更 Tab 是 Git Changes 主入口。
- Mobile/PWA：保留 IM、审批和简化变更摘要；大 diff 可跳转 Web。

### 6.2 核心组件

| 组件 | 责任 | 必须状态 |
| --- | --- | --- |
| `MessageMarkdown` | 统一渲染聊天 Markdown | normal, code-copy, table-scroll, link-safe, error fallback |
| `RoleAcknowledgementBubble` | 展示被 @ 角色的短确认 | queued, active, blocked |
| `OrchestratorPlanCard` | 展示结构化 plan 和节点状态 | draft, pending_confirm, queued, running, blocked, completed, failed |
| `AuthorizationCard` | 权限确认交互 | pending, approving, approved, rejected, expired, error |
| `ChangesPanel` | Git status/diff/actions | loading, empty, dirty, action-pending, approval-required, error |
| `GitDiffViewer` | 展示 unified diff | text, binary, too_large, no_diff |

### 6.3 文案要求

- 主控角色使用 `Orchestrator`。
- 用户自定义角色按真实名称展示，不把 runtime 名称当角色名称。
- 被 @ 角色确认示例：
  - `前端工程师：收到，我会先检查消息组件和 Markdown 渲染入口。`
  - `后端工程师：收到，我会核对 API 状态机和 Git 操作权限边界。`
- 权限卡按钮示例：`允许单次执行`、`拒绝`、`允许本会话自动执行`。
- Git destructive 操作必须出现明确影响：`将丢弃工作区中文件 X 的未暂存改动，此操作不可由 AgentHub 自动恢复。`

### 6.4 布局要求

- 卡片圆角不超过 8px。
- 工具按钮使用 lucide 图标并提供中文 `aria-label` 或 tooltip。
- 代码块和 diff 区域固定容器宽度，内部横向滚动，不能撑破消息列或右栏。
- 不允许页面出现横向滚动、文本溢出按钮、卡片嵌套卡片。

---

## 7. 参考项目输入

| 参考项目 | 读取范围 | 提炼内容 | 不采用内容 |
| --- | --- | --- | --- |
| `refer_proj/AionUi` | `packages/desktop/src/renderer/components/Markdown/index.tsx`, `CodeBlock.tsx`, `markdownUtils.ts`, `pages/conversation/Messages/components/MessageText.tsx` | Markdown renderer 拆分、代码块复制、换行/表格/代码块处理、消息渲染接入点 | 不带入 AionUi store、Electron 假设、英文文案或样式 token |
| `refer_proj/clawwork-ai__ClawWork` | `docs/openclaw-desktop-design.md` 中 serial/lane queue 设计 | P0 默认串行、显式并行需要 lane/worktree 隔离 | 不在本任务引入复杂并行 lane 实现 |
| `refer_proj/SeemSeam__claude_codex_bridge` | `lib/mailbox_kernel/service_runtime/transitions_runtime/claiming.py`, `leasing.py` | claim/lease 状态推进和过期恢复思想 | 不引入 Python runtime 或该项目目录结构 |
| `refer_proj/zhukunpenglinyutong__desktop-cc-gui` | `src/services/tauri.ts`, `src-tauri/src/git/commands.rs`, `src-tauri/src/shared/git_core.rs` | Git status/diff/stage/unstage/revert 命令边界、前端调用模型 | 不引入 Tauri/Rust 栈作为 AgentHub 主路线 |
| `refer_proj/siteboon__claudecodeui` | `server/routes/git.js`, `src/components/git-panel/` | Web Git panel 信息结构、diff viewer 和 stage/discard 操作 | 不采用 mock server 或不安全路径处理 |
| `refer_proj/j3n5en__EnsoAI` | `src/main/services/git/GitService.ts` | path traversal、symlink、binary、staged/unstaged diff 防护 | 不带入 Electron main 服务结构 |

复用授权原则：用户已明确允许直接复用或改造 `refer_proj` 代码；实现时仍必须改成 AgentHub 类型、中文文案、Tailwind/shadcn/lucide 样式和真实 API/DB/session 合同。

---

## 8. Trellis 派生要求

- `.trellis/tasks/<task>/prd.md`：必须引用本合同，并拆成 Markdown、Role Ack/Serial Lease、Approval UI/API、Git Changes 四条实施线。
- `implement.jsonl`：每个 slice 必须包含 `read_first`、`reference_sources`、预期文件、行为级 DoD、测试命令。
- `check.jsonl`：必须包含真实 API/DB/session、刷新持久化、布局断言、Git 操作副作用、权限拒绝路径。
- 需要更新的 `.trellis/spec/*`：当前已更新 `frontend/component-guidelines.md` 和 `cross-layer/real-flow-acceptance.md`；实现中发现新规则继续用 `trellis-update-spec` 追加。

---

## 9. Maestro/Ralph 派生要求

- 推荐命令：先 analyze/plan，再按 slice execute；不允许一个大 wave 一次性改完所有层。
- analyze 必须先读本合同、PRD、相关 modules、spec 和参考项目路径。
- plan anti-pattern review：执行前必须按 `.trellis/spec/guides/end-to-end-contract-planning.md` 自查并修订。
- execute 顺序必须串行：
  1. Markdown renderer 接入与测试。
  2. Role acknowledgement 持久化与 IM 展示。
  3. Serial role lease/queue 状态机与调度约束。
  4. Structured approval/action card 与 API 状态。
  5. Git Changes status/diff/actions 与权限联动。
  6. E2E/visual/acceptance 收口。
- 每个 execute slice 完成后更新阶段报告；不得只写 `.workflow/.maestro/*/status.json`。
- execution report 路径建议：`research/execution-reports/orchestrator-im-markdown-git-diff-2026-06-03-report.md`。

---

## 10. 实施切片计划

### Slice 0: 现状审计与依赖确认

读取：

- `apps/web` 的 workspace/chat/message/composer/artifact panel/API route。
- `apps/desktop` 的 local workspace、Git bridge、runtime IPC。
- `packages/shared` 的 message、plan、action、role agent 类型。
- 当前 package 依赖，确认 Markdown/Git diff 依赖是否已有。

输出：

- 列出现有可复用组件和要改的文件。
- 若缺依赖，先说明风险并通过结构化权限/命令审批安装；不得悄悄改 `package.json`。

DoD：

- 找到消息渲染入口、role mention 解析入口、plan/action API、右栏 Changes 入口、Desktop bridge 或后端 Git 服务入口。

### Slice 1: Markdown renderer

实现：

- 新增或替换 `MessageMarkdown`/`MarkdownRenderer`。
- 复用改造 AionUi `Markdown/index.tsx`, `CodeBlock.tsx`, `markdownUtils.ts` 的拆分。
- 接入当前消息气泡，覆盖 agent/user/system 需要 Markdown 的位置。

测试：

- 组件测试：标题、列表、表格、代码块复制按钮、链接、长行。
- E2E 或 visual：桌面和移动宽度无横向页面滚动。

禁止：

- 用 `white-space: pre-wrap` 冒充 Markdown。

### Slice 2: Role acknowledgement

实现：

- mention 解析使用真实 role agent list。
- 多角色提及时，为每个角色创建 durable `role_acknowledgement` 消息。
- ack 文案基于角色名称、能力或第一步动作生成。
- IM 渲染 ack bubble，并标识 queued/active 状态。

测试：

- API/integration：自定义角色 `设计师`、`后端工程师` 被 @ 后各生成一条 ack。
- 持久化：刷新/重新 GET messages 后 ack 仍存在。
- 负向：未知角色返回 400 或明确错误，不降级成默认角色。

禁止：

- 只回复“收到”两个字。
- 写死前端/后端角色。

### Slice 3: Serial role lease/queue

实现：

- 增加或复用 plan node/mailbox 状态，建立每 session 单 active lease。
- Orchestrator 只调度一个 active role work item。
- active 完成、失败、等待审批或取消后，状态机推进下一个 queued item。
- UI 展示 active/queued/blocked。

测试：

- 并发触发两个角色 work item 时，DB/API 只允许一个 active。
- 第二个角色等待第一个 completed 后才变 active。
- lease 过期或失败进入 blocked/queued，不卡死。

禁止：

- 只用前端状态防并发。
- 在同一 workspace root 中并发执行两个会写文件的 role runtime。

### Slice 4: Structured approval/action cards

实现：

- 将权限询问从 Markdown 文本升级为 approval/action record + UI card。
- 支持 `允许单次执行`、`拒绝`；在策略允许时显示 session/workspace 自动执行选项。
- high/destructive 操作强制审批。
- 审批结果通过真实 API 更新，刷新可读。

测试：

- pending approval 渲染卡片。
- approve once 后 action 可继续。
- reject 后 action blocked。
- policy 不允许时不显示 broader auto-execution。

禁止：

- 在普通 assistant 文本里要求用户批准命令。

### Slice 5: Git Changes/Get Diff/actions

实现：

- Git status/diff 服务或 Desktop bridge。
- ChangesPanel 分组展示 staged/unstaged/untracked/conflicted。
- GitDiffViewer 展示 text/binary/too_large/no_diff。
- stage/unstage/discard/revert 操作。
- destructive 操作接 approval。

测试：

- 使用临时 Git repo fixture 创建 modified/staged/untracked/conflicted 可覆盖状态。
- status 与 `git status --porcelain` 等价。
- stage/unstage 后状态变化正确。
- discard/revert 需要 approval；拒绝不改文件，批准后真实改变。
- path traversal、绝对路径越界、binary diff 明确失败或不可预览。

禁止：

- 用 hardcoded diff 文本作为产品成功证据。
- shell 字符串拼接 Git 命令。
- 无审批 discard 用户改动。

### Slice 6: Acceptance and governance

验证命令至少包含：

- `pnpm --filter @agenthub/web type-check`
- `pnpm --filter @agenthub/desktop type-check`（若改 Desktop）
- 相关 Vitest/API 测试
- 相关 Playwright acceptance/E2E
- `bash scripts/verify-governance-gate.sh ORCHESTRATOR-IM-MARKDOWN-GIT-DIFF-2026-06-03`

输出：

- 更新 `research/project-tracker.md`。
- 更新 execution report。
- 如发现 regression，登记 `research/regression-ledger.md`。

---

## 11. 测试与验收合同

自动化测试必须覆盖：

- type-check：Web、shared；改 Desktop 时包含 Desktop。
- API/integration：role ack、serial lease、approval status、Git status/diff/action。
- Web E2E：真实 workspace/session 中 @ 多个自定义角色，看到 ack、queued/active、Markdown 渲染、approval card、Changes panel。
- Desktop E2E 或 integration：本地 Git 操作经 Desktop/后端真实执行。
- Mobile/PWA E2E：能查看 ack/approval，至少审批/拒绝一条 pending approval。
- 视觉/布局断言：Markdown 表格、代码块、diff 不撑破桌面/移动容器。
- 数据库验证：messages、plan/lease、approval/action、Git audit 或等价事件可刷新读回。

人工验收路径：

1. 创建或选择真实 workspace/session，配置至少两个自定义 Role Agent。
2. 发送 `@角色A @角色B` 的任务。
3. 观察每个角色的短确认、Orchestrator plan 和串行 queued/active 状态。
4. 发送包含 Markdown 表格和代码块的 Agent 消息或通过 fixture 触发，确认渲染正确。
5. 触发需要权限的动作，确认出现结构化卡片并可“允许单次执行/拒绝”。
6. 修改一个 repo 文件，打开 Changes，查看 unstaged diff，执行 stage/unstage；尝试 discard 并确认需要审批。
7. 刷新页面，确认消息、审批状态和变更状态可恢复。

---

## 12. 计划阶段禁止项

任何 plan 出现以下情况必须 revise，不得 execute：

- 用 `playwright test --list`、文件存在、grep-only 作为主验收。
- 用 mock API、mock auth、内存数据或 hardcoded sample 证明真实 DB/API/session 主链路。
- 用 placeholder runtime response 冒充 Agent/Runtime 成功。
- 把角色硬编码为前端工程师/后端工程师，忽略用户自定义角色。
- 被 @ 角色只更新隐藏状态，不发 IM 可见确认消息。
- 用前端 disabled 代替后端 serial lease。
- 用 Markdown 文本询问权限，未落 approval/action record。
- 将 Git diff 当审批对象；审批必须绑定 action/plan/权限升级。
- 无审批执行 discard/revert 或其他破坏性 Git 操作。
- 为 P0 并行执行共享文件系统任务而不引入 lane/worktree 隔离。
- 只写“后续补真实实现 / TODO”覆盖 P0 主链路行为。
- 将 `status.json completed` 或 `DONE_WITH_CONCERNS` 当作产品完成。

计划必须先通过 `.trellis/spec/guides/end-to-end-contract-planning.md` 的 checklist。

---

## 13. 验真样本

| 样本 | 只给执行者的合同描述 | 不应预置的答案 | 通过标准 |
| --- | --- | --- | --- |
| Markdown 分行/渲染不正确 | 聊天消息必须渲染 Markdown 换行、列表、表格和代码块，刷新后仍正确 | 不直接说“当前是纯文本 div 或 CSS white-space 问题” | 执行者通过代码审计和测试自行指出当前渲染入口缺陷，并用 AionUi renderer 改造 |
| 多角色 IM 不像公司协作 | 多个被 @ 的自定义角色必须各自发短确认，并进入可见串行队列 | 不直接指定当前只让 Orchestrator 说话或角色只回“收到” | 执行者补 durable ack、UI 展示和 serial lease 测试 |
| 权限确认像普通聊天文本 | 需要用户授权时必须展示结构化交互卡片，支持允许单次执行/拒绝/策略范围 | 不直接指定当前某个组件只输出 Markdown | 执行者找到权限事件入口并接入 approval/action record |
| Get diff 不完整 | Changes 面板必须覆盖 status/diff/stage/unstage/discard/revert 和 staged/unstaged | 不直接指定当前只显示 diff 字符串 | 执行者实现真实 Git 状态和操作闭环，补安全测试 |

验真样本不是直接修复目标。若执行系统不能自行发现样本问题，先修测试合同和工作流门禁。

---

## 14. 完成门禁

完成前必须满足：

- [ ] `research/project-tracker.md` 已更新。
- [ ] 阶段级 execution report 已补齐；bug/regression/未完成项已归入 `research/regression-ledger.md`，不得制造碎片报告。
- [ ] 真实验证命令和结果已写入对应任务报告、tracker 或 ledger。
- [ ] 精确 commit，禁止 `git add .`。
- [ ] 最近 commit 不包含 `refer_proj/*`、缓存、临时日志、`.workflow/.maestro/*/status.json`。
- [ ] `bash scripts/verify-governance-gate.sh ORCHESTRATOR-IM-MARKDOWN-GIT-DIFF-2026-06-03` exit 0。
- [ ] Codex 按本合同完成独立验收。
- [ ] 验真样本已被执行系统自行发现，或已记录为流程门禁缺陷并补强合同/测试。

---

## 15. 残留风险与后续

- P0 明确采用串行执行；未来要并行必须先设计 lane/worktree 隔离和冲突处理合同。
- Mobile/PWA 不承载完整 diff 合并体验，只做轻量查看与审批。
- Git revert latest commit、复杂 merge conflict resolution、stash 管理可在 P1 扩展；P0 先完成 stage/unstage/discard/revert 的安全闭环。
- 若当前 DB schema 已有 plan/mailbox/action 表，应优先复用；不得因计划方便新建平行真相源。
