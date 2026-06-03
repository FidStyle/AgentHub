# Bytedance/PRD 反查实现审计规范

> 用于从 `bytedance_init_prd.md` 和派生 `research/prd.md` 反推代码实现，系统性发现三类问题：Bytedance 原始要求被派生 PRD 漏掉；PRD 要求已经进入 P0 但代码没有真实落实；PRD 或当前产品不再支持，但 UI、测试、文档、未挂载组件或静态数据仍保留，造成假完成或误导验收。

## 1. Scope / Trigger

触发本规范的场景：

- 用户要求“看还有什么没完成、假通过、TODO、未落实”。
- 某个功能已在 tracker/report 中标记完成，但用户发现真实入口不可用。
- 删除或质疑一个入口后，需要判断是否存在同类残留。
- 准备验收前，需要从 Bytedance 原始材料和派生 PRD，而不是从现有实现倒推完成度。

本规范不以 `.workflow/.maestro/*/status.json`、历史 execution report、测试通过数或组件存在为事实源。事实源优先级：

1. `bytedance_init_prd.md` 的原始要求。
2. `bytedance_init_video_txt.txt` 的解释性材料。
3. 用户最新明确决策。
4. `research/prd.md` 的派生 FR 验收标准。
5. 当前产品设计、技术设计和 PRD amendments。
6. 实际代码入口、API、DB schema、runtime 路由、E2E 断言。
7. 最近一次可复现测试证据。

## 2. Signatures

审计每个 FR 时必须形成统一条目：

```text
FR-ID:
Bytedance expected:
PRD expected:
Derived doc status:
Implementation evidence:
Runtime/data evidence:
User entry:
Tests:
Classification:
Decision:
```

`Classification` 只能取以下值：

- `implemented_verified`: 有真实入口、真实数据/API/runtime、可复现测试和刷新/重读证据。
- `implemented_unverified`: 代码看似实现，但缺少可复现主链路证据。
- `partial_shell`: 有 UI/API 壳，但没有核心业务执行或状态闭环。
- `missing_required`: P0 要求缺失。
- `source_doc_drift`: Bytedance 原始材料有明确要求，但 `research/prd.md`、产品设计或技术设计没有正确登记。
- `stale_or_ghost`: PRD 不支持或当前不应展示，但仍残留 UI、测试、文档、组件、静态 seed 或假数据。
- `out_of_scope`: 明确属于 P1/P2/P3，不能作为 P0 通过或失败依据。

## 3. Contracts

### PRD 必做但未落实

如果 Bytedance 原始材料或派生 PRD P0 写明用户可以完成某动作，代码必须同时满足：

- 有用户可到达入口，不是只存在 API 或未挂载组件。
- 有真实后端或本地 runtime 行为，不是只改 local state。
- 有权限/执行域校验，不能只信前端。
- 有持久化或可重读证据，刷新后状态不丢。
- 有失败/离线/无权限中文错误态。

任一缺失时，不能在 tracker/report 写“完成”，只能写 `partial_shell` 或 `implemented_unverified`。

### Bytedance 要求未进入派生文档

以下都视为 `source_doc_drift`：

- `bytedance_init_prd.md` 明确要求 IM 消息操作、Artifact 编辑、部署、多端职责等能力，但 `research/prd.md` 没有 FR-ID 或验收标准。
- 派生 PRD 把 Bytedance backlog 删除成“不需要”，而不是标为 P1/P2/P3。
- 技术设计把 OpenCode、部署、版本/局部修改、文档/PPT 或多端补全写成无产品债。
- tracker/report 用当前实现证明 Bytedance 原始要求“不在范围内”。

处理原则：

- 先修订 `research/prd.md`、产品设计和技术设计，再评估代码。
- P0 未实现可以标记为 backlog 或 deferred，但不能从产品事实中删除。
- 审计输出必须同时写出 Bytedance expected 和派生文档状态。

### PRD 不支持但还残留

以下都视为 `stale_or_ghost`：

- 未挂载组件、旧页面、旧测试仍包含可执行入口语义。
- 静态 seed 假装来自真实授权、通知、最近会话或执行记录。
- 文档仍要求一个已删除或不该存在的 P0 入口。
- E2E 仍断言已废弃 test id、旧文案或旧状态。
- UI 中展示 P1/P2 能力但没有 disabled、中文原因和真实边界。

处理原则：

- 能删就删：入口、页面、测试、文档一起删。
- 暂不能删就显式降级：加中文不可用原因、P1/P2 标签、不可点击状态，并登记到台账。
- 不能把静态样例、local activity、默认 seed 当作真实用户数据。

## 4. Validation & Error Matrix

| 审计发现 | 必须处理 | 禁止处理 |
| --- | --- | --- |
| Bytedance 要求未进派生 PRD | 登记 `source_doc_drift`，先修文档和 FR-ID | 直接按当前实现判断不需要 |
| PRD P0 功能只有 UI 壳 | 登记 `partial_shell`，补真实链路任务 | 把按钮可见写成完成 |
| API 没有 owner/workspace/session 校验 | 登记安全缺陷，阻塞验收 | 只靠前端隐藏入口 |
| 报告说已修但代码仍不满足 | 标记 report/code drift，优先修代码或修报告 | 继续引用旧报告证明通过 |
| 入口不该存在但还在 | 删除或显式 disabled + 说明 | 保留为“以后可能用” |
| 未挂载组件仍包含旧产品语义 | 删除或迁移到真实入口 | 让 grep/测试误判为已实现 |
| E2E skip/mock 被计入通过 | 报告中排除 passed 统计 | 合并成“全绿” |

## 5. Good/Base/Bad Cases

- Good：`FR-NOTIFY-001` 审计发现 Web/Mobile 有通知 API 和 Mobile 审批页，但 Desktop 只显示 local seed 授权记录，于是分类为 `partial_shell + stale_or_ghost`，要求接真实 `/api/notifications` 或删除假授权记录。
- Base：`FR-RUNTIME-201 OpenCode` 属 Bytedance backlog/P2，Desktop 显示“待接入”且不可进入会话，分类为 `out_of_scope`，不算 P0 缺陷，但不能从 backlog 删除。
- Bad：PRD 要求“多 Role Agent 群聊”，代码只有单选 `selectedRole`，报告仍写“@角色通过”，这是 `missing_required`，不能被单角色 E2E 覆盖。

## 6. Tests Required

Bytedance/PRD 反查审计输出至少包含：

- Bytedance 来源覆盖矩阵：IM、Agent/Orchestrator、Context、Artifact、部署、多端职责至少一行。
- P0 FR 覆盖矩阵：每个 FR 至少一行。
- 代码证据：文件路径、函数/组件/API 名称。
- 测试证据：已有测试能证明什么，不能证明什么。
- 两类问题分开列：`missing_required` 与 `stale_or_ghost`。
- 修复优先级：安全/数据越权、主用户旅程、假入口、测试假绿。
- 明确未实测范围：本轮未运行的 E2E、外部登录、真实 CLI、模拟器、worker 必须写出。

### Scenario: Bytedance Source Of Truth Backtrace

#### 1. Scope / Trigger

- Trigger: 用户指出“PRD 不可信”“按 Bytedance 来”、P0/P1/P2 范围争议、当前实现与 `bytedance_init_prd.md` 冲突、或需要分析“到 P2 还差什么”。
- Purpose: 先校准事实源，再评估实现，防止派生 PRD、技术设计或报告把 Bytedance 原始需求降级、漏登或删除。

#### 2. Signatures

每次审计必须形成：

```text
Bytedance source:
Transcript support:
Derived FR-ID:
Derived doc status:
Implementation status:
Backlog phase: P0 | P1 | P2 | P3 | deferred
Required doc update:
Decision:
```

#### 3. Contracts

- 先从 `bytedance_init_prd.md` 提取 IM、Agent/Orchestrator、Context、Artifact、部署、多端职责的原始要求。
- 再用 `bytedance_init_video_txt.txt` 解释阶段和端侧差异。
- 派生 `research/prd.md`、产品设计和技术设计必须能回指 Bytedance 来源。
- 当前实现只能作为 implementation status，不能反向证明原始需求不存在。
- P0 未做但 Bytedance 明确要求的能力必须进入 backlog，并标注缺口和阶段，不得删除。

#### 4. Validation & Error Matrix

| Condition | Classification | Required handling |
| --- | --- | --- |
| Bytedance 要求存在但无 FR-ID | `source_doc_drift` | 先补 `research/prd.md` 和下游设计 |
| FR-ID 存在但技术设计无 API/数据/端侧边界 | `source_doc_drift` | 补技术设计和任务拆分输入 |
| P0 未实现但已标成完成 | `missing_required` 或 `partial_shell` | 改 tracker/report，补真实链路任务 |
| P2 能力被写成“不需要” | `source_doc_drift` | 改为 backlog/deferred，并保留验收方向 |
| 当前 UI 有入口但无真实行为 | `partial_shell` | 禁用并说明，或补 API/runtime/测试闭环 |

#### 5. Good/Base/Bad Cases

- Good: 审计发现 `bytedance_init_prd.md` 要求消息回复、引用、重新生成和 Diff 操作；派生 PRD 缺少重新生成验收，于是先补 `FR-CHAT-001`，再评估代码入口。
- Base: 一键部署属于 P2 backlog，P0 只显示禁用入口和解释，不算 P0 缺陷，但 `FR-PUBLISH-201`、技术设计和 tracker 都保留后续完成口径。
- Bad: 因当前代码只有 Claude+Codex，就把 OpenCode 从文档删除，或把 Artifact 编辑/部署写成“非目标”。

#### 6. Tests Required

- 文档扫描：`rg` 检查 `research/` 和 `.trellis/spec/` 是否仍把 `research/prd.md` 写成最高事实源。
- 覆盖矩阵：至少列出 Bytedance 原始要求、派生 FR-ID、当前实现状态、阶段和缺口。
- 实现抽查：对每个声称完成的用户动作给出真实入口、API/DB/runtime、刷新后证据和测试证据。

#### 7. Wrong vs Correct

##### Wrong

```text
P0 没做部署，所以部署不在 AgentHub 产品范围内。
```

##### Correct

```text
部署是 Bytedance P2 backlog。P0 可以不实现真实发布平台，但 PRD、技术设计、tracker 和 UI 降级态必须保留 `FR-PUBLISH-201`、Action/Approval/status/preview URL 的后续完成口径。
```

### Scenario: PRD-driven Pre/Post Test Gate

#### 1. Scope / Trigger

- Trigger: 任意 P0/P1 用户可见功能、跨 Web/Desktop/Mobile 链路、runtime/worker、workspace 文件/产物、权限/审批、三栏工作台、登录/设备绑定、E2E 门禁变更。
- Purpose: 防止“局部按钮可见、API 返回 200、组件存在、测试 skip/mock”被写成完成；尤其防止 Web 工作台文件树、变更、artifact、预览、拖动侧栏、HTML/Markdown/code/diff 预览、下载、产物标记等能力只做壳。

#### 2. Signatures

每次实现和测试前后必须形成并更新以下审计条目：

```text
FR-ID:
Product surface: Web | Desktop | Mobile/PWA | RN | Backend | Runtime
Bytedance expected:
PRD expected:
Latest user decision:
Reference implementation:
Implementation evidence:
Runtime/data evidence:
User entry:
Tests before implementation:
Tests after implementation:
Classification:
Decision:
```

其中 `Reference implementation` 必须写清楚具体参考仓库和组件路径，例如 `refer_proj/xintaofei__codeg/src/components/layout/aux-panel-file-tree-tab.tsx`，不能只写“参考 codeg”。

#### 3. Contracts

- 实现前合同：
  - 先从 `bytedance_init_prd.md`、`bytedance_init_video_txt.txt`、`research/prd.md`、当前合同和用户最新口径列出必做用户动作。
  - 对每个动作找到真实入口、真实 API/DB/runtime、刷新后证据和失败态。
  - 找至少一个同类参考项目组件，记录可迁移行为而不是只看视觉。
- 测试前合同：
  - 测试必须从用户入口开始，覆盖真实 DB/API/session/runtime；缺环境时 `skip` 必须写成未验真，不得计入完成。
  - 对拖动侧栏、三列独立滚动、HTML/Markdown/code/diff 预览、文件下载、artifact 打开、文件标记为产物、右栏与消息双向定位等 UI 行为，必须有交互断言或截图证据。
  - 不能只断言 `toBeVisible`；必须断言数据来源、状态变化、刷新/重读和错误态。
- 测试后合同：
  - 回到 Bytedance/PRD 覆盖矩阵逐条反查，标出 `implemented_verified`、`implemented_unverified`、`partial_shell`、`missing_required`、`source_doc_drift`、`stale_or_ghost`。
  - 删除或迁移旧入口、旧测试、旧文案、未挂载组件和静态 seed。
  - tracker/report 只能写已经真实验证的范围；未跑的 Electron/RN/opencli/worker 必须独立列为未验真。Bytedance backlog 只能标为 deferred/backlog，不能写成产品不需要。

#### 4. Validation & Error Matrix

| Condition | Classification | Required handling |
| --- | --- | --- |
| UI 有文件树但不能打开/预览/下载/标记产物 | `partial_shell` | 补文件 read/preview/download/artifact API 和 E2E；或降级文案说明不可用 |
| 变更 Tab 只读 message metadata，不读真实 Git status/diff | `partial_shell` | 补 workspace Git status/diff API、刷新和 diff 展开测试 |
| Artifact 只是一段消息文本或 raw metadata | `partial_shell` | 补 durable artifact 类型、source message/run、viewer/download/version |
| HTML/Markdown/code/diff preview 只显示 `<pre>` 或占位 | `partial_shell` | 补按类型渲染器和安全边界；测试内容渲染结果而非只看容器 |
| Mobile/PWA preview only supports placeholder/message text | `partial_shell` | 接 `/api/artifacts/:id`，按类型渲染并提供下载 |
| 侧边栏宽度固定，PRD/用户要求可拖动 | `missing_required` | 补 resize handle、min/max、持久化、重载保持、移动端降级 |
| 测试使用 mock API、fixture-only auth 或 skip 后仍算通过 | `stale_or_ghost` | 从通过统计剥离，改真实验真或登记 deferred |
| 历史文档/测试仍断言旧 Tab、旧文案、旧入口 | `stale_or_ghost` | 同步合同、测试和文档，避免下一轮按旧口径实现 |
| 组件未挂载但保留完整产品语义 | `stale_or_ghost` | 删除，或迁移到真实入口并补真实数据 |

#### 5. Good/Base/Bad Cases

- Good: Web 右侧文件树支持拖动侧栏、打开 HTML 文件进入 Preview、下载文件、将文件或文件夹下生成物标记为 artifact；E2E 从真实 cloud workspace 创建文件，点击文件预览，刷新后 artifact 仍在产物 Tab 可读。
- Base: Mobile/PWA 不做完整 IDE 文件管理，但能打开同一 artifact 的移动摘要、下载链接或只读预览；大 diff 合并属于 Web/Desktop 降维，不算 Mobile 缺陷。
- Bad: 实现 `文件` Tab 只列出 README.md，`产物` Tab 只显示 `metadata.artifact` JSON，测试只断言 Tab 文案可见，然后报告写“文件和产物完成”。

#### 6. Tests Required

- Unit/API:
  - 文件预览 API：HTML/Markdown/code/plain/binary 的 content type、大小限制、权限校验、404/403。
  - artifact API：create/list/read/download/source link/version/type/folder-derived artifact。
  - Git changes API：status/diff 空仓库、dirty、untracked、large diff、非 git 目录错误。
- Web E2E:
  - 三列独立滚动和右栏拖动 resize：min/max、重载保持、无输入栏漂移。
  - 文件树：展开文件夹、打开 HTML preview、打开 Markdown/code preview、下载、标记为产物。
  - 变更：真实写入文件后显示 Git status/diff，点击 diff 定位消息/run。
  - 产物：从 runtime 输出和文件树两种来源进入产物，刷新后仍可读。
- Desktop E2E/integration:
  - 本地 workspace 文件绑定、runtime 执行后的文件变更回传、打开 Web 指向有效 workspace/session。
- Mobile/PWA E2E:
  - 打开同一 artifact 摘要、审批/确认后状态同步、无桌面级复杂编辑入口。
- Audit tests:
  - 静态扫描旧 Tab/旧组件/旧 test id/`skip`/`page.route` 主链路 mock，并把结果写入报告。

#### 7. Wrong vs Correct

##### Wrong

```text
文件树能展示目录，artifact panel 能看到 metadata，所以 workspace 文件和产物能力完成。
```

##### Correct

```text
文件和产物能力只有在以下证据都存在时才可标记完成：
- 用户能从真实 workspace 打开文件夹和文件。
- HTML/Markdown/code/diff 等类型能按类型预览。
- 用户能下载文件或产物。
- 可将 runtime 产出或 workspace 文件/文件夹派生成 durable artifact。
- Artifact 记录包含 source message/run/file、type、title、download/read URL。
- 刷新后文件树、变更和产物仍可读。
- Web/PWA/Desktop 的可用范围和降级文案一致。
```

### Scenario: Workspace File Ops + Composer Real-Flow Closure

#### 1. Scope / Trigger

- Trigger: Web 工作台右栏文件/变更/产物、Composer、`/api/chat`、`/api/workspaces/:id/files/*`、`/api/artifacts`、Git status/diff 或附件流发生变更。
- Purpose: 防止“文件树能显示但不能操作”“消息能 POST 但没有 SSE 增量”“权限预设被拼进 prompt”“slash/stop 只是按钮壳”等假完成。

#### 2. Signatures

- `GET /api/workspaces/:id/files` -> `{ root, tree }`
- `GET /api/workspaces/:id/files/read?path=<relative>` -> `{ path, name, type, size, mime, previewKind, content, truncated, downloadUrl }`
- `GET /api/workspaces/:id/files/download?path=<relative>` -> file body or folder zip
- `POST /api/workspaces/:id/files/upload` multipart: `file`, optional `target_dir`; P0 max 512KB
- `POST /api/workspaces/:id/files/rename` JSON: `{ from, to }`
- `POST /api/workspaces/:id/files/delete` JSON: `{ path }`
- `GET /api/workspaces/:id/git/status` -> `{ changes: [{ path, status, staged, untracked }] }`
- `GET /api/workspaces/:id/git/diff?path=<relative>` -> `{ path, diff }`
- `POST /api/chat` JSON: `{ sessionId, content, roleAgentIds?, attachmentIds?, permissionMode? }`, response `text/event-stream`

#### 3. Contracts

- All file paths are workspace-relative. Web API must reject empty path, absolute path, `..` escape, and NUL.
- Cloud Workspace file APIs operate only under cloud project root. Local Desktop Workspace must return explicit unsupported/connector error until Desktop DeviceChannel file proxy exists.
- Git status must use `--porcelain=v1 -uall`; untracked files must be file-level, not collapsed directories.
- Git diff for untracked files must produce a synthetic new-file diff if native `git diff` is empty.
- Artifact creation from file/folder/diff must create durable `artifacts` rows; message metadata is not the source of truth.
- Mobile/PWA preview must consume the same durable artifact record through `/api/artifacts/:id` (`artifactId` or `url=artifact:<id>`), render HTML/Markdown/code/diff/folder/image by type, and expose a download action. Message preview is only a compatibility path.
- Message pin/handoff must start from the mounted Web workspace message card, not only an API route or an old unmounted chat component. The UI must preserve `messages.is_pinned`, PATCH only boolean `is_pinned`, optimistically roll back on failure, and trigger the right-side context/changes panel to reread real messages. Temporary SSE/local system messages without a durable DB id must not show as successfully pinnable.
- Composer must use textarea, stream SSE deltas into visible message text, and keep `permissionMode` as structured metadata/policy input, not prompt suffix.
- Runtime rich events must reduce into `metadata.runtimeParts` on completed agent messages, with Web and Mobile renderers consuming the same parts. Tool/permission/question/diff/artifact cards cannot exist only as transient client state.
- Default chat path must work without explicit `@`; default role is Orchestrator when present.
- Multi-role `@` is not satisfied by storing an array in metadata or putting all roles into one system prompt. When `roleAgentIds` contains multiple ids, the chat API must dispatch each selected Role Agent, emit per-role `role_selected` SSE frames, render separate live reply bubbles, and persist separate agent messages with the correct `role_agent_id`. Tests must assert invocation count, persisted role ids, and stream role ids.
- Notification/approval UI must be mounted in a real product surface. A component such as `NotificationBell` existing in the tree is not enough: Web must expose it from the workspace shell, read `/api/notifications`, approve/cancel action notifications through `/api/actions/:id/approve`, mark notifications read through `/api/notifications`, and refresh the visible action state. Mobile approval may be a separate page, but both surfaces must share the same notification/action records.

#### 4. Validation & Error Matrix

| Condition | Required behavior |
| --- | --- |
| Missing auth or workspace owner mismatch | 401/403, no file/runtime access |
| `local_desktop` file API before Desktop file proxy | 409 with Chinese connector/root explanation |
| Upload over P0 limit | 413 with Chinese error |
| Path escape attempt | 400 with root-containment error |
| Git command failure/non-git root | 400 with readable Git status/diff error |
| Runtime unavailable | SSE terminal event rendered as system notice, no fake agent success |
| User clicks stop | Abort current stream and show stopped notice |
| Plan confirm only changes plan status | `partial_shell` until it marks ready nodes and creates real action/notification rows |
| Approved action has no dispatcher/worker terminal evidence | `partial_shell` until approved action is queued to runtime worker or records an explicit unavailable/unsupported result |

#### 5. Good/Base/Bad Cases

- Good: E2E creates a real cloud workspace/session, uploads a Markdown file through UI, previews it as Markdown, saves it as artifact, opens Git diff from real status, and reloads artifact from API.
- Base: API smoke creates workspace/session, uploads/renames/deletes a file, reads status/diff, creates/downloads artifact; this verifies backend even when UI screenshot is not run.
- Bad: A test only clicks the `文件` tab and sees `README.md`, or `/api/chat` returns a final JSON string but no SSE delta; neither can close PRD.

#### 6. Tests Required

- Unit/helper: path containment, preview kind, folder zip, write/rename/delete, `git status -uall`, untracked synthetic diff.
- API: `/api/chat` with tool/permission/diff/artifact SSE events persists `metadata.runtimeParts` and does not persist fake success on incomplete runtime.
- API smoke: real auth cookie + Postgres fixture + `/api/workspaces`, `/api/sessions`, file upload/rename/delete, git status/diff, artifact create/download.
- Web E2E: `workbench-file-ops.spec.ts` for file/preview/diff/artifact; `role-chat-core.spec.ts` for default Orchestrator, multi-role picker path, textarea/slash, send persistence.
- Plan/action API: confirming a `pending_confirm` plan must mark ready nodes and create action + notification rows when nodes define executable actions; low-risk or approved actions must enter the runtime action dispatcher, create a `runtime_sessions` row, queue a worker job, and let the worker write `actions`/`plan_nodes` terminal status. If the dispatcher is unavailable or unsupported, tests must assert the explicit failure result/notification and no fake `completed`; there must be a retry/resume API for already approved actions so worker outages do not strand the plan.
- Build gate: `pnpm --filter @agenthub/web type-check`, `pnpm --filter @agenthub/web test`, `NEXT_TELEMETRY_DISABLED=1 pnpm --filter @agenthub/web build`.

#### 7. Wrong vs Correct

##### Wrong

```text
- 把 permissionMode 文案拼到 prompt 末尾。
- 变更 Tab 从 message.metadata.diff 读取假 diff。
- 未跟踪目录显示为 docs/，然后声称文件级 diff 完成。
```

##### Correct

```text
- permissionMode 作为结构化字段进入 metadata/policy。
- 变更 Tab 调用真实 Git status/diff API。
- git status 使用 -uall，未跟踪文件生成 synthetic new-file diff。
- action approve 只负责授权；真实完成必须来自 runtime worker 回写 action/plan node 终态，worker 不可用时保留未执行状态并写中文通知。
```

## 7. Wrong vs Correct

### Wrong

```text
Desktop 最近会话有页面和测试，所以 FR-DESK-001 的 Session 入口完成。
```

问题：页面从本地 activity 拼数据，不是 PRD 的 Workspace/Session 真实会话恢复。

### Correct

```text
Desktop 最近会话分类为 stale_or_ghost：
- PRD 当前要求 Desktop 展示本地 Agent 轻量运行态，不承担跨 Workspace Session 管理。
- 代码证据：入口从 activity message 派生，不接 sessions API/native session。
- 决策：删除入口、页面、测试；真实会话恢复另起需求。
```
