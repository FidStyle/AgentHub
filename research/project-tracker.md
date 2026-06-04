# AgentHub 项目跟进表

> 所有 P0/P1/P2 任务的公开跟进记录。Maestro/Ralph 每完成一个 wave 必须同步更新本表。

---

## 治理规则

- **所有功能状态必须在本表同步**。没有本表对应记录，不允许标记 Maestro/Trellis 任务为完成。
- 每条记录必须包含：优先级、FR-ID、对应计划任务、当前状态、验收方式、测试证据、阻塞问题、下一步动作。
- 状态变更时附带日期。
- Maestro/Ralph 每完成一个 wave，必须更新对应任务的「当前状态」和「下一步动作」字段。
- 验证通过后必须补充「测试证据」字段（截图路径、E2E 报告链接或命令输出）。
- Analyze/plan/verify/review 等非代码阶段只要修改 `research/`、`.workflow/roadmap.md`、`.workflow/scratch/*/plan.json` 或测试/代码文件，也必须精确 `git add` 本阶段相关文件并中文 commit；不得只更新 `status.json`。
- 如果工作区已有无关 dirty 文件，必须记录 baseline，只提交本阶段相关文件，并在完成输出中列出剩余 dirty 项。
- **治理门禁**：milestone/session complete 前必须运行 `bash scripts/verify-governance-gate.sh <TASK-ID>` 且 exit 0。status.json completed ≠ 项目完成。
- **顺序执行总表**：2026-06-05 起当前执行队列以 `research/sequential-execution-progress.md` 为准。每个任务默认必须覆盖 Web、Mobile 浏览器/PWA、Desktop/Electron 三端验收；OpenCLI 是三端真实 UI UAT 首选工具，未跑或阻塞不得计入通过。

---

## P0 任务

### SEQUENTIAL-EXECUTION-GOVERNANCE-RESET-2026-06-05: 单分支顺序执行治理重置

| 字段 | 内容 |
|------|------|
| **优先级** | P0 |
| **绑定 FR-ID** | FR-CHAT-001, FR-ORCH-001, FR-RUNTIME-001, FR-PERM-001, FR-WEB-001, FR-MOB-001, FR-DESK-001, FR-UI-001 |
| **对应计划** | `.trellis/tasks/06-05-sequential-execution-governance-reset` |
| **当前状态** | closed（2026-06-05）：从多 worktree/lane 并行治理切换为当前分支顺序执行；新增顺序执行总表；旧 worktree/lane active task 被 sequential queue 接管；三端验收和 OpenCLI Web/Mobile/Electron 规则沉淀到 Trellis spec。 |
| **目标** | 建立可持续迭代的单分支队列，确保当前任务失败即停、验证通过再提交关闭，后续 P0/P1/P2 均按 Bytedance 目标和三端 OpenCLI 验收推进。 |
| **验收方式** | 文档/spec 检查；`git status --short`；Trellis current 指针；`research/sequential-execution-progress.md`、`research/index.md`、`.trellis/spec/cross-layer/real-flow-acceptance.md` 可检索到新规则。 |
| **测试证据** | `python3 -m json.tool` 校验 7 个 touched task.json PASS；`python3 ./.trellis/scripts/task.py current --source` 指向 `.trellis/tasks/06-05-sequential-execution-governance-reset`；`python3 ./.trellis/scripts/task.py list` 显示旧 lane task 为 `superseded-by-sequential-queue` 且本任务为 current；`rg` 可检索 `sequential-execution-progress` / 三端 OpenCLI 规则；`git diff --check` PASS；work commit `10c9e87 docs: 建立单分支顺序执行治理`。 |
| **阻塞问题** | 无。 |
| **下一步动作** | clean 后进入 `06-05-sync-role-runtime-opencli-failure-evidence`。 |

### SYNC-ROLE-RUNTIME-OPENCLI-FAILURE-EVIDENCE-2026-06-05: 同步角色 Runtime OpenCLI 失败证据

| 字段 | 内容 |
|------|------|
| **优先级** | P0 |
| **绑定 FR-ID** | FR-CHAT-001, FR-ORCH-001, FR-AGENT-001, FR-RUNTIME-001, FR-PERM-001, FR-WS-001, FR-ACTION-001, FR-UI-001 |
| **对应计划** | `.trellis/tasks/06-05-sync-role-runtime-opencli-failure-evidence` |
| **合同路径** | `research/contracts/ROLE-RUNTIME-WORKSPACE-PERMISSIONS-2026-06-03.md` |
| **当前状态** | closed（2026-06-05）：已从旧 `.trellis/tasks/06-03-role-runtime-workspace-permissions/research/acceptance-report.md` 同步事实。旧 lane 只有 shared/domain/Desktop 合同级证据；旧报告明确未启动 dev server、未使用 `http://127.0.0.1:3106`，因此 Web、Mobile/PWA、Desktop/Electron OpenCLI 真实 UI UAT 均未通过。Trellis 任务已归档到 `.trellis/tasks/archive/2026-06/06-05-sync-role-runtime-opencli-failure-evidence`。 |
| **目标** | 防止旧 worktree/lane 合同测试被误记为 Bytedance 主链路验收通过；把失败/未验收事实写入当前分支公开总账，并保持后续修复队列不被跳过。 |
| **验收方式** | 文档和证据同步检查；核对旧报告、顺序执行总表、OpenCLI 三端验收规范；不修改业务代码。 |
| **测试证据** | `python3 ./.trellis/scripts/task.py validate .trellis/tasks/06-05-sync-role-runtime-opencli-failure-evidence` PASS；`python3 -m json.tool .trellis/tasks/06-05-sync-role-runtime-opencli-failure-evidence/task.json` PASS；JSONL 逐行解析 PASS；`python3 ./.trellis/scripts/task.py current --source` 归档前指向本任务、归档后为 none；`rg` 可检索 `not-run` / `not-accepted` 结论；`git diff --check` PASS；work commit `31dc562 docs: 同步 role runtime OpenCLI 未验收事实`；status commit `2d42395 docs: 记录 role runtime 证据同步提交状态`。当前报告：`research/execution-reports/role-runtime-opencli-failure-evidence-2026-06-05.md`。 |
| **阻塞问题** | 无当前阻塞。产品主链路仍未验收：固定样本 workspace `/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2` 与 prompt `做一个加减乘除的简单网站，使用sqlite存储历史记录` 尚未跑 Web/Mobile/PWA/Desktop/Electron OpenCLI UAT。 |
| **下一步动作** | clean 后进入 `06-05-fix-role-runtime-cwd-context-isolation`；不得直接跳到最终 OpenCLI UAT。 |

### ROLE-RUNTIME-CWD-CONTEXT-ISOLATION-2026-06-05: 角色 Runtime cwd 与上下文隔离修复

| 字段 | 内容 |
|------|------|
| **优先级** | P0 |
| **绑定 FR-ID** | FR-CHAT-001, FR-ORCH-001, FR-AGENT-001, FR-RUNTIME-001, FR-WS-001 |
| **对应计划** | `.trellis/tasks/archive/2026-06/06-05-fix-role-runtime-cwd-context-isolation` |
| **合同路径** | `research/contracts/ROLE-RUNTIME-WORKSPACE-PERMISSIONS-2026-06-03.md` |
| **当前状态** | closed（2026-06-05）：已修复 cloud workspace role runtime `cwd` 绑定与上下文隔离并归档 Trellis task。`/api/chat` 从 selected workspace 解析 cloud root；runtime session、Redis worker job、mailbox/runtime-node dispatch、local relay payload、real CLI worker executor 均不再 fallback 到 AgentHub 宿主 repo、`process.cwd()` 或 `RUNTIME_CWD`。业务角色 prompt 加入 selected workspace root 和禁止推断宿主 `AGENTS.md`、Trellis、monorepo、Next.js/React/Drizzle/Postgres/next-auth 上下文的约束。 |
| **目标** | 固定样本 workspace `/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2` 的 role runtime 只能在 selected cloud workspace root 下创建 session、投递 job、执行 CLI，并且上下文不注入宿主 repo 技术栈判断。 |
| **验收方式** | Web API/runtime/orchestrator/mailbox/unit tests + Shared runtime-workspace contract tests + type-check/lint；本任务不声明 OpenCLI 三端 UAT 通过。 |
| **测试证据** | Report: `research/execution-reports/role-runtime-cwd-context-isolation-2026-06-05.md`；`pnpm --filter @agenthub/shared build` PASS；`pnpm --filter @agenthub/web test` PASS（30 files / 252 tests）；focused Web runtime/chat suite PASS（7 files / 57 tests）；`pnpm --filter @agenthub/web type-check` PASS；`pnpm --filter @agenthub/shared type-check` PASS；`pnpm --filter @agenthub/shared test -- src/domain/runtime-workspace.test.ts` PASS（1 file / 9 tests）；`pnpm --filter @agenthub/web lint` PASS（仅既有 Next lint deprecation/config warning，无 ESLint warnings/errors）；`task.py validate` PASS；task JSON/JSONL parse PASS；`git diff --check` PASS；work commit `b5da89d`；status commit `cf161b7`；archive commit `0478ce3`。 |
| **阻塞问题** | 无当前代码阻塞。OpenCLI Web/Mobile/PWA/Desktop-Electron UAT 仍为 `not-run`，按顺序队列留给 `06-05-opencli-role-runtime-uat`。 |
| **下一步动作** | clean 后进入 `06-05-fix-architect-durable-dispatch`，不得跳过 durable dispatch 和 permission broker 修复。 |

### ARCHITECT-DURABLE-DISPATCH-2026-06-05: 架构师 durable dispatch 修复

| 字段 | 内容 |
|------|------|
| **优先级** | P0 |
| **绑定 FR-ID** | FR-CHAT-001, FR-ORCH-001, FR-AGENT-001, FR-RUNTIME-001, FR-WS-001 |
| **对应计划** | `.trellis/tasks/archive/2026-06/06-05-fix-architect-durable-dispatch` |
| **合同路径** | `research/contracts/ROLE-RUNTIME-WORKSPACE-PERMISSIONS-2026-06-03.md` |
| **当前状态** | closed（2026-06-05）：已修复单独 `@架构师` / 默认架构师收到工程实现请求时只走 direct chat 的问题，并归档 Trellis task。`/api/chat` 现在使用 shared `createArchitectDispatch` 判断工程需求，并把请求的 backend/frontend 目标映射到当前 workspace 的真实角色，再进入既有 durable orchestration 路径，产生 plan、plan nodes、attempts、mailbox items 和携带 selected workspace cwd 的 runtime jobs。 |
| **目标** | 固定样本 `做一个加减乘除的简单网站，使用sqlite存储历史记录` 必须触发后端与前端工程角色派发，并留下可刷新读回的 durable dispatch evidence；不得只让架构师直接回复。 |
| **验收方式** | Web API/orchestrator/mailbox tests + Shared runtime-workspace contract tests + type-check/lint；本任务不声明 OpenCLI 三端 UAT 通过。 |
| **测试证据** | Report: `research/execution-reports/architect-durable-dispatch-2026-06-05.md`；focused Web chat/orchestrator suite PASS（2 files / 31 tests）；focused Web dispatcher/mailbox suite PASS（2 files / 10 tests）；`pnpm --filter @agenthub/web test` PASS（30 files / 253 tests）；`pnpm --filter @agenthub/shared test` PASS（7 files / 47 tests）；`pnpm --filter @agenthub/web type-check` PASS；`pnpm --filter @agenthub/shared type-check` PASS；`pnpm --filter @agenthub/web lint` PASS（仅既有 Next lint deprecation/config warning，无 ESLint warnings/errors）；`task.py validate` PASS；task JSON/JSONL parse PASS；`git diff --check` PASS；work commit `8ab4b10`；status commit `161ca12`；archive commit `3a6bf73`。 |
| **阻塞问题** | 无当前代码阻塞。OpenCLI Web/Mobile/PWA/Desktop-Electron UAT 仍为 `not-run`，按顺序队列留给 `06-05-opencli-role-runtime-uat`。 |
| **下一步动作** | 提交并归档后进入 `06-05-fix-runtime-permission-broker`；不得跳过 permission broker 修复直接跑最终 OpenCLI UAT。 |

### RUNTIME-PERMISSION-BROKER-2026-06-05: Runtime permission broker 修复

| 字段 | 内容 |
|------|------|
| **优先级** | P0 |
| **绑定 FR-ID** | FR-CHAT-001, FR-ORCH-001, FR-AGENT-001, FR-RUNTIME-001, FR-PERM-001, FR-ACTION-001, FR-WS-001, FR-UI-001 |
| **对应计划** | `.trellis/tasks/06-05-fix-runtime-permission-broker` |
| **合同路径** | `research/contracts/ROLE-RUNTIME-WORKSPACE-PERMISSIONS-2026-06-03.md`；`.trellis/spec/backend/runtime-workspace-contract.md` |
| **当前状态** | committed（2026-06-05）：已修复 native CLI/tool request 进入产品 permission broker 的路径。Claude/Codex JSON tool 事件会转为结构化 `toolRequest`；runtime worker 基于 selected workspace context 创建 pending action + notification + `approval_requested`，并停止当前 job，避免工具请求被当作普通输出执行；已授权 action 投递前会重新校验 `cwd` 与命令中的 absolute path 是否仍在 selected workspace root 内。Web message permission card 展示动作、命令、cwd、workspace root、路径和风险，拒绝后显示 `已拒绝，未执行该操作。`。 |
| **目标** | 写文件、依赖安装、启动服务、网络请求、workspace 外路径访问、破坏性命令都必须先进入产品权限 broker；拒绝不执行；允许后仍受 selected workspace root 限制。 |
| **验收方式** | Shared permission evaluator tests + Web runtime parser/worker/action-dispatcher/API/message-card tests + type-check/lint；本任务不声明 OpenCLI 三端 UAT 通过。 |
| **测试证据** | Report: `research/execution-reports/runtime-permission-broker-2026-06-05.md`；`pnpm --filter @agenthub/shared test -- src/domain/runtime-workspace.test.ts` PASS（1 file / 15 tests）；`pnpm --filter @agenthub/web test -- __tests__/runtime/executor.test.ts __tests__/orchestrator/action-dispatcher.test.ts __tests__/message-markdown.test.ts __tests__/api/chat.test.ts __tests__/runtime/gateway-gating.test.ts __tests__/runtime/local-device-relay.test.ts` PASS（6 files / 66 tests）；`pnpm --filter @agenthub/web type-check` PASS；`pnpm --filter @agenthub/shared type-check` PASS；`pnpm --filter @agenthub/web lint` PASS（仅既有 Next lint deprecation/config warning，无 ESLint errors）；`git diff --check` PASS；work commit `d9c4b27`。 |
| **阻塞问题** | 无当前代码阻塞。OpenCLI Web/Mobile/PWA/Desktop-Electron UAT 仍为 `not-run by scope`，按顺序队列留给 `06-05-opencli-role-runtime-uat`。 |
| **下一步动作** | 归档后进入 `06-05-opencli-role-runtime-uat`，跑固定样本三端真实 UI UAT。 |

### ORCHESTRATOR-IM-MARKDOWN-GIT-DIFF-2026-06-03: Orchestrator IM、Markdown、权限确认与 Git 变更面板

| 字段 | 内容 |
|------|------|
| **优先级** | P0 |
| **绑定 FR-ID** | FR-CHAT-001, FR-ORCH-001, FR-AGENT-001, FR-RUNTIME-001, FR-PERM-001, FR-ACTION-001, FR-ARTIFACT-001, FR-RESULT-001, FR-WEB-001, FR-MOB-001, FR-UI-001 |
| **合同路径** | `research/contracts/ORCHESTRATOR-IM-MARKDOWN-GIT-DIFF-2026-06-03.md` |
| **当前状态** | ✅ 完成（2026-06-03，用户复核回归已修复）：已完成详细合同、AionUi 风格 Markdown renderer 接入、被 @ 角色任务相关确认消息、同 session mailbox 串行 ready selection、cloud Git staged/unstaged diff、stage/unstage/discard 和 discard pending approval -> approve endpoint -> Git API 执行闭环；用户复核发现的“压平 Markdown 分点无法正确显示”和“消息流 permission 卡无确认按钮”已补显示层 normalization、消息内 `允许单次执行 / 拒绝` 按钮、单测与 opencli 证据。 |
| **目标** | 让 Orchestrator IM 呈现真实公司协作式多角色交互；Markdown 正确渲染；权限确认使用结构化交互；Changes/Get Diff 覆盖 status/diff/stage/unstage/discard。 |
| **验收方式** | Web/API/shared tests + opencli Web UAT：真实 workspace/session 中 @ 多个自定义角色，刷新后确认消息可恢复；Markdown 表格/代码块无布局溢出；Git status 与真实 repo 一致；destructive discard 必须进入结构化审批确认。 |
| **测试证据** | `pnpm --filter @agenthub/web type-check` PASS；`pnpm --filter @agenthub/web test -- __tests__/api/chat.test.ts __tests__/workspace-files-artifacts.test.ts __tests__/api/plans-actions-owner.test.ts __tests__/api/workspace-git-discard-approval.test.ts __tests__/orchestrator/action-dispatcher.test.ts` PASS（5 files / 25 tests）；`pnpm --filter @agenthub/shared test` PASS（5 files / 32 tests）；opencli Web UAT PASS：工作区页可渲染、`message-markdown=7`、Changes 面板 `README.md` 未暂存、diff preview 可见、discard 审批卡显示“确认丢弃未暂存改动 / 允许单次执行 / 拒绝”，点击“拒绝”后显示“已拒绝丢弃改动”，布局未横向溢出。2026-06-03 用户复核回归追加：`pnpm --filter @agenthub/web test -- __tests__/message-markdown.test.ts __tests__/session-store.test.ts` PASS（2 files / 7 tests）；`pnpm --filter @agenthub/web type-check` PASS；opencli 最新 Web 断言 `ul=7`、`ol=1`、`li=21`、消息流 `permissionCards=1`、按钮 `允许单次执行 / 拒绝`、`plusPhrasePreserved=true`、`overflow=false`。截图：`e2e/artifacts/opencli-uat/web-workspace-fixed-2026-06-03.png`、`web-changes-panel-2026-06-03.png`、`web-changes-diff-2026-06-03.png`、`web-git-discard-approval-2026-06-03.png`、`web-markdown-list-regression-2026-06-03.png`、`web-message-permission-card-live-2026-06-03.png`。执行报告：`research/execution-reports/orchestrator-im-markdown-git-diff-2026-06-03-report.md`。 |
| **阻塞问题** | 已解除。本合同 P0 不再有阻塞；local desktop Git bridge、latest commit revert/stash/conflict resolution、Mobile/PWA 专项审批视图作为后续增强另行拆任务。 |
| **下一步动作** | 已完成；后续增强按新合同/任务拆分。 |

### P0-ACCEPTANCE-ENV-UAT-CLOSURE: P0 验收环境、E2E 与报告收口

| 字段 | 内容 |
|------|------|
| **优先级** | P0 |
| **绑定 FR-ID** | FR-WEB-001, FR-CHAT-001, FR-RUNTIME-001, FR-DESK-001, FR-ARTIFACT-001, FR-NOTIFY-001, FR-UI-001 |
| **对应计划** | `.trellis/tasks/06-02-p0-acceptance-env-uat-closure` |
| **当前状态** | ✅ 完成（2026-06-02，用户复核后追加统一）：验收环境入口统一为 `docker/.acceptance.env`、`docker/docker-compose.acceptance.yml`、`docker/postgres/acceptance-schema.sql` 和 `env:acceptance:*`；历史 env fallback 与旧别名已删除。Playwright acceptance profile 固定串行 worker，解决共享 Auth.js 测试用户下 DB 变更型 E2E 多 worker 污染；普通开发 CLI/非共享状态测试仍可并行。旧 E2E 口径同步到当前 UI：默认角色为 `Orchestrator`，右栏为「角色/文件/变更/产物」，durable artifact 不再从 message metadata 假装产物。Desktop/native session resume/continue 已接官方 CLI 能力：Claude Code 使用 `--resume/--continue`，Codex 使用 `codex exec resume`，AgentHub 持久化并按 `(session, role, runtime, cwd)` 复用 native session id。Cloud worker 统一为 machine-wide real CLI inventory，按每个 Role Agent 的 `runtime_type` 调度 Claude Code/Codex；同 session多角色由 Orchestrator 创建 durable plan/nodes，planner -> worker fan-out -> summarizer fan-in，并持久化 ContextPackage handoff。`pending_confirm` plan 中的 `runtime_invoke` 节点确认后可直接投递 runtime worker，不再要求 command/action row；worker 支持无 actionId 的纯 planNodeId job 回写节点终态并结算父 plan。 |
| **目标** | 关闭 P0 报告中剩余的环境入口、旧 E2E 假绿、多角色/通知/pin/附件/artifact/文件预览主入口复验和报告漂移问题。 |
| **验收方式** | 使用 `pnpm env:acceptance:up` / `pnpm dev:acceptance` / `pnpm env:acceptance:smoke` 准备真实 Postgres/Redis/Auth.js session；Web acceptance E2E 使用 `pnpm test:e2e:acceptance`、`pnpm test:e2e:acceptance:runtime`、`pnpm test:e2e:acceptance:no-worker`，全部真实 API/DB/session，无主链路 mock。 |
| **测试证据** | `pnpm env:acceptance:smoke` PASS（CRUD 5/5，`/api/chat` 11/11，smoke 可自动临时启动 Web）；`pnpm test:e2e:acceptance` PASS（18 passed）；`pnpm test:e2e:acceptance:runtime` PASS（2 passed，串行复跑）；`pnpm test:e2e:acceptance:no-worker` PASS（1 passed，先关闭 orphan worker 后串行复跑）；`pnpm --filter @agenthub/shared build` PASS；`pnpm --filter @agenthub/web type-check` PASS；`pnpm --filter @agenthub/desktop type-check` PASS；`pnpm --filter @agenthub/web test -- __tests__/api/runtime-status.test.ts __tests__/api/chat.test.ts __tests__/runtime` PASS（8 files / 35 tests）；`pnpm --filter @agenthub/desktop test` PASS（5 files / 27 tests）。2026-06-02 追加完整编排/worker 证据：`pnpm type-check` PASS；`pnpm --filter @agenthub/web build` PASS；`pnpm --filter @agenthub/web test -- __tests__/api/chat.test.ts __tests__/api/role-agents.test.ts __tests__/runtime/gateway-gating.test.ts __tests__/runtime/local-device-relay.test.ts __tests__/runtime/executor.test.ts` PASS（5 files / 47 tests）；`pnpm --filter @agenthub/shared test` PASS（4 files / 27 tests）；`pnpm --filter @agenthub/shared build` PASS。追加 plan confirm/runtime_invoke 闭环：`pnpm --filter @agenthub/web test -- __tests__/runtime/executor.test.ts __tests__/api/plans-actions-owner.test.ts` PASS（2 files / 22 tests）；`pnpm --filter @agenthub/web type-check` PASS。 |
| **阻塞问题** | P0 blocker 已关闭。仍未自动化的范围：外部 OAuth/登录绑定人工点击、原生 RN 设备/模拟器 GUI。 |
| **下一步动作** | P0 验收收口完成；后续人工演示只使用 acceptance 命令和 `docker/.acceptance.env`。 |

### ACCEPTANCE-REAL-FLOW-2026-06-01: 验收真实闭环

| 字段 | 内容 |
|------|------|
| **优先级** | P0 |
| **绑定 FR-ID** | FR-AUTH-001, FR-WS-001, FR-CHAT-001, FR-AGENT-001, FR-RUNTIME-001, FR-DESK-001, FR-MOB-001, FR-ARTIFACT-001, FR-PERM-001 |
| **对应计划** | `.trellis/tasks/06-01-acceptance-real-flow-program/` + 6 个子任务 |
| **合同路径** | `research/contracts/ACCEPTANCE-REAL-FLOW-2026-06-01.md` |
| **当前状态** | ✅ 完成（2026-06-01）：已建立总合同、Trellis 任务树和 opencli UAT skill；已修 runtime worker 默认验收模式从 fake/script 改为 real CLI；已跑通 Web `/api/chat` → Gateway → Redis 跨进程 relay → Desktop DeviceChannel → Electron `RuntimeHost` → 真实 Claude CLI → SSE → agent message 落库的 `local_desktop` 核心 @ 链路；cloud `@架构师` API 链路和 390x844 Mobile/PWA 视口均已通过 Gateway/Redis/runtime worker/real executor 返回非 echo 回复并落库；public cloud runtime 日志已去除 Gateway/worker 双写；附件上传已通过真实 API 落 metadata/contentRef，`@角色` 请求可携带附件上下文，runtime artifact 块已持久化并在右侧面板刷新后可读；最终 execution report 和治理门禁已收口。 |
| **目标** | 本地链路、远程链路分别跑通核心 `@角色` 对话，附件上传和 artifact 产出真实可读，最终用 opencli/Playwright 留下 Web/Electron/Mobile/PWA UAT 证据。 |
| **验收方式** | 本地和远程 `/api/chat` 均验证 runtime_sessions/runtime_logs/messages；Web/Electron 使用 opencli/Playwright 从真实入口操作；附件与 artifact 要能刷新后读取；禁止 `FakeExecutor`/`ScriptedRealExecutor` 作为产品成功证据。 |
| **测试证据** | `opencli doctor` PASS；`pnpm --filter @agenthub/web type-check` PASS；`pnpm --filter @agenthub/desktop type-check` PASS；`pnpm --filter @agenthub/web test -- __tests__/runtime __tests__/api/chat.test.ts` PASS（7 files / 31 tests）；`pnpm env:acceptance:smoke` PASS（CRUD 5/5，chat 14/14）；`npx playwright test --config e2e/playwright.desktop.config.ts --workers=1` PASS（45 passed，2 skipped）；定向 Web/local、cloud、Mobile/PWA、附件/artifact DB/API/UI 验收详见 `research/execution-reports/acceptance-real-flow-2026-06-01-report.md`。 |
| **阻塞问题** | 无。 |
| **下一步动作** | 闭环，无后续动作；若继续增强，建议拆大文件/二进制附件对象存储和原生 Android 模拟器人工验收。 |

### ACCEPTANCE-HARDENING-2026-06-01: 验收前全功能硬化

| 字段 | 内容 |
|------|------|
| **优先级** | P0 |
| **绑定 FR-ID** | FR-AUTH-001, FR-WS-001, FR-WEB-001, FR-DESK-001, FR-MOB-001, FR-CHAT-001, FR-RUNTIME-001, FR-DEVICE-001, FR-ARTIFACT-001, FR-ORCH-001, FR-UI-001 |
| **对应计划** | `.trellis/tasks/06-01-acceptance-hardening-program/`（父任务）+ 六个 P0 子任务 |
| **合同路径** | `research/contracts/ACCEPTANCE-HARDENING-2026-06-01.md` |
| **当前状态** | ✅ 完成（2026-06-01）：验收硬化总控合同和六个 Trellis 子任务均已完成。基础质量门禁、可复现验收环境、Web worker/no-worker 主链路、Desktop 本地能力与 Electron GUI 门禁、Mobile PWA/RN 真实闭环、最终 UAT 报告和治理门禁均已通过。 |
| **目标** | 最终验收前确保所有核心功能真实可用，所有门禁真实全绿，测试不假绿，环境可复现，三端用户链路可人工验收。 |
| **验收方式** | 按合同第 11 节完成 lint/type-check/build/Web Vitest/真实环境 smoke/Web E2E/Desktop/Mobile/治理门禁/Codex 独立验收。 |
| **测试证据** | 质量门禁证据：`pnpm lint` PASS；`pnpm type-check` PASS；`pnpm test` PASS（shared 27 + mobile 5 + web 112 + desktop 23）；`pnpm build` PASS；`pnpm --filter @agenthub/web test` PASS（11 files / 112 tests）；`pnpm --filter @agenthub/mobile type-check` PASS；`pnpm --filter @agenthub/mobile build` PASS。环境证据：`pnpm env:acceptance:up` PASS；`pnpm dev:acceptance` 启动 Web + worker；`pnpm env:acceptance:smoke` PASS（CRUD 5/5，chat 14/14）。Web E2E：`RUNTIME_E2E=1 ... p0-main-flow/messaging/artifact/web-orchestrator-ui/artifact-panel-data` PASS（7 passed）；`RUNTIME_E2E_NOWORKER=1 ... role-chat-no-worker/messaging` PASS（2 passed）。Desktop：`pnpm --filter @agenthub/desktop type-check` PASS；`pnpm --filter @agenthub/desktop test` PASS（5 files / 23 tests）；`pnpm --filter @agenthub/desktop build` PASS；`npx playwright test --config e2e/playwright.desktop.config.ts --workers=1` PASS（45 passed，2 skipped，skipped 为外部登录环境门槛）。Mobile：`RUNTIME_E2E=1 ... mobile-chat-deliver/mobile-pwa/visual-gate` PASS（13 passed）；`RUNTIME_E2E_NOWORKER=1 ... mobile-chat-deliver` PASS（1 passed）；`pnpm --filter @agenthub/mobile test/type-check/build` PASS；`pnpm --filter @agenthub/mobile exec react-native start --help` PASS；Metro 启动到 `Dev server ready`。执行报告：`research/execution-reports/acceptance-quality-gates-2026-06-01.md`；`research/execution-reports/acceptance-env-bootstrap-2026-06-01.md`；`research/execution-reports/acceptance-web-core-flow-2026-06-01.md`；`research/execution-reports/acceptance-desktop-runtime-2026-06-01.md`；`research/execution-reports/acceptance-mobile-surfaces-2026-06-01.md`；`research/execution-reports/acceptance-final-uat-governance-2026-06-01.md`。 |
| **阻塞问题** | 已解除：Desktop lint hard failure、Web Vitest failure、根 test 漏 Web、Mobile type/build echo skip、验收环境手工拼装、runtime worker 快速 pub/sub 丢输出竞态、Web Artifact `result_card` 不展示、`/api/plans` 本地 Postgres `uuid[]` 写入 500、Web E2E 过期 Tab/外部 env 依赖、Desktop E2E 启动端口错误、Desktop 待接入/诊断/会话输入框过期断言、Mobile PWA service worker 开发态导航干扰、`/m/sessions` 无效预缓存、Mobile `expo start` 假入口。2026-06-02 追加解除：旧 `/api/runtime/invoke` 已停用，不再返回 invoked 假成功；未挂载旧 Web chat/detail/sidebar/store 已删除；Desktop native session resume/continue 已接官方 CLI 续接能力。残留风险：Desktop 登录绑定 E2E 两项依赖外部登录/构建 app 环境；RN 设备/模拟器 GUI 未纳入自动验收；runtime worker 使用 deterministic script executor 验证链路。 |
| **下一步动作** | 已完成。后续如进入人工演示，可直接使用 `pnpm env:acceptance:up`、`pnpm dev:acceptance`、`pnpm env:acceptance:smoke` 复现验收环境。 |

### THREE-SURFACE-WORKBENCH-PERMISSION-001: 三端会话工作台与权限模型统一

| 字段 | 内容 |
|------|------|
| **优先级** | P0 |
| **绑定 FR-ID** | FR-WEB-001, FR-DESK-001, FR-MOB-001, FR-CHAT-001, FR-PERM-001, FR-NOTIFY-001, FR-ACTION-001, FR-ARTIFACT-001, FR-RESULT-001, FR-UI-001 |
| **对应计划** | `.trellis/tasks/05-31-three-surface-workbench-permission-model/` |
| **合同路径** | `research/contracts/THREE-SURFACE-WORKBENCH-PERMISSION-001.md` |
| **当前状态** | ✅ 完成（2026-05-31）：已移除 Desktop 旧审批中心语义并改为本机策略/权限预设/本机策略审计记录；Web 已补 Composer 权限模式、附件入口、Session 搜索和 `Context / Changes / Artifacts` 右栏；第二轮已按 codeg/AionUi 方向增强授权卡、计划卡、diff 预览、artifact 卡、Session 列表和 Desktop 策略控制台密度；Mobile/PWA 已改为远程监督授权文案；相关前端 spec、产品文档、合同、PRD amendment 和参考迁移清单已同步。 |
| **目标** | 统一三端 Agent 工作台、权限模式、授权入口、Desktop 本机策略和参考项目迁移原则，替代现有简陋审批列表和割裂 UI |
| **验收方式** | 后续实现必须按共享合同覆盖 Web/Desktop/Mobile：权限预设、Run 卡、授权卡、Composer、Session 切换、Git diff、artifact、标题/内容搜索、Desktop 本机策略和执行日志；Desktop 不出现审批中心 |
| **测试证据** | `pnpm --filter @agenthub/web type-check` PASS；`pnpm --filter @agenthub/desktop type-check` PASS；`pnpm --filter @agenthub/desktop test -- --run` PASS（5 files / 22 tests，2026-06-02 复跑）；旧审批 UI 扫描 clean（仅安全脚本保留“拒绝本地 IP”语义）；执行报告：`research/execution-reports/three-surface-workbench-permission-001-ui-polish-report.md`；轻量截图：`e2e/artifacts/three-surface-ui-polish-home.png`（未登录首屏） |
| **阻塞问题** | 无当前阻塞；后续组件抽取和更完整视觉 E2E 独立推进 |
| **下一步动作** | 后续继续抽 `AuthorizationCard`、`DiffViewer`、`RunTimeline`、`ArtifactViewer` 并补 Web/Mobile E2E/视觉截图 |

### LOCAL-DESKTOP-OPERABILITY-001: 本地 Desktop 工作区只读/可操作与 Runtime 真实性

| 字段 | 内容 |
|------|------|
| **优先级** | P0 |
| **绑定 FR-ID** | FR-AUTH-001, FR-WS-001, FR-DEVICE-001, FR-DESK-001, FR-RUNTIME-001, FR-WEB-001, FR-ORCH-001 |
| **合同路径** | `research/contracts/LOCAL-DESKTOP-OPERABILITY-001.md` |
| **当前状态** | ✅ 完成（2026-05-31）：修复 `/api/plans` 本地 Postgres adapter 不支持 `*, plan_nodes(*)` 导致 `column "*"` 500；新增 Local Desktop Workspace `readOnlyAvailable/operable/blockReason` 状态；Web 工作区列表区分“查看历史”和“连接并继续”，工作区内部只读模式禁用输入/发送并展示刷新连接状态；Desktop Runtime doctor 检测 CLI path/version/auth/launchable，Runtime 卡片不再 hardcode connected；Desktop 用户文案从“设备通道”改为“云端连接”；runtime_detection 通过 DeviceChannel event 回写 `runtime_capabilities`。 |
| **目标** | 防止 Web 在 Desktop 离线或本地 CLI 未通过 doctor 时假装可以继续执行；允许历史只读查看，只有真实连通后才可操作 |
| **验收方式** | type-check + Web build + Desktop vitest + Web API vitest；人工验收路径见合同 |
| **测试证据** | `pnpm --filter @agenthub/web type-check` PASS；`pnpm --filter @agenthub/desktop type-check` PASS；`pnpm --filter @agenthub/web build` PASS；`pnpm --filter @agenthub/desktop test -- --run` 6 passed；`DATABASE_URL=postgresql://test pnpm exec vitest run apps/web/__tests__/api/chat.test.ts apps/web/__tests__/api/workspaces.test.ts` 23 passed |
| **阻塞问题** | 无当前阻塞。Claude Code / Codex native session resume/continue provider 已在 Desktop `LocalRuntimeAdapter` 与 Web gateway 接入；真实 Electron GUI 截图仍可后续补强。 |
| **下一步动作** | 可补真实 Electron GUI 截图和完整 Web/Desktop 联调 E2E |

### P0-END-TO-END-PRODUCT-FLOW: MVP 端到端产品主链路合同与验真

| 字段 | 内容 |
|------|------|
| **优先级** | P0 |
| **绑定 FR-ID** | FR-AUTH-001, FR-WS-001, FR-DEVICE-001, FR-WEB-001, FR-DESK-001, FR-MOB-001, FR-CHAT-001, FR-UI-001, FR-RUNTIME-001, FR-PERM-001 |
| **对应计划** | Codex 前置合同与验真框架；Ralph blind verify session `ralph-20260528-100000` 已完成；下一步进入修复规划 |
| **合同路径** | `research/contracts/P0-END-TO-END-PRODUCT-FLOW.md` |
| **当前状态** | ⚠️ 技术验证通过、产品主价值未达成（2026-05-30 PRODUCT-UAT-GAP-AUDIT-001 复审）：DB/Auth smoke + /api/chat 集成测试 11/11 PASS + Web E2E 4/4 PASS + Mobile Auth E2E 4/4 PASS + Desktop API 1/1 PASS + 视觉断言通过；但**多 Agent 协作回复**这一核心价值在真实用户默认入口下不可达（Web 0 可见回复、Mobile 发送只写库不触发 runtime、Artifact 面板恒空壳）。FakeExecutor 回显 ≠ Agent 链路成功。详见 REG-20260530-006/007/008。 |
| **目标** | 以真实 MVP 用户链路验证项目，而不是用单页、单接口或按钮反馈作为完成依据 |
| **方案摘要** | 建立端到端产品合同；登记身份连续性、Workspace 创建闭环、三端 UX 一致性为验真样本；禁止把已知根因直接喂给执行者 |
| **验收方式** | 盲验证必须基于合同自行发现主链路断点；后续实现必须使用真实 DB/API/session 并覆盖 Web/Desktop/Mobile E2E |
| **测试证据** | DB smoke: `research/execution-reports/p0-end-to-end-product-flow-real-db-smoke-report.md`；/api/chat: `tsx scripts/verify-p0-chat-api.ts` 11/11 PASS；Web E2E: `npx playwright test tests/web/p0-main-flow.spec.ts` 4/4 PASS；Mobile Auth: `npx playwright test tests/web/p0-mobile-auth.spec.ts` 4/4 PASS；Desktop API: `npx playwright test tests/desktop/p0-auth-flow.spec.ts` 1/1 PASS + 1 skip（需 Electron 构建）；视觉断言: assertNoHorizontalScroll + assertNoElementOverlap PASS |
| **阻塞问题** | **REG-20260530-006（P0 blocker）已全部关闭**：Web GAP-001 由 `ROLE-CHAT-RUNTIME-DELIVER-001`(commit `eed577f`)、Mobile GAP-002 由 `MOBILE-CHAT-DELIVER-001`(commit `3b8029f`) 关闭。残留 Agent Runtime 完整部署（P1）+ Artifact 面板真实数据 REG-20260530-007/008（P1）。「FakeExecutor 回显 ≠ Agent 链路成功」原则保留，禁止再以单测/E2E 视觉断言冒充产品完成。 |
| **下一步动作** | Web + Mobile 真实回复链路均已解除阻塞（`ROLE-CHAT-RUNTIME-DELIVER-001` + `MOBILE-CHAT-DELIVER-001`）；Agent Runtime 完整部署（P1）；REG-20260530-007/008（P1）跟进 |

### PRODUCT-REALITY-GAP-AUDIT-001: 三端假交互/占位/未闭环只读审计

| 字段 | 内容 |
|------|------|
| **优先级** | P0（审计本身只读；揭示 5 个 P0 产品缺口） |
| **绑定 FR-ID** | FR-CHAT-001, FR-RUNTIME-001, FR-DESKTOP-001, FR-MOBILE-001, FR-WEB-001, FR-UI-001 |
| **对应计划** | Ralph 审计 session（analyze→verify→governance）；只审计不修复 |
| **当前状态** | ✅ 审计完成（2026-05-31）：11 findings（P0×5 / P1×4 / P2×2，新发现 7 项）。核心结论——「Agent 真正执行/编排闭环」在三个从未审计的面仍未达成：原生 Mobile App(RN) 聊天为 `setTimeout` 回显（PRGA-001）、Desktop 本地会话输入只 `addActivity` echo + 控制按钮无 `onClick`（PRGA-002/003）、Web 编排 UI `PlanCard`/`ActionCard` 僵尸组件零引用（PRGA-004）；Web Artifact 面板恒空态建议升 P0（PRGA-005）；E2E 门禁 mock 假绿（PRGA-007/008/009/010）。已登记 REG-20260531-010(P0)/011(P1)。**⚠️ 真实用户态截图 DEFERRED**：CLI 环境未拉起 dev server/Electron/RN Metro，P0 代码级证据已逐文件核验但未采集 GUI 截图。 |
| **目标** | 从真实用户目标判断假交互/占位/未闭环，不把按钮可见/状态变化/HTTP 200/落库当完成；只输出审计产物 |
| **验收方式** | 每条 finding 含七要素（功能名/用户预期/实际行为/代码位置/fake 原因/P0-P1-P2/建议任务+测试断言）；P0 代码位置主进程 Read 核验；区分新发现 vs 既有账本 |
| **测试证据** | `research/execution-reports/product-reality-gap-audit-001-report.md` + `product-reality-gap-audit-001-findings.json`（11 findings）+ `e2e/tests/web/product-reality-gap-audit.spec.ts`（只读结构锚点，固化修复前基线） |
| **阻塞问题** | 真实浏览器/GUI/RN UAT 截图未采集（BLOCKED：审计环境无 dev server/Electron/Metro），标记 DEFERRED，建议后续在可运行环境补齐 |
| **下一步动作** | 按 P0/P1/P2 推进修复任务：`MOBILE-RN-CHAT-RUNTIME-001`、`DESKTOP-SESSION-RUNTIME-001`、`DESKTOP-SESSION-CONTROLS-001`、`WEB-ORCHESTRATOR-UI-001`（P0）；`ARTIFACT-PANEL-DATA-001` 升 P0；`RUNTIME-REAL-EXECUTOR-E2E-001`、`TEST-ARTIFACT-REAL-DATA-001`、`TEST-MESSAGING-REAL-CHAT-001`、`TEST-P0-FLOW-REAL-ASSERT-001`（P1）；`TEST-WORKSPACE-REAL-CRUD-001`、`WEB-LEGACY-CLEANUP-001`（P2） |

### DESKTOP-SESSION-RUNTIME-001: Desktop 本地 Agent 会话接真实 runtime（修 PRGA-002/003）

| 字段 | 内容 |
|------|------|
| **优先级** | P0（关闭 REG-20260531-010 的 PRGA-002/003） |
| **绑定 FR-ID** | FR-DESKTOP-001, FR-RUNTIME-001 |
| **对应计划** | Ralph session `ralph-20260531-051020`（analyze→plan→execute→verify→review→goal-audit→milestone-complete） |
| **当前状态** | ✅ 完成（2026-05-31）：Desktop 本地会话从假交互改为真实本地 runtime 执行。`apps/desktop/src/main/index.ts` `setupRuntime()` 激活原死代码 `registerRuntimeIPC()`（`runtime:execute`→`LocalRuntimeAdapter` 真实 `child_process.exec`）；`preload/index.ts` 经 contextBridge 暴露 `runtime.execute/available`；`renderer/utils/electron-api.ts` 补 `RuntimeExecResult` 类型；`DesktopAgentSession.tsx` `handleSend` 改 async 调真实 IPC，按 `exitCode`/catch 写 `success`/`failed` + stdout/stderr 摘要 + reason，**无 runtime → 明确 failed 错误态**，删除硬编码 `status:'success'` echo。诊断/继续/重试/停止 改 `disabled` + `title=能力未实现（需远程流式 runtime，见 P1-RT）`——非可点无效果死按钮（一次性 exec 无流式 control 语义，远程链路归 P1-RT，故诚实禁用并标原因，不伪造）。 |
| **目标** | 让 Desktop 用户输入指令体验真实业务执行（真实 stdout/stderr/status），失败显式错误态不硬编码 success；控制按钮接真实语义或禁用+原因 |
| **验收方式** | renderer-level 测试断言：输入后 `runtime.execute` 被调用且活动状态来自真实返回；无 runtime 断言明确错误态；四控制按钮非死按钮（disabled+原因 title）。非 `toBeVisible` 糊弄 |
| **测试证据** | `apps/desktop/__tests__/desktop-agent-session.test.tsx` **4 passed**（golden path runtime.execute 调用+真实 stdout/exitCode 驱动成功态 / exitCode≠0 失败错误态 / 无 runtime 失败错误态 / 诊断·继续·重试·停止 disabled+title 原因）；`pnpm type-check` exit 0；`pnpm build` vite 1617 modules + tsc main 通过。审计锚点 `e2e/tests/web/product-reality-gap-audit.spec.ts` PRGA-002/003 已反转为修复后事实 |
| **阻塞问题** | 真实 Electron GUI 用户态截图 DEFERRED（CLI 环境无 GUI/显示），与 REG-20260531-010 一致；renderer 行为已由 jsdom 测试覆盖 |
| **下一步动作** | 关闭 REG-20260531-010 的 PRGA-002/003；剩余 PRGA-001（Mobile RN）+ PRGA-004（Web 编排 UI）仍 open，待后续 P0 任务 |

### MOBILE-RN-CHAT-RUNTIME-001: 原生 Mobile RN 聊天接真实 runtime（修 PRGA-001）

| 字段 | 内容 |
|------|------|
| **优先级** | P0（部分关闭 REG-20260531-010 的 PRGA-001） |
| **绑定 FR-ID** | FR-MOBILE-001, FR-CHAT-001, FR-RUNTIME-001 |
| **对应计划** | Ralph session `ralph-20260531-053429`（analyze→plan→execute→verify→review→goal-audit→milestone-complete） |
| **当前状态** | ✅ 完成（2026-05-31）：原生 `apps/mobile` ChatScreen 从 `setTimeout` 回显假交互改为真实 `/api/chat` runtime 链路。删除 `setTimeout` 回显 + 硬编码 `session_id='mobile-sess-1'` + `[Agent] 收到:` echo。新增 `src/lib/config.ts`（`getRuntimeConfig` 读 `EXPO_PUBLIC_API_BASE_URL`/`EXPO_PUBLIC_SESSION_ID`/`EXPO_PUBLIC_AUTH_TOKEN`，任一缺失 → `configured=false` + `missing[]`）；新增 `src/lib/chatClient.ts`（`sendChat` 用 `XMLHttpRequest`（RN 无 `res.body.getReader`）POST `{base}/api/chat`，`Authorization: Bearer`，增量解析 SSE `RuntimeGatewayEvent`，累积 `runtime_output.delta` 为单条 agent 回复，终端态 `endpoint_unavailable/local_runtime_offline/tunnel_disconnected/runtime_failed` 映射中文通知，HTTP 非 2xx → `onError`，**无任何本地回显**）。`ChatScreen.tsx`：`configured=false` → 禁用发送 + 输入框 + 中文配置/登录引导错误态（列出缺失 env 键），不展示假聊天；`configured=true` → `handleSend` 调 `sendChat` 流式渲染 agent 回复、system 通知、error 错误态，发送中禁用输入/按钮，会话内真实消息保留。 |
| **目标** | 原生 Mobile 聊天发送走真实后端 runtime，收 SSE 输出展示 agent 回复；无 auth/session/runtime 时禁用发送 + 明确配置/登录提示，绝不假成功 |
| **验收方式** | RN 逻辑层可运行测试（vitest，避免引入重型 RN 渲染栈）：发送不再产生本地 echo（onDelta 仅来自真实 runtime_output + 断言 POST 真实 sessionId 非硬编码）；成功路径累积真实 delta 为单条回复；失败路径 HTTP 非 2xx → onError 中文 + runtime_failed → 中文通知，reply 不伪造。非仅存在性/`toBeVisible` 断言 |
| **测试证据** | `apps/mobile/src/lib/__tests__/chatClient.test.ts` **5 passed**（① onDelta 只来自 runtime_output 非输入回显 + 断言 send POST `sessionId:'sess-real'`/`content` / ② deltas 累积为 `'Hello World'` 单条 reply、零通知 / ③ HTTP 503 → onError 中文错误、reply='' / ③b runtime_failed → 中文通知、reply='' / config 缺 env → configured=false）；`pnpm --filter @agenthub/shared build` ESM+DTS success；ChatScreen `grep setTimeout\|mobile-sess-1\|收到:` → CLEAN。审计锚点 PRGA-001 应反转为修复后事实 |
| **阻塞问题** | 真实设备/模拟器 GUI 截图 DEFERRED（CLI 环境无 Metro/GUI），与 REG-20260531-010 一致；逻辑层链路已由 vitest 覆盖。跨端真实消息持久拉取（GET /api/messages）out-of-scope（同一 auth 缺口限制） |
| **下一步动作** | 部分关闭 REG-20260531-010 的 PRGA-001（partial close）；剩余 PRGA-004（Web 编排 UI）仍 open，待 `WEB-ORCHESTRATOR-UI-001`（P0） |


### WEB-ORCHESTRATOR-UI-001: Web 编排 UI 接真实 plans/actions/审批（修 PRGA-004）

| 字段 | 内容 |
|------|------|
| **优先级** | P0（关闭 REG-20260531-010 的 PRGA-004，全账本随之关闭） |
| **绑定 FR-ID** | FR-UI-001, FR-RUNTIME-001, FR-CHAT-001 |
| **对应计划** | Ralph session `ralph-20260531-060031`（analyze→plan→execute→verify→review→goal-audit→milestone-complete） |
| **当前状态** | ✅ 完成（2026-05-31）：Web workspace 从「编排 UI 未上线 + PlanCard/ActionCard 全仓零引用僵尸」改为真实编排面板。新增 `apps/web/components/orchestrator/OrchestratorPanel.tsx`（`'use client'` 读 `useSessionStore().activeSessionId`，`useEffect` 并行 `fetch` 真实 `GET /api/plans?session_id`+`GET /api/actions?session_id`，渲染 `PlanCard`(onConfirm→`POST /api/plans/:id/confirm`)+`ActionCard`(onApprove→`POST /api/actions/:id/approve {approved}`)，成功后 re-fetch 刷新；未选会话/空数据/error 显式 `StateCard` 空态，**无 mock/硬编码**）；`apps/web/components/workspace/ArtifactPanel.tsx` TABS 增「编排」并渲染 `<OrchestratorPanel />`，消除 PlanCard/ActionCard 零引用僵尸。 |
| **目标** | Web workspace 中接入真实 orchestrator 面板，展示当前 session 的 plans/actions；高风险 action 展示 ActionCard 可审批/拒绝调真实 API；计划节点状态可见；数据来自真实 API/DB 不允许 mock；空态显式说明无计划/动作非假功能 |
| **验收方式** | E2E 真实链路深度断言：真实 API 播种 plan+high-risk action → 打开 workspace 切编排 tab → 断言卡片标题/节点/命令/风险文案/批准按钮（非仅 `toBeVisible`）→ 点批准断言真实 `POST /api/actions/:id/approve` 发出且 ok → GET 重新读取断言 `status=approved` 持久 |
| **测试证据** | `e2e/tests/web/web-orchestrator-ui.spec.ts`（new，`npx playwright test web-orchestrator-ui --list` → Total: 1 test，valid）含播种+卡片深度断言+真实 approve POST `waitForResponse`+状态持久 GET 断言；`pnpm --filter @agenthub/web type-check` exit 0；`pnpm --filter @agenthub/web build` success（`/workspace/[id]` 7.18 kB）；`grep PlanCard\|ActionCard`（排除定义文件）→ 仅 `OrchestratorPanel.tsx` 引用（僵尸消除）；反模式扫描 clean（未见 mock/硬编码/占位） |
| **阻塞问题** | E2E 运行需真实 Supabase DB session（`TEST_AUTH_COOKIE`+`TEST_SESSION_ID`+`TEST_WORKSPACE_ID`），CI 无真实 DB → `test.skip` 标 DEFERRED（与 REG-20260531-010 GUI/DB DEFERRED 一致），断言骨架保留不糊弄；真实浏览器用户态截图 DEFERRED（CLI 环境无 GUI） |
| **下一步动作** | 关闭 REG-20260531-010 的 PRGA-004 → 全账本（PRGA-001/002/003/004）关闭；遗留 E2E 门禁缺陷见 REG-20260531-011（P1，独立任务） |

### ARTIFACT-PANEL-DATA-001: Web ArtifactPanel 三 Tab 接真实数据（修 PRGA-005 / REG-20260530-007）

| 字段 | 内容 |
|------|------|
| **优先级** | P1（关闭 REG-20260530-007 / PRGA-005） |
| **绑定 FR-ID** | FR-WEB-001, FR-UI-001 |
| **对应计划** | Ralph session `ralph-20260531-063611`（analyze→plan→execute→verify→review→goal-audit→milestone-complete） |
| **当前状态** | ✅ 完成（2026-06-02 复核）：当前右栏为「角色 / 文件 / 变更 / 产物」。角色 Tab 读真实 `GET /api/role-agents?workspace_id`，文件/变更 Tab 接 workspace 文件/Git API，产物 Tab 读 durable `/api/artifacts`；不再从 `messages.metadata` 或 `message_type=result_card` 假装产物。旧「上下文/Agents/消息派生产物」测试口径已同步修正。 |
| **目标** | Web workspace 右栏展示真实角色、文件、Git 变更和 durable artifact；空态为数据确实为空非假功能。 |
| **验收方式** | 真实数据 E2E：真实 API 播种 role agent/session → 打开 workspace → 切「角色」Tab 断言真实角色并交叉校验 GET API；文件上传/预览/diff/保存为产物通过 `workbench-file-ops.spec.ts` 与 acceptance UAT 覆盖。 |
| **测试证据** | `pnpm test:e2e:acceptance` PASS（18 passed，含 `artifact.spec.ts` 角色/产物空态、`workspace-local-desktop-uat.spec.ts` 附件上传和 Agents CRUD、布局断言）；`pnpm --filter @agenthub/web type-check` PASS；`pnpm --filter @agenthub/web build` PASS。 |
| **阻塞问题** | E2E 实跑需真实 Supabase DB（`TEST_AUTH_COOKIE`+`TEST_WORKSPACE_ID`），CI 无真实 DB → `test.skip` 标 DEFERRED 保留断言骨架（与 REG-20260531-010 GUI/DB DEFERRED 一致）；真实浏览器截图 DEFERRED（CLI 环境无 GUI） |
| **下一步动作** | 关闭 REG-20260530-007 / PRGA-005；遗留 E2E 门禁缺陷（`artifact.spec.ts` 等假数据）见 REG-20260531-011（P1，独立任务） |


### TEST-REALITY-GATE-001: E2E 门禁去 mock 接真实主链路（修 PRGA-007/008/009/010 / REG-20260531-011）

| 字段 | 内容 |
|------|------|
| **优先级** | P1（关闭 REG-20260531-011 / PRGA-007/008/009/010） |
| **绑定 FR-ID** | FR-WEB-001, FR-UI-001 |
| **当前状态** | ✅ 完成（2026-06-02 复验）：四个「假绿」mock spec 已改真实栈集成测试，并同步到当前 UI。`artifact.spec.ts` 走真实 workspace/role-agents/session，断言「角色」Tab 与 durable artifact 空态；`messaging.spec.ts` 与 `p0-main-flow.spec.ts` 走真实 `@Orchestrator` → `/api/chat` → 明确回复/错误态 → reload 持久化；`workspace.spec.ts` 用创建返回 id 和 `workspace-card-<id>` 自作用域断言，避免共享用户列表污染。 |
| **目标** | 核心功能 spec 不得用 mock/`toBeVisible` 假绿；主链路走真实 API/DB/auth/runtime 并断言用户目标终态；环境缺失只能显式 `test.skip` 标 DEFERRED 不能 silent pass |
| **验收方式** | 真实栈实跑：`pnpm test:e2e:acceptance` 固定 serial worker，使用 `docker/.acceptance.env` Auth.js DB session；worker 与 no-worker 专项分别用 `pnpm test:e2e:acceptance:runtime` / `pnpm test:e2e:acceptance:no-worker`。 |
| **测试证据** | `pnpm test:e2e:acceptance` PASS（18 passed）；`pnpm test:e2e:acceptance:runtime` PASS（2 passed）；`pnpm test:e2e:acceptance:no-worker` PASS（1 passed）；主链路 spec 无 `page.route` mock，真实 API/DB/session/runtime 入口均被调用。 |
| **阻塞问题** | 已解除：旧 UI 文案、旧角色名、共享用户多 worker 污染、worker/no-worker 混跑导致的假失败。 |
| **下一步动作** | 已关闭；后续新增 DB 变更型 E2E 必须纳入 acceptance 串行 profile 或提供 per-test 用户隔离。 |


### UI-ALIGN-001: 三端 UI 参考项目对齐修复

| 字段 | 内容 |
|------|------|
| **优先级** | P0 |
| **绑定 FR-ID** | FR-UI-001, FR-DESK-001, FR-WEB-001, FR-MOB-001 |
| **对应计划** | impeccable improve chain: critique → refine → polish → audit |
| **当前状态** | ✅ 完成（2026-05-29）：critique → refine → polish → audit 全链完成；audit 评分 15/20 PASS；type-check 通过；P0 数据链路未受影响 |
| **目标** | 三端视觉母版统一，对齐 AionUi/codeg 参考项目的信息密度和组件规范 |
| **方案摘要** | Desktop 侧栏加 lucide 图标；Web Composer 加工具条；Mobile 统一色彩 token；消除营销文案；三端语义色 token 统一；交互闭环（workspace 切换、发送状态、空态描述） |
| **验收方式** | type-check 通过 + audit 评分 ≥15/20 PASS + P0 数据链路无回归 |
| **测试证据** | `tsc --noEmit` web/desktop 通过；audit 评分 15/20 PASS；commits: `beb9825`（三端视觉 token 统一）+ `1fe7b7d`（交互闭环 + 中文状态）；execution-report: `research/execution-reports/ui-align-001-report.md` |
| **阻塞问题** | P1 残留：a11y 对比度/焦点环/aria-label 缺失（非 P0 blocker）；Mobile React 版本兼容性（预存问题） |
| **下一步动作** | P1 a11y 修复（独立任务）；本任务闭环 |

### WEB-WORKSPACE-UX-001: Web Workspace 真实交互闭环回归

| 字段 | 内容 |
|------|------|
| **优先级** | P0 regression（阻塞继续扩大 Web 工作台功能面） |
| **绑定 FR-ID** | FR-WEB-001, FR-WS-001, FR-CHAT-001, FR-UI-001 |
| **来源** | 用户验真样本（2026-05-30）：登录后访问 `/workspace/:id`，页面视觉存在但感觉无法点击/无法测试功能 |
| **当前状态** | ✅ Web 主链路达成（2026-05-30 `ROLE-CHAT-RUNTIME-DELIVER-001`/commit `eed577f`）：URL workspace 选中 / Sidebar 不覆盖 / setActiveSession 拉消息 / `sendMessage→/api/chat` / “新建会话” onClick 等交互闭环已接通（web tsc EXIT=0，Playwright E2E 2 passed），且真实用户默认入口下 @架构师/Agent 发送后可见非空回复（有 worker）或立即明确中文错误态（无 worker，<2s）。REG-20260530-006 **Web GAP-001 关闭条件已满足**。 |
| **缺陷台账** | `research/regression-ledger.md#reg-20260530-001--web-workspace-真实交互闭环缺口`（已关闭）；阻塞项 `research/regression-ledger.md#reg-20260530-006`（P0，真实用户态无可见回复，open） |
| **问题摘要** | `/workspace/[id]` 未读取 URL workspace id；Sidebar 默认选第一个 workspace；“新建会话”按钮无 `onClick`；点击 session 只设置 id、不拉取 messages；发送消息只写 `/api/messages`，未走 `/api/chat` runtime/agent 链路 |
| **验收方式** | 使用 Auth.js 测试登录态（`TEST_AUTH_STORAGE_STATE` 或 `TEST_AUTH_COOKIE`），真实浏览器验证：直接打开 `/workspace/:id` → 当前 workspace 被选中 → 新建 session 落库并选中 → 点击 session 拉取消息 → 发送消息走 `/api/chat` 并展示 runtime/agent 状态或明确错误态 → reload 后 session/message 持久化 |
| **测试证据** | `e2e/tests/web/web-workspace-ux.spec.ts` 2 passed（web-desktop + web-tablet，真实 DB，断言 `GET /workspace/:id` → `GET /api/sessions?workspace_id=` → `GET /api/messages?session_id=` → `POST /api/chat 200` + 视觉/布局断言 + reload 持久化）；verification.json verdict=PASS（G1/G2 全 VERIFIED），review.json verdict=PASS（blocking_count=0）。⚠️ 复审反证：`research/execution-reports/product-uat-gap-audit-001-browser-findings.json`（默认入口 `saw_real_agent_reply:false`） |
| **阻塞问题** | **REG-20260530-006（P0 blocker）**：真实用户默认入口下 @架构师/Agent 无可见回复——Web GAP-001 已由 `ROLE-CHAT-RUNTIME-DELIVER-001`(commit `eed577f`) 解除；REG-20260530-002（既有 web E2E 共享单用户并行 worker 数据污染，P1）单列 test-infra 任务处理 |
| **下一步动作** | Web GAP-001 已修复（`ROLE-CHAT-RUNTIME-DELIVER-001`），REG-20260530-006 Web 路径关闭条件已满足，可转入 regression-ledger 关闭记录 |

### AUTH-MIG-001: 认证路线迁移 Auth.js → Auth.js v5

| 字段 | 内容 |
|------|------|
| **优先级** | P0 |
| **绑定 FR-ID** | FR-AUTH-001 |
| **对应计划** | Maestro plan: `PLN-auth-migration`（7 tasks, 3 waves） |
| **Plan 路径** | `.workflow/scratch/20260527-plan-auth-migration/plan.json` |
| **Ralph Session** | `ralph-20260527-100000`（status: completed） |
| **当前状态** | ✅ 全部完成（2026-05-27）：Wave 1-3 执行完毕，verify PASS，review PASS |
| **目标** | 消除本地开发/E2E/Demo 对 Auth.js 控制台的强依赖 |
| **方案摘要** | Auth.js v5 + GitHub OAuth Provider + Drizzle adapter + Database session；DB 层暂保留 Postgres |
| **Wave 分解** | W1: 文档修订 + Auth.js 基础设施 → W2: 认证层替换 → W3: 设备绑定迁移 + E2E 验证 |
| **验收方式** | `npm run dev` 无需 Auth.js 环境变量 + E2E auth 测试通过 + Demo 路径不退化 |
| **测试证据** | `tsc --noEmit` exit 0；`vitest run __tests__/` 85 tests pass；`rg 'auth.js session\|external auth SDK' apps/web/` 无匹配；verification.json verdict=PASS (20/20) |
| **阻塞问题** | 无 |
| **下一步动作** | 迁移闭环，无后续动作 |

### GOV-GATE-001: Maestro/Ralph 完成前治理门禁

| 字段 | 内容 |
|------|------|
| **优先级** | P0 |
| **绑定 FR-ID** | FR-UI-001, FR-AUTH-001, 全部实现类任务 |
| **对应计划** | Codex 治理基础设施补强 |
| **当前状态** | ✅ 完成（2026-05-27）：治理门禁脚本、兼容别名、执行 Prompt 与索引接入已落地 |
| **目标** | 防止 Maestro/Ralph 仅凭 `status.json completed` 假完成，强制公开跟进、测试证据和中文 commit 闭环 |
| **方案摘要** | 增强 `scripts/verify-governance-gate.sh`，新增 `scripts/check-governance-gate.sh` 兼容别名，新增 `research/workflow/maestro-execution-governance.md`，并接入 Maestro spec injection |
| **验收方式** | Shell 语法检查通过 + Maestro spec injection 已包含治理 Prompt + 真实门禁运行能识别当前未提交改动 |
| **测试证据** | `bash -n scripts/verify-governance-gate.sh` exit 0；`bash -n scripts/check-governance-gate.sh` exit 0；`maestro spec injection always` 已注入治理 Prompt；当前存在未提交业务/UI 改动时门禁应失败 |
| **阻塞问题** | 当前工作区存在既有 UI/业务改动，不由本治理任务回滚或提交 |
| **下一步动作** | 后续 Maestro 每个 wave 完成后运行 `bash scripts/verify-governance-gate.sh <TASK-ID>`；失败不得 complete |

### P0-ACCEPT-001: P0 功能验收 — Desktop 主入口点击语义修复

| 字段 | 内容 |
|------|------|
| **优先级** | P0 |
| **绑定 FR-ID** | FR-DESK-001, FR-MOB-001 |
| **对应计划** | Maestro plan: `PLN-p0-acceptance`（7 tasks, 3 waves） |
| **Plan 路径** | `.workflow/scratch/20260527-plan-p0-acceptance/plan.json` |
| **Ralph Session** | `ralph-20260527-143500`（status: completed） |
| **当前状态** | ✅ 全部完成（2026-05-27）：Wave 1-3 执行完毕，verify PASS，review PASS，UAT 19 tests |
| **目标** | 修复 Desktop 所有 broken 入口点击语义（GitHub 登录、打开工作台、Agent 选择、Composer） |
| **方案摘要** | W1: 抽取 useDesktopAuth + useOpenWebWorkspace hooks → W2: 绑定 Sidebar/Settings/StatusBar/AgentConfig/AgentSession → W3: Mobile 离线提示 + E2E 测试 |
| **验收方式** | type-check 通过 + convergence criteria 7/7 + Playwright E2E 19 tests 可编译 |
| **测试证据** | `tsc --noEmit` desktop/web 通过；verification.json passed=true (7/7)；`playwright test --list` 19 tests；review.json verdict=PASS |
| **阻塞问题** | 无 |
| **下一步动作** | 闭环，无后续动作 |

---

### ROLE-CHAT-CORE-001: Web Workspace 角色对话核心链路

| 字段 | 内容 |
|------|------|
| **优先级** | P0 |
| **绑定 FR-ID** | FR-CHAT-001, FR-WEB-001, FR-RUNTIME-001, FR-PERM-001 |
| **对应计划** | `.workflow/scratch/20260530-plan-role-chat-core/plan.json`（standalone） |
| **Ralph Session** | `ralph-20260530-054910`（adhoc 里程碑 adhoc-role-chat-core） |
| **当前状态** | ✅ Web @架构师真实回复达成（2026-05-30 `ROLE-CHAT-RUNTIME-DELIVER-001`/commit `eed577f`）：role_agents CRUD + 默认架构师 seed + `/api/chat` 角色归属校验 + system_prompt 注入 + roleAgentId/mentions 持久化 + @角色选择 UI + reload 保留角色上下文 等技术切片已落地，且真实用户默认入口下 @架构师发送后可见非空 agent 回复（有真实 worker，非 FakeExecutor）或立即明确中文错误态（无 worker）。REG-20260530-006 **Web GAP-001 关闭条件已满足**。 |
| **目标** | Web 端实现角色对话核心链路：创建/选择角色 → @角色发送 → 角色上下文注入 runtime → 消息与角色绑定持久化 → reload 保留 |
| **方案摘要** | `/api/chat` 校验 role_agents 归属并加载 system_prompt 透传 adapter→gateway→job→worker→executor；messages 持久化 role_agent_id + mentions；runtime_sessions 持久化 role_agent_id（additive nullable 列）；Web store/UI 接入 @角色选择 + 会话创建 |
| **验收方式** | type-check 通过 + verification.json passed=true（T1-T8 全 VERIFIED）+ review verdict≠BLOCK + auto-test report 全绿 + Playwright E2E reload 角色上下文断言 |
| **测试证据** | type-check 干净；verification.json passed=true（T1-T8）；review.json verdict=WARN（0 critical/0 high，3 medium/2 low 非阻塞）；`apps/web/.tests/auto-test/report.json` 5/5 PASS；E2E `npx playwright test tests/web/role-chat-core.spec.ts --project=web-desktop` 1 passed（7.9s，真实 DB、未使用 mock）；UAT `.workflow/scratch/20260530-plan-role-chat-core/uat.md`；报告 `research/execution-reports/role-chat-core-report.md` |
| **阻塞问题** | **REG-20260530-006（P0 blocker）**：真实用户默认入口（`pnpm dev:web`/`dev:full`，无 worker）下 @架构师/Agent 0 可见回复——`gateway.ts` 仅以 `REDIS_URL` gating、`unconfigured` 状态从不 gating、无 worker 时空等 idle 超时；`runtime-worker.ts` 默认 FakeExecutor。**Web GAP-001 已由 `ROLE-CHAT-RUNTIME-DELIVER-001`(commit `eed577f`) 关闭**：gateway 改用 endpoint status/id + 活跃 worker 在线键门控、无 worker/unconfigured 立即短路明确中文错误态。残留：review WARN 3 medium（insert error 未检查、runtime_sessions 空 id 吞错、客户端未处理错误终态事件）+ 2 low，记入 P1 跟进。 |
| **下一步动作** | ✅ Web GAP-001 已解除（`ROLE-CHAT-RUNTIME-DELIVER-001`）：默认入口下有真实 worker → 可见非空带角色回复并落 `messages`；无 worker → gateway 立即短路明确中文错误态（<2s）；可见回复断言改为不可默认跳过的常驻门禁。review WARN 3 medium 纳入 P1-RT。 |

---

### ROLE-CHAT-UAT-REPLY-001: Web 角色对话可见 agent 回复闭环 + UI 可用性 UAT

| 字段 | 内容 |
|------|------|
| **优先级** | P0（关闭 ROLE-CHAT-CORE-001 deferred 的可见 agent 回复缺口） |
| **绑定 FR-ID** | FR-CHAT-001, FR-WEB-001, FR-RUNTIME-001, FR-UI-001 |
| **对应计划** | `.workflow/scratch/20260530-plan-role-chat-uat-reply/plan.json`（standalone） |
| **Ralph Session** | `ralph-20260530-190032`（adhoc 里程碑 M-adhoc-20260530-role-chat-uat-reply） |
| **当前状态** | ✅ 已完成（2026-05-30，验证通过）：`/api/chat` 仅在 `runtime_completed && reply` 非空时以 `sender_type=agent` 落库（no-fake-success）；客户端渲染 runtime 终态提示；E2E 拉起 Redis+worker(FakeExecutor) 端到端验证可见回复 + role badge + reload 双向持久化 |
| **来源** | 用户验真样本（2026-05-30）：localhost:3000 @架构师发送后只见用户消息、无可见 agent 回复 |
| **问题摘要** | ROLE-CHAT-CORE-001 在 P0 harness（无 Redis/worker）将可见回复+角色 Badge 断言 deferred；且 `/api/chat` 未持久化 agent 回复，reload 即丢失 |
| **验收方式** | 真实浏览器 UAT（`RUNTIME_E2E=1` 拉起 Redis+worker）：open `/workspace/:id` → 新建 session → @架构师 → 发送 → 等到可见 agent 回复文本 + role badge → 视觉/布局断言 → reload 后用户+agent 消息都保留 |
| **测试证据** | `cd e2e && RUNTIME_E2E=1 npx playwright test --project=web-desktop web/role-chat-uat-reply.spec.ts web/web-workspace-ux.spec.ts web/role-chat-core.spec.ts` → 3 passed（真实 DB+Redis+worker，主链路零 mock，DB 校验 messages 同含 user+agent 行）；`npx vitest run __tests__/api/chat.test.ts` chat suite 6/6 PASS（含 AT-005/AT-006 no-fake-success）；verification.json verdict=PASS（5/5 VERIFIED）；review.json verdict=PASS（0 critical/0 high/0 medium/1 low）；报告 `research/execution-reports/role-chat-uat-reply-001-report.md` |
| **缺陷台账** | `research/regression-ledger.md`（ROLE-CHAT-CORE-001 agent 回复 deferred 重定级 P0 后关闭，见关闭记录） |
| **阻塞问题** | 无。非阻塞观察：dev harness 首次冷启动偶发 30s badge 超时（Next.js 按需编译 + worker 轮询），预热后连续全绿。 |
| **下一步动作** | 闭环，无后续动作 |

---

### ROLE-CHAT-RUNTIME-DELIVER-001: Web Agent 回复在真实用户默认入口可达

| 字段 | 内容 |
|------|------|
| **优先级** | P0 blocker |
| **绑定 FR-ID** | FR-CHAT-001, FR-WEB-001, FR-RUNTIME-001, FR-UI-001 |
| **来源** | PRODUCT-UAT-GAP-AUDIT-001（REG-20260530-006 GAP-001） |
| **当前状态** | ✅ 已完成（2026-05-30，commit `eed577f`）：gateway public_cloud 改用 `resolveEndpoint` status/id + 活跃 worker 在线键门控；无 worker/unconfigured 立即短路明确中文错误态（实测 <2s）；非回显 `ScriptedRealExecutor` 真实交付验证；两条默认不可跳过 E2E。verify passed=true（6 truths VERIFIED）/review PASS/UAT 2/2/milestone-audit PASS（0 gaps）。归档 `.workflow/milestones/adhoc-role-chat-runtime-deliver/` |
| **缺陷台账** | `research/regression-ledger.md#reg-20260530-006`（Web GAP-001 已关闭） |
| **目标** | 默认运行入口（无 `RUNTIME_E2E`）下，真实用户 @架构师/Agent 发送后能看到非空带角色回复，或无 worker 时立即明确中文错误态 |
| **方案摘要** | (a) `dev:full` 默认拉起 worker，或 gateway 在无 worker/`unconfigured` 时立即短路 `endpoint_unavailable`（不空等 60s idle）；(b) 用 `resolveEndpoint` 的 `status/id` 做真实 gating，删除仅以 `REDIS_URL` 判定的死代码；(c) 把 `role-chat-uat-reply` 可见回复断言改为默认入口可达的不可跳过常驻门禁（覆盖「无 worker → 立即明确错误态」「有真实 worker → 可见回复」两路），禁止 `RUNTIME_E2E` 默认 skip 掩盖主链路 |
| **验收方式** | 默认入口真实浏览器：有真实 worker → 可见非空带角色回复并落 `messages`；无 worker → 立即明确中文错误态（实测 <2s，非 60s 挂起）；可见回复 E2E 不可默认 skip |
| **阻塞问题** | 无（本任务即解除 REG-20260530-006 Web GAP-001） |
| **下一步动作** | 闭环，无后续动作（Mobile GAP-002 由 `MOBILE-CHAT-DELIVER-001` 跟进） |

### MOBILE-CHAT-DELIVER-001: Mobile 发送走统一 runtime 链路

| 字段 | 内容 |
|------|------|
| **优先级** | P0 blocker |
| **绑定 FR-ID** | FR-CHAT-001, FR-MOB-001, FR-RUNTIME-001 |
| **来源** | PRODUCT-UAT-GAP-AUDIT-001（REG-20260530-006 GAP-002） |
| **当前状态** | ✅ 完成（2026-05-31 `MOBILE-CHAT-DELIVER-001`，commit `3b8029f`）：Mobile `/m/sessions/:id` 发送从纯 `/api/messages` 写库改为走统一 `/api/chat` runtime SSE 链路（与 Web 一致），消费 `runtime_output` deltas 累积可见 agent 回复；解析 session→workspace→role-agents，默认架构师 orchestrator 角色上下文（发送按钮在 `defaultRole` 解析前门控，附 role badge）；runtime 终态事件映射明确中文系统提示，绝不静默仅存用户消息。附带修复 `apps/web/app/api/sessions/[id]/route.ts`（自研 postgres-query-client 不支持 `workspaces!inner` 嵌套 select，改为 plain select + 独立 owner_id 归属校验 403）。新增真实浏览器移动视口 E2E（iPhone 14 390×844，真实 DB + auth）：route 监听断言 `POST /api/chat` 被调用 + 有 worker→可见非 echo 回复+架构师 badge+reload 双向持久化 / 无 worker→立即明确中文错误态+reload 无误存 badge（非仅 `toBeVisible`）。verify passed=true（G1/G2/G3 VERIFIED）、review PASS（0 findings）、UAT 双 regime 各 1 passed、type-check exit 0。关闭 REG-20260530-006 **Mobile GAP-002**。 |
| **缺陷台账** | `research/regression-ledger.md#reg-20260530-006` |
| **目标** | Mobile `/m/sessions/:id` 发送闭环：与 Web 一致触发 runtime/Agent，或在轻量端明确「需在 Web 端继续」文案，消除「只写库、永无回复」假成功 |
| **方案摘要** | `apps/web/app/m/sessions/[sessionId]/page.tsx` `send()` 改走与 Web 一致的 `/api/chat` runtime 链路（合同 §3.1.8/§6 三端共享状态语义），并补 Mobile 发送后回复/错误态 E2E |
| **验收方式** | Mobile 真实浏览器：发送后出现 agent 回复或明确错误态；E2E 断言「发送后用户目标达成或明确错误态」 |
| **测试证据** | E2E `npx playwright test e2e/tests/mobile/mobile-chat-deliver.spec.ts --project=mobile-pwa`（真实 DB + auth）：`RUNTIME_E2E=1` 1 passed（有 worker→`POST /api/chat 200` + 可见非 echo 回复 + 架构师 badge + reload 双向持久化）+ `RUNTIME_E2E_NOWORKER=1` 1 passed（缺 worker→立即明确中文错误态 + reload 不误存 badge），route 监听断言 `/api/chat` 被调用，非仅 `toBeVisible`；verification-final.json passed=true（G1/G2/G3 VERIFIED，0 gaps）；review.json verdict=PASS（0 findings，5 维度 PASS）；UAT `.workflow/scratch/20260531-plan-mobile-chat-deliver-001/uat.md` 双 regime 4 场景全 PASS；`pnpm --filter @agenthub/web type-check` exit 0；commit `3b8029f` |
| **阻塞问题** | 无（已关闭） |
| **下一步动作** | 闭环，无后续动作（REG-20260530-006 整体 closed） |

---

## P1 任务

### COMPLETE-MULTI-AGENT-ORCHESTRATION-2026-06-02: 完整多 Agent 编排与交接

| 字段 | 内容 |
|------|------|
| **优先级** | P1 product-completion（基于已完成 P0 acceptance baseline 的最终产品能力计划） |
| **绑定 FR-ID** | FR-AGENT-001, FR-ORCH-001, FR-RUNTIME-001, FR-CTX-001, FR-ACTION-001, FR-WEB-001, FR-DESK-001, FR-MOB-001 |
| **对应计划** | `.trellis/tasks/06-02-complete-multi-agent-orchestration` |
| **合同路径** | `research/contracts/COMPLETE-MULTI-AGENT-ORCHESTRATION-2026-06-02.md` |
| **当前状态** | ✅ 完成（2026-06-03 最终补全）：Phase 1-5 canonical 产品链路已完成并验收。Phase 1-4 已落地 durable `plan_node_attempts` / `agent_mailbox_items`、plan node 控制 API、runtime inventory、mailbox ready/dispatch/reply/dead-letter、动态 DAG generator、wait-all fan-in、失败传播、runtime job attempt/mailbox 终态回写、native session 复用 scope `(session_id, role_agent_id, runtime_type, cwd)`、Web/Mobile/Desktop 监督控制面。Phase 5 真实 Claude+Codex 多角色 UAT 已通过并复跑：Web `/api/chat` 进入 Gateway/Redis/real worker，架构师/前端工程师使用 Claude Code，后端工程师使用 Codex，生成 planner/worker/summarizer DAG，后端 schema/API 节点先行、前端节点等待后端节点，plan/nodes/runtime_sessions/messages/handoff metadata 全部持久化完成。真实 `resume` recovery UAT 也已通过：plan-node resume 创建新 attempt/mailbox，`dispatch-ready` 投递真实 Codex CLI，resume runtime session 复用上一轮 Codex native session id，parent plan 恢复后重新 completed。2026-06-03 最终补齐首轮 durable mailbox 调度：`/api/chat` 首轮节点 attempt/mailbox 从 `queued` 开始，并通过共享 `dispatchPreparedRuntimeInvokeNode` runtime-node dispatcher 创建 runtime session、更新 attempt/mailbox/plan node、订阅后投递携带 `planNodeId` / `attemptId` / `mailboxItemId` 的 Runtime worker job；首轮 mailbox context 写入 received handoffs；Web OrchestratorPanel 读取 timeline API 并在 PlanCard 展示 role/runtime、attempt/mailbox/runtime session/native session/log count。P0 acceptance closure 仍只作为 canonical baseline；本任务完成结论以 Phase 5 真实 UAT、恢复 UAT、三端证据、2026-06-03 最终补全报告和治理门禁为准。 |
| **目标** | 在同一 AgentHub session 中完成多角色分工、上下文/session handoff、按角色 runtime 调度、等待/fan-out/fan-in、失败恢复、三端监督和刷新持久化。 |
| **验收方式** | 使用 `pnpm env:acceptance:up` / `pnpm dev:acceptance` 启动 canonical 环境；机器安装并登录 Claude Code 与 Codex；真实浏览器 UAT 覆盖 `前端工程师=Claude Code`、`后端工程师=Codex`、Orchestrator DAG、handoff、native session 复用、节点失败后 retry/resume、刷新持久化。 |
| **测试证据** | Phase 1 首切片：`pnpm --filter @agenthub/web test -- __tests__/api/plan-node-controls-inventory.test.ts __tests__/api/plans-actions-owner.test.ts __tests__/orchestrator/action-dispatcher.test.ts` PASS（3 files / 15 tests）；`pnpm --filter @agenthub/web type-check` PASS；`pnpm --filter @agenthub/web test -- __tests__/api/chat.test.ts __tests__/api/role-agents.test.ts __tests__/runtime/gateway-gating.test.ts __tests__/runtime/local-device-relay.test.ts __tests__/runtime/executor.test.ts __tests__/api/plans-actions-owner.test.ts __tests__/api/plan-node-controls-inventory.test.ts __tests__/orchestrator/action-dispatcher.test.ts` PASS（8 files / 64 tests）；`pnpm --filter @agenthub/shared test` PASS（4 files / 27 tests）；`pnpm --filter @agenthub/shared build` PASS。追加：`pnpm --filter @agenthub/shared test` PASS（5 files / 30 tests）；`pnpm --filter @agenthub/web test -- __tests__/api/role-agents.test.ts` PASS（1 file / 23 tests）；Web 相关回归 PASS（7 files / 58 tests）；`pnpm --filter @agenthub/web type-check && pnpm --filter @agenthub/shared type-check` PASS；`pnpm env:acceptance:up` PASS；`pnpm env:acceptance:smoke` PASS（CRUD 5/5，`/api/chat` 11/11）。Phase 1 第二切片：`pnpm --filter @agenthub/web test -- __tests__/api/mailbox-controls.test.ts` PASS（1 file / 6 tests）；`pnpm --filter @agenthub/web test -- __tests__/api/mailbox-controls.test.ts __tests__/api/plan-node-controls-inventory.test.ts` PASS（2 files / 12 tests）；`pnpm --filter @agenthub/web test -- __tests__/runtime/executor.test.ts __tests__/orchestrator/action-dispatcher.test.ts` PASS（2 files / 16 tests）；`pnpm --filter @agenthub/web type-check` PASS；`pnpm --filter @agenthub/shared type-check` PASS。Phase 2 scheduler kernel：`pnpm --filter @agenthub/web test -- __tests__/api/mailbox-controls.test.ts __tests__/orchestrator/action-dispatcher.test.ts` PASS（2 files / 9 tests）；`pnpm --filter @agenthub/web test -- __tests__/orchestrator.test.ts __tests__/runtime/executor.test.ts` PASS（2 files / 31 tests）；`pnpm --filter @agenthub/web test -- __tests__/api/mailbox-controls.test.ts __tests__/runtime/executor.test.ts __tests__/orchestrator.test.ts` PASS（3 files / 38 tests）；`pnpm --filter @agenthub/web test -- __tests__/api/mailbox-controls.test.ts __tests__/orchestrator/action-dispatcher.test.ts __tests__/api/plan-node-controls-inventory.test.ts __tests__/runtime/executor.test.ts __tests__/orchestrator.test.ts` PASS（5 files / 46 tests）；`pnpm --filter @agenthub/web type-check` PASS；`pnpm --filter @agenthub/shared type-check` PASS；`pnpm --filter @agenthub/web lint` PASS（仅既有 Next/ESLint 配置警告）。动态 DAG generator 切片：`pnpm --filter @agenthub/web test -- __tests__/orchestrator.test.ts __tests__/api/chat.test.ts` PASS（2 files / 27 tests）；`pnpm --filter @agenthub/web test -- __tests__/api/plan-node-controls-inventory.test.ts __tests__/api/mailbox-controls.test.ts __tests__/orchestrator/action-dispatcher.test.ts` PASS（3 files / 15 tests）；`pnpm --filter @agenthub/web type-check` PASS。Phase 3 durable recovery evidence 切片：`pnpm --filter @agenthub/web test -- __tests__/runtime/executor.test.ts __tests__/orchestrator/action-dispatcher.test.ts __tests__/api/mailbox-controls.test.ts __tests__/api/plan-node-controls-inventory.test.ts` PASS（4 files / 31 tests）；`pnpm --filter @agenthub/web test -- __tests__/runtime/gateway-session-reuse.test.ts __tests__/runtime/gateway-gating.test.ts __tests__/runtime/executor.test.ts __tests__/orchestrator/action-dispatcher.test.ts` PASS（4 files / 23 tests）；`pnpm --filter @agenthub/web test -- __tests__/api/plan-node-controls-inventory.test.ts __tests__/runtime/gateway-session-reuse.test.ts __tests__/runtime/executor.test.ts __tests__/orchestrator/action-dispatcher.test.ts` PASS（4 files / 27 tests）；`pnpm --filter @agenthub/web type-check` PASS。Phase 4 Web/Mobile 控制面切片：`pnpm --filter @agenthub/web type-check` PASS；`pnpm --filter @agenthub/web test -- __tests__/api/plan-node-controls-inventory.test.ts __tests__/runtime/gateway-session-reuse.test.ts __tests__/runtime/executor.test.ts __tests__/orchestrator/action-dispatcher.test.ts` PASS（4 files / 27 tests）。Desktop 监督面切片：`pnpm --filter @agenthub/desktop test -- desktop-agent-session.test.tsx desktop-runtime-supervision.test.tsx --run` PASS（2 files / 11 tests）；`pnpm --filter @agenthub/desktop test -- --run` PASS（6 files / 29 tests）；`pnpm --filter @agenthub/desktop type-check` PASS；`pnpm type-check` PASS。2026-06-02 Docker 恢复后 acceptance 复验：`pnpm env:acceptance:up` PASS；`set -a; source docker/.acceptance.env; set +a; REDIS_URL=${REDIS_URL:-redis://localhost:6379} pnpm --filter @agenthub/web exec tsx scripts/verify-p1-rt-phase3.ts` PASS（22 passed, 0 failed, 0 skipped，含 recovery evidence）；`pnpm env:acceptance:smoke` PASS（CRUD 5/5，`/api/chat` 11/11）；`pnpm type-check` PASS。smoke 期间修复了负例夹具：当前 acceptance 用户已有真实 Desktop runtime ready，`verify-acceptance-chat-api.ts` 改用隔离未绑定 Desktop 的用户验证 local_desktop 409，不削弱产品 gate。Phase 5 真实 Claude+Codex 多角色 UAT：`set -a; source docker/.acceptance.env; set +a; REDIS_URL=${REDIS_URL:-redis://localhost:6379} RUNTIME_HEARTBEAT_EVENT_INTERVAL_MS=15000 pnpm --filter @agenthub/web exec tsx scripts/verify-complete-multi-agent-phase5.ts` PASS；最新证据 workspace `bd4aea0e-9eba-4bf2-8364-0a997cf6b7f6`、session `deb4f767-78ce-40b6-8802-705b255b9f88`、plan `bb96a775-1946-4559-a4da-6f240d0c954f`、runtime sessions `e294a9aa-7324-4582-adbd-449ab8c40105` / `9d4c2366-16ab-4b6c-bc64-7bcba8159ca1` / `a6856328-3c64-4e45-a1a6-1ad6ff498897` / `d6ff5bce-2451-49da-b1f5-458ee8e6d354`；验证 fake/script 未使用、SSE 未出现 `endpoint_unavailable` 或 `runtime_failed`、后端节点 Codex、前端节点 Claude Code、所有 plan_nodes/runtime_sessions completed、handoffsReceived/roleHandoffs 持久化。Phase 5 recovery UAT：`set -a; source docker/.acceptance.env; set +a; REDIS_URL=${REDIS_URL:-redis://localhost:6379} RUNTIME_HEARTBEAT_EVENT_INTERVAL_MS=15000 PHASE5_SESSION_ID=deb4f767-78ce-40b6-8802-705b255b9f88 pnpm --filter @agenthub/web exec tsx scripts/verify-complete-multi-agent-recovery.ts` PASS；证据 node `10d56ae4-e70b-4eb9-8e86-f1fa586636f9`、resume attempt `78ae3acf-34ac-4097-9d67-5afeae4a0c2f`、resume runtime session `8faab6bd-5ce1-4f23-8f70-6895483fc750`，复用 Codex native session `019e8935-5c8f-7e13-a931-e5fe7b17b706`，parent plan 恢复后重新 completed。三端截图证据：`e2e/artifacts/complete-multi-agent-phase5/web-phase5-plan.png`、`e2e/artifacts/complete-multi-agent-phase5/mobile-phase5-plan.png`、`e2e/artifacts/complete-multi-agent-phase5/desktop-runtime-supervision.png`。2026-06-03 最终补全：`pnpm --filter @agenthub/web test -- __tests__/api/chat.test.ts __tests__/api/plan-node-controls-inventory.test.ts __tests__/runtime/executor.test.ts --run` PASS（3 files / 38 tests）；`pnpm --filter @agenthub/shared test -- --run` PASS（5 files / 31 tests）；`pnpm --filter @agenthub/web type-check` PASS。最终补全报告：`research/execution-reports/complete-multi-agent-orchestration-finalization-2026-06-03.md`。既有报告：`research/execution-reports/complete-multi-agent-orchestration-phase1-data-kernel-2026-06-02.md`、`research/execution-reports/complete-multi-agent-orchestration-phase2-scheduler-kernel-2026-06-02.md`、`research/execution-reports/complete-multi-agent-orchestration-phase5-real-uat-2026-06-02.md`。 |
| **阻塞问题** | 无方案 blocker。refer_proj 已覆盖可提炼抽象：Maestro 角色路由/异步 delegate、Iris 多 Agent/task board、CCB mailbox kernel、ccm-orchestra persistent sessions。缺口是 AgentHub 自身 durable Web/DB/runtime 产品实现深度。 |
| **下一步动作** | 已完成。治理门禁 `bash scripts/verify-governance-gate.sh COMPLETE-MULTI-AGENT-ORCHESTRATION-2026-06-02` 已通过；Trellis 任务已归档并记录 session journal。 |

### P1-RT: Agent Runtime 完整部署

| 字段 | 内容 |
|------|------|
| **优先级** | P1 |
| **FR-ID** | FR-RT-001（Cloud Runtime Gateway 契约）、FR-RT-002（user_local tunnel）、FR-RT-003（public_cloud 池部署） |
| **对应计划** | macro analyze `ANL-20260529-p1-runtime` + roadmap `RDM-20260529-p1-runtime`（架构已修订）+ **架构合同 `research/contracts/P1-RUNTIME-GATEWAY.md`（revised）** |
| **合同路径** | `research/contracts/P1-RUNTIME-GATEWAY.md`（权威，revised）；`.workflow/scratch/20260529-analyze-p1-runtime/conclusions.json`（旧模型，已被合同取代） |
| **当前状态** | ✅ **里程碑全部完成（2026-05-29）**：三 phase（gateway-contract / desktop-tunnel / public-cloud-pool）verify+review 均 PASS；milestone-audit PASS（0 critical/0 high）；归档至 `.workflow/milestones/P1-RT/`，current_milestone 置空（无 roadmap 后继） |
| **目标** | Cloud Runtime Gateway 统一承载 public_cloud + user_local 两类 endpoint；Web/Mobile 统一经 gateway，不直连本地端口；DB 状态记录 + 统一事件语义 |
| **方案摘要** | 3 phase：P1 = Gateway contract + DB model + routing/event semantics；P2 = Desktop local runtime tunnel 接入 gateway；P3 = 自建 public_cloud runtime 池 / worker 实现 |
| **验收方式** | 各 phase verify+review PASS + milestone-audit PASS + 真实 infra 回归（Phase 3 16/16 + Phase 2 13/13）+ tsc exit 0 + 治理门禁 exit 0 |
| **测试证据** | milestone-audit `.workflow/milestones/P1-RT/audit-report.md`（PASS）；milestone summary `.workflow/milestones/P1-RT/summary.md`；三 phase execution-report 见 `research/execution-reports/p1-rt-*.md`；Phase 3 集成 `verify-p1-rt-phase3.ts` 16/16；Phase 2 回归 `verify-p1-rt-phase2.ts` 13/13 |
| **阻塞问题** | 无（D-003 已决策全部自建，禁止 Supabase/Fly/Neon/Upstash 等包装平台） |
| **下一步动作** | 里程碑闭环。已知后续项：state.json 补登 Phase 2/3 execute/verify/review artifact（bookkeeping）；真实 RuntimeExecutor 接入 + worker liveness/订阅超时 + runtime_logs 统一脱敏 |

---

### P1-RUNTIME-GATEWAY

| 字段 | 内容 |
|------|------|
| **优先级** | P1（里程碑 P1-RT，Phase 1） |
| **FR-ID** | FR-RT-001（Cloud Runtime Gateway 契约） |
| **对应计划** | `PLN-20260529-p1-rt-gateway-phase1`（4 tasks / 2 waves） |
| **合同路径** | `research/contracts/P1-RUNTIME-GATEWAY.md`（权威，revised）；`.trellis/spec/cross-layer/runtime-gateway-contract.md` |
| **当前状态** | ✅ **Phase 1 全部完成，验证通过（2026-05-29）**：Gateway contract + DB 模型（5 表幂等）+ /api/chat 按 endpoint 路由 + 统一事件语义 + session 落库；review verdict=PASS |
| **目标** | Cloud Runtime Gateway 统一承载 public_cloud + user_local 两类 endpoint；Web/Mobile 统一经 gateway 不直连本地端口；DB 状态记录 + 统一事件语义；本阶段不要求真实 provider 部署 |
| **验收方式** | type-check exit 0；DB 迁移幂等性验证 PASS；/api/chat 集成测试覆盖新路由/事件/落库；review verdict != BLOCK；治理门禁 P1-RUNTIME-GATEWAY |
| **测试证据** | `apps/web/scripts/verify-p1-runtime-gateway.ts` 对真实 DB **12 passed / 0 failed / 1 skip(PASS)**（DB 二次 apply 幂等 exit 0 + 5 表存在 + P0 sessions/messages 不变 + isLocalNetworkTarget 安全 6/6）；落库 probe 写 runtime_sessions/runtime_logs 读回成功且 secret 脱敏；packages/shared + apps/web tsc exit 0；review.json verdict=PASS（critical/high/medium=0）；execution-report `research/execution-reports/p1-runtime-gateway-phase1-execution-report.md` |
| **阻塞问题** | 无（Phase 1 范围内）；D-003 已决策为自建，public_cloud 池自建实现属 Phase 3 |
| **下一步动作** | Phase 2：Desktop local runtime tunnel 接入 gateway；Phase 3：自建 public_cloud 池 / worker 实现 |

---

### P1-RT-PHASE2

| 字段 | 内容 |
|------|------|
| **优先级** | P1（里程碑 P1-RT，Phase 2） |
| **FR-ID** | FR-RT-001（Cloud Runtime Gateway 契约，Phase 2 tunnel 接入） |
| **对应计划** | `PLN-20260529-p1-rt-phase2`（4 tasks / 2 waves） |
| **合同路径** | `research/contracts/P1-RUNTIME-GATEWAY.md#Phase2`；`.trellis/spec/cross-layer/runtime-gateway-contract.md` |
| **当前状态** | ✅ **Phase 2 全部完成，验证通过（2026-05-29）**：device_runtime_channels 落库（ws-gateway 连接生命周期单点 upsert）+ gateway invoke tunnel 生命周期事件闭环（tunnel_connected/tunnel_disconnected/local_runtime_offline）+ RuntimeErrorCode 统一（packages/shared）+ Phase 2 集成测试 |
| **目标** | Desktop local runtime tunnel 复用 /ws/device + device-connections in-memory relay，把 user_local endpoint 的 tunnel/channel 状态接入 device_runtime_channels，打通 local_runtime_offline/tunnel_connected/tunnel_disconnected 事件闭环，统一 RuntimeErrorCode；不改 Desktop 主进程执行模型，不连真实部署平台 |
| **验收方式** | type-check exit 0（packages/shared + apps/web）；Phase 2 集成测试覆盖 device_runtime_channels 落库读回 + tunnel 生命周期事件 PASS；P0/Phase 1 回归不破；治理门禁 P1-RT-PHASE2 exit 0 |
| **测试证据** | `apps/web/scripts/verify-p1-rt-phase2.ts` 对真实 DB **13 passed / 0 failed / 0 skip（status=PASS）**：RuntimeErrorCode 字面值一致（DEVICE_OFFLINE/endpoint_unavailable/tunnel_disconnected/public_runtime_unconfigured）+ markChannelConnected→connected 行读回 + markChannelDisconnected→disconnected 且保留 connected_at + invoke 曾连接后断开 emit tunnel_disconnected + 从未连接 emit local_runtime_offline（均仍 emit runtime_status=DEVICE_OFFLINE，P0 兼容）；回归 `verify-p1-runtime-gateway.ts` 12 passed/0 failed/1 skip；packages/shared + apps/web tsc exit 0；execution-report `research/execution-reports/p1-rt-phase2-execution-report.md` |
| **阻塞问题** | 无（Phase 2 范围内）；D-003 已决策为自建，public_cloud 池自建实现属 Phase 3，本阶段未触及 |
| **下一步动作** | Phase 3：自建 public_cloud runtime 池 / worker 实现；Desktop 主进程 RuntimeHost/StreamAdapter 执行模型为后续独立范围 |

---

### P1-RT-PHASE3

| 字段 | 内容 |
|------|------|
| **优先级** | P1（里程碑 P1-RT，Phase 3） |
| **FR-ID** | FR-RT-001（Cloud Runtime Gateway 契约，Phase 3 自建 public_cloud worker/pool） |
| **对应计划** | `PLN-P3-03-public-cloud-pool`（4 tasks / 2 waves） |
| **合同/决策** | D-003（基础设施全部自建，禁用 Upstash/Neon/Modal 等托管平台）；`research/contracts/P1-RUNTIME-GATEWAY.md` |
| **当前状态** | ✅ **Phase 3 全部完成，验证通过（2026-05-29）**：自建 docker compose 栈（Postgres+Redis+worker 官方镜像）+ Redis 队列调度（LIST+BRPOP）+ RuntimeExecutor 接口/FakeExecutor 流式 + worker 状态机（running→completed/cancelled/failed）落 runtime_sessions/runtime_logs + gateway public_cloud 分支接入队列+订阅事件流 + cancelRuntimeSession 取消语义；REDIS 未配保留 endpoint_unavailable 占位（向后兼容），user_local 分支未改 |
| **目标** | gateway public_cloud 占位分支接入自建 Redis 队列：入队 runtime job → 自建 worker BRPOP 消费 → FakeExecutor 流式增量 → 事件 pub/sub 回流 gateway 转 SSE + 落 runtime_logs，状态机落 runtime_sessions（running/completed/cancelled/failed）；全部自建，无付费 API、无真实 CLI spawn、无托管平台依赖 |
| **验收方式** | type-check exit 0（apps/web）；docker compose config exit 0；禁用平台依赖扫描无匹配；Phase 3 集成测试覆盖调度/流式/落库+seq/取消/失败 5 类语义 PASS；Phase 2 回归不破；治理门禁 P1-RT-PHASE3 exit 0 |
| **测试证据** | `apps/web/scripts/verify-p1-rt-phase3.ts` 对真实 Postgres+Redis **16 passed / 0 failed / 0 skip（status=PASS）**：enqueue→dequeue 同一 job + FakeExecutor runtime_output 增量≥2（实测4）+ runtime_sessions.status=completed + runtime_logs seq 严格递增有序 + setCancel→cancelled（emit runtime_cancelled，不伪装 completed）+ job.fail→failed（emit runtime_failed，不伪装 completed）；回归 `verify-p1-rt-phase2.ts` 13 passed/0 failed/0 skip；apps/web tsc exit 0；compose config exit 0；banned-platform 扫描 clean；execution-report `research/execution-reports/p1-rt-phase3-execution-report.md` |
| **阻塞问题** | 无（Phase 3 范围内）。后续项：真实 RuntimeExecutor 接入前需补 worker liveness/订阅超时 + runtime_logs 统一脱敏（review.json 1 medium + 1 low，均 out-of-scope） |
| **下一步动作** | P1-RT milestone-audit / complete；真实 executor（CLI spawn/容器执行）接入与 worker 池水平扩展为后续独立范围 |

---

### RT-REAL-EXEC-001: 真实可插拔 RuntimeExecutor 接入

| 字段 | 内容 |
|------|------|
| **优先级** | P1（P1-RT 后续独立范围，adhoc 里程碑 `adhoc-real-runtime-executor`） |
| **FR-ID** | FR-RT-001 延伸（真实 executor 接入，不改 Gateway 总架构） |
| **对应计划** | `PLN-20260530-real-runtime-executor`（2 tasks / 2 waves，源自 `ANL-20260530-real-runtime-executor`） |
| **合同/决策** | 复用 RuntimeExecutor 接口（L1 零接口改动）；CLI 不可用返回 executor_unavailable（L5 禁假成功）；凭证仅经 env 注入不外发（L6）；默认 FakeExecutor 保证 gateway 零回归（L3） |
| **当前状态** | ✅ **全部完成，验证通过（2026-05-30）**：CliRuntimeExecutor spawn claude/codex CLI 流式 stdout→chunk；ENOENT/spawn 失败→ExecutorUnavailableError(code=executor_unavailable)；stderr 仅 drain 不外发；createExecutor 工厂按 RUNTIME_EXECUTOR env 选择，默认 FakeExecutor；verify 6 truths 全 VERIFIED / review PASS / test 7-7 pass |
| **目标** | 在不改 Gateway 总架构前提下，新增真实可插拔 executor（claude/codex CLI），保留 FakeExecutor 作测试 executor，CLI 不可用明确失败，凭证安全隔离 |
| **验收方式** | apps/web tsc exit 0；executor.test.ts 7/7 pass；gateway 零回归（git stash 基线对照预存失败一致）；grep 收敛条件全过；治理门禁 RT-REAL-EXEC-001 exit 0 |
| **测试证据** | `apps/web/__tests__/runtime/executor.test.ts` 7 passed / 7（S1-S7：unavailable/凭证隔离/Fake 回归/失败事件/工厂选择）；verification.json passed=true 6 truths VERIFIED 0 gaps；review.json verdict=PASS 0 blocking；execution-report `research/execution-reports/real-runtime-executor-report.md` |
| **阻塞问题** | 无。Deferred（非本期）：真实端到端 CLI 会话（需凭证+付费，D1）；结构化输出解析（D3） |
| **下一步动作** | milestone-complete 归档；真实端到端 CLI 会话验证 + worker 池接入为后续独立范围 |

---

### RT-WORKER-HARDEN-001: Runtime worker 硬化（liveness + 订阅超时 + 统一脱敏）

| 字段 | 内容 |
|------|------|
| **优先级** | P1（P1-RT / RT-REAL-EXEC-001 后续独立范围，adhoc 里程碑 `adhoc-worker-harden`） |
| **FR-ID** | FR-RT-001 延伸（runtime 健壮性 + 凭证隔离，不改 Gateway 总架构） |
| **对应计划** | `PLN-20260530-rt-worker-harden`（3 tasks / 2 waves，源自 `ANL-20260530-rt-worker-harden`） |
| **合同/决策** | RuntimeExecutor 接口零改动（L1）；超时/失联禁假成功，落 failed + emit runtime_failed（L5）；凭证经统一 redact 不外发（L6）；纯 Redis 心跳键不新增 DB schema（L3）；默认 FakeExecutor + 路由分支语义不变保证零回归 |
| **当前状态** | ✅ **全部完成，验证通过（2026-05-30）**：G1 worker 周期心跳（TTL 默认 30s）+ reclaimDeadSession 失联回收 failed；G2 subscribeEvents 空闲 60s/总 600s 双超时（env 可配）产出 runtime_failed 并释放订阅；G3 共享 redact（key 名 + 值级 sk-/Bearer/AKIA 等）接入 worker log() 与 gateway persist 两路径。verify PASS（G1/G2/G3 全 VERIFIED 0 gaps）/ review PASS / 三道 gate + goal-audit 全 proceed |
| **目标** | 在不改 Gateway 总架构前提下，硬化 runtime：worker 卡死会话可被回收、订阅永不永久阻塞、runtime_logs 不落明文密钥 |
| **验收方式** | apps/web tsc exit 0；runtime suite 18/18 pass；gateway 零回归（git stash 基线对照 7 个预存失败一致）；治理门禁 RT-WORKER-HARDEN-001 exit 0 |
| **测试证据** | runtime suite 18/18 passed：`redact.test.ts` 5/5 + `liveness.test.ts` 4/4 + `subscribe-timeout.test.ts` 2/2 + `executor.test.ts` 7/7（回归复绿）；verification.json verdict=PASS G1/G2/G3 全 VERIFIED 0 gaps confidence 92/high；review.json verdict=PASS spec ALL_MET severity 全 0；execution-report `research/execution-reports/rt-worker-harden-report.md` |
| **阻塞问题** | 无。UAT 以 cold-start 冒烟替代（后端 runtime 硬化无 UI 面，auto_mode 无交互测试者）；7 个全量套件失败为预先存在（缺 DATABASE_URL），与本任务无关 |
| **下一步动作** | milestone-complete 归档；worker 池接入与真实端到端会话验证为后续独立范围 |

### ARTIFACT-PANEL-DATA-001: Workspace 右栏面板接真实数据

| 字段 | 内容 |
|------|------|
| **优先级** | P1 |
| **绑定 FR-ID** | FR-WEB-001, FR-UI-001 |
| **来源** | PRODUCT-UAT-GAP-AUDIT-001（REG-20260530-007 GAP-003） |
| **当前状态** | 📋 待规划（2026-05-30 登记） |
| **缺陷台账** | `research/regression-ledger.md#reg-20260530-007` |
| **目标** | 右栏「产物/上下文/Agents」三 Tab 呈现真实数据，消除恒静态空态 |
| **方案摘要** | `apps/web/components/workspace/ArtifactPanel.tsx` Agents Tab 接 `/api/role-agents`；产物/上下文接对应数据源或显式标注 P1 未实现范围；补面板数据一致性断言（非仅 `toBeVisible`） |
| **验收方式** | 含 role_agents 的 workspace「Agents」Tab 呈现真实角色（含架构师），断言面板内容与真实数据一致 |
| **阻塞问题** | 无 |
| **下一步动作** | 进入 analyze/plan |

### DEV-ENV-BOOTSTRAP-001: 默认开发入口可跑通主链路

| 字段 | 内容 |
|------|------|
| **优先级** | P1 |
| **绑定 FR-ID** | FR-WEB-001 |
| **来源** | PRODUCT-UAT-GAP-AUDIT-001（REG-20260530-008 GAP-004） |
| **当前状态** | 📋 待规划（2026-05-30 登记） |
| **缺陷台账** | `research/regression-ledger.md#reg-20260530-008` |
| **目标** | 真实用户照默认入口 `pnpm dev:web` 启动并登录即可跑通主链路，无需手动切 P0 harness env |
| **方案摘要** | 提供可复现的本地真实 DB/REDIS env（或 `dev:full` 自动指向 p0/dev DB），替换 `apps/web/.env.local` 的 `your-project.supabase.co` 占位符；补「默认入口启动 → 登录 → 主链路可用」冒烟 |
| **验收方式** | 默认入口启动 → 登录 → 主链路可用冒烟通过 |
| **阻塞问题** | 无 |
| **下一步动作** | 进入 analyze/plan |

### WEB-WORKSPACE-LAYOUT-UAT-001: Web workspace 按钮位置/排版/交互可用性修复 + 真实浏览器布局 UAT

| 字段 | 内容 |
|------|------|
| **优先级** | P0（三栏移动失稳）+ P1（按钮几何/行为断言） |
| **绑定 FR-ID** | FR-WEB-001, FR-UI-001 |
| **来源** | ANL-web-workspace-layout-uat-2026-05-30（RC1-RC6）；Ralph session `ralph-20260530-223110` |
| **缺陷台账** | `research/regression-ledger.md#reg-20260530-009`（已关闭） |
| **当前状态** | ✅ 全部完成（2026-05-30 验证通过）：三栏桌面 1440×900/1280×800 + 移动 768 稳定（无横滚 + 中栏 ≥480 + 不重叠）；6 类按钮 boundingBox 几何 + onClick 真实结果断言；向后兼容业务逻辑零改。 |
| **目标** | 修 Web workspace 三栏布局/按钮位置/入口排版与交互可用性，真实浏览器 UAT 守护，错误布局必失败 |
| **方案摘要** | `WorkspaceShell.tsx` 响应式 `lg:grid-cols-[280px_minmax(480px,1fr)_320px]` + `overflow-x-hidden` + 移动抽屉/overlay；`visual-assertions.ts` 新增 5 个 boundingBox 几何断言；`web-workspace-layout-uat.spec.ts` 3 视口真实截图 + 几何 + 点击行为断言（禁止仅 `toBeVisible`、禁止 baseline 截图对比） |
| **验收方式** | Playwright 真实浏览器 3 视口；boundingBox 几何 + 点击真实结果断言；错误布局测试必失败 |
| **测试证据** | `playwright test --config=e2e/playwright.config.ts --project=web-desktop web-workspace-layout-uat.spec.ts` → **3 passed (6.5s)**（真实 localhost:3000 + P0 postgres + 真实 auth cookie）；证据图 `e2e/artifacts/web-workspace-layout/{desktop-1440x900,desktop-1280x800,narrow-768}.png`；verification.json PASS + review.json PASS（0 high）+ uat.md 3/3；执行报告 `research/execution-reports/web-workspace-layout-uat-001-report.md` |
| **阻塞问题** | 无（首跑环境竞争 EADDRINUSE + 共享单用户数据竞争，属既有 `REG-20260530-002` P1，清理残留进程后干净复跑通过） |
| **下一步动作** | 关闭，归档 adhoc milestone |

### UI-TOOLTIP-POSITION-001: 全局 Tooltip 定位/变形修复（packages/ui 共享层）+ 真实浏览器 E2E

| 字段 | 内容 |
|------|------|
| **优先级** | P1（UI 可用性 / 无障碍） |
| **绑定 FR-ID** | FR-UI-001 |
| **来源** | Ralph session `ralph-20260531-000642` |
| **缺陷台账** | `research/regression-ledger.md#reg-20260531-001`（已关闭） |
| **当前状态** | ✅ 全部完成（2026-05-31 验证通过）：Tooltip portal-to-body + 自动 flip/shift + max-width 换行，桌面 1440/1280 + 移动 768 hover/focus 五触发点 boundingBox 在 viewport 内、未裁切、未遮挡、不变形、无横滚；保留 aria/role 语义，IconButton 向后兼容零破坏。 |
| **目标** | 在 shared UI 层统一修复 Tooltip 边缘/overflow 容器/移动端错位裁切变形，真实浏览器 E2E 守护 |
| **方案摘要** | `tooltip.tsx` 重写：`createPortal` 到 body + `computePosition`（fits/flip/clamp）+ `max-w-[16rem] break-words`（移除 `whitespace-nowrap`）+ `role=tooltip`/`aria-describedby` + hover/focus 双触发；`icon-button.tsx` 新增可选 `tooltipSide`/`tooltipAlign` 透传（5 调用点回退默认，零破坏）；无新增运行时依赖 |
| **验收方式** | Playwright 真实浏览器（web-desktop+web-tablet，1440/1280/768）；tooltip boundingBox 几何断言（viewport 内 + max-width + 不遮挡 + 无横滚），hover+focus 双触发；禁止仅 `toBeVisible` |
| **测试证据** | `cd e2e && npx playwright test tests/web/ui-tooltip-position.spec.ts`（真实 web dev server + P0 postgres + 真实 auth cookie）→ **6 passed**（1440/1280/768 × web-desktop+web-tablet）；verification.json PASS（passed=true, gaps=[], packages/ui tsc exit 0）+ review.json PASS（0 critical/0 blocking）+ test-results.json 6/6；执行报告 `research/execution-reports/ui-tooltip-position-001-report.md` |
| **阻塞问题** | 无（结转 concern：768 toggle-artifact 被空态面板层叠覆盖属超范围响应式布局；apps/web full build 受 pre-existing dual @types/react 冲突，E2E dev 模式未受阻） |
| **下一步动作** | 关闭，归档 adhoc milestone |

---

### FLOATING-UI-UAT-AUDIT-001: Web Floating UI / Overlay 真实浏览器只读几何审计

| 字段 | 内容 |
|------|------|
| **优先级** | P1（UI 可用性审计；只读，不 execute/不修复） |
| **绑定 FR-ID** | FR-WEB-001, FR-UI-001 |
| **缺陷台账** | `research/regression-ledger.md#reg-20260531-002`（high, open）/ `#reg-20260531-003`（medium, open） |
| **当前状态** | ✅ 审计完成（2026-05-31）：真实浏览器三视口（1440/1280/768）几何审计，14 findings。发现 GAP-001(high) workspace selector 下拉 ×3 视口下越界且无内部滚动、GAP-002(medium) 移动 artifact 抽屉无 backdrop/无点击外部关闭；T1 tooltip 母版（UI-TOOLTIP-POSITION-001）无回归。已登记 REG-20260531-002/003，未修复产品代码。 |
| **目标** | 只读审计 Web tooltip/dropdown/popover/role picker/workspace selector/mobile drawer/artifact overlay 等浮层定位与裁切问题，几何断言发现缺口并入账，不 execute |
| **方案摘要** | refer_proj（cherry-studio/lobehub/AionUi/claudecodeui）只读提炼 R1–R11 浮层规则（未复制代码、未提交 refer_proj）；`floating-ui-uat-audit.spec.ts` 只读证据采集器对每个浮层真实 hover/focus/click 打开，采集 trigger + floating boundingBox 做几何断言，归档 findings.json |
| **验收方式** | Playwright 真实浏览器（1440/1280/768）+ 真实 Postgres `agenthub_acceptance` + 真实 Auth.js session；几何断言（越界/裁切/遮挡/横滚/变形），禁止 `toBeVisible` 充数 |
| **测试证据** | `research/execution-reports/floating-ui-uat-audit-001-report.md` + `floating-ui-uat-audit-001-findings.json`（14 findings：D1×3 high / O1 medium / 其余 ok）+ `e2e/tests/web/floating-ui-uat-audit.spec.ts`（只读审计 spec）+ `e2e/artifacts/floating-ui-uat-audit/*.png`（三视口截图证据） |
| **阻塞问题** | 无（审计任务，发现项已转 REG-20260531-002/003 待 FIX-D1/FIX-O1 后续 execute） |
| **下一步动作** | GAP-001 → `FIX-D1`（high，✅ 已由 FLOATING-UI-FIX-D1-001 关闭）；GAP-002 → `FIX-O1`（medium，待办）；本审计任务关闭 |

---

### FLOATING-UI-FIX-D1-001: workspace selector 下拉越界且无内部滚动修复（GAP-001 / REG-20260531-002）

| 字段 | 内容 |
|------|------|
| **优先级** | P1（high 缺陷修复；核心导航入口，3 视口复现） |
| **绑定 FR-ID** | FR-WEB-001, FR-UI-001 |
| **缺陷台账** | `research/regression-ledger.md#reg-20260531-002`（high → ✅ closed 2026-05-31） |
| **当前状态** | ✅ 完成（2026-05-31）：`Sidebar.tsx` workspace 下拉从裸 `absolute z-10` 改为 portal 浮层——抽出 `WorkspaceDropdown`（与 Tooltip 母版 `TooltipContent` 同构）`createPortal` 到 body + `computeDropdown` flip/clamp + `maxHeight`(≤60%vh)+`overflow-y-auto` 内部滚动 + `z-50` + document `pointerdown` 外部关闭。真实浏览器三视口 **3 passed**，D1 high→ok。 |
| **目标** | workspace 下拉不再越界/撑高页面，长列表内部滚动；3 视口 floating bbox 在视口内、无横滚；不碰 workspace 切换业务逻辑 |
| **方案摘要** | 复用 packages/ui Tooltip 母版 portal+clamp 模式（R1/R2/R3/R8），按下拉语义补 R4 size/max-height+内部滚动；外部关闭用 pointerdown 监听而非全屏 backdrop（避免拦截 trigger 二次点击） |
| **验收方式** | Playwright 真实浏览器（1440/1280/768）+ 真实 Postgres `agenthub_acceptance` + 真实 Auth.js session；D1 段升级为几何硬门禁（floating bbox 在视口内 + bottom≤vh + 无横滚 + symptoms 空），禁止 `toBeVisible` |
| **测试证据** | `research/execution-reports/floating-ui-fix-d1-001-report.md` + `floating-ui-uat-audit-001-findings.json`（D1×3 ok，severity `ok×13/medium×1`）+ `e2e/tests/web/floating-ui-uat-audit.spec.ts`（D1 硬断言）+ `e2e/artifacts/floating-ui-uat-audit/*-D1-workspace-dropdown.png`（下拉有界+内部滚动） |
| **阻塞问题** | 无。结转 concern：`apps/web` 全量 tsc 的 pre-existing dual `@types/react` 冲突（`ReactPortal`，母版 tooltip 同款），本修复同源同类 +1，非新缺陷，E2E/SWC 不受影响，属 DEV-ENV 范畴范围外 |
| **下一步动作** | 关闭。剩余浮层：FIX-O1（REG-20260531-003，medium）/ FIX-D2（role picker 预防项）按需另起 |

---

### FLOATING-UI-FIX-REMAINING-001: 移动 artifact 抽屉 backdrop（FIX-O1 / REG-20260531-003）+ role picker portal 预防升级（FIX-D2）

| 字段 | 内容 |
|------|------|
| **优先级** | P1（medium 缺陷修复 FIX-O1 + 预防性 hardening FIX-D2） |
| **绑定 FR-ID** | FR-WEB-001, FR-UI-001 |
| **缺陷台账** | `research/regression-ledger.md#reg-20260531-003`（medium → ✅ closed 2026-05-31） |
| **当前状态** | ✅ 完成（2026-05-31）：**FIX-O1** `WorkspaceShell.tsx` artifact 移动抽屉补 `artifact-backdrop`（`fixed inset-0 z-20 bg-black/40 lg:hidden`，onClick 关闭）+ 移动顶栏 `z-[25]`（高于 backdrop、低于抽屉，修复 backdrop 拦截 `open-sidebar` 回归），桌面三栏零影响。**FIX-D2** `ChatPanel.tsx` role picker 从裸 `absolute z-10` 预防升级为 portal-to-body——抽出 `RolePicker` `createPortal` 到 body + `computeRolePicker`（上方优先/不足翻下方 flip + clamp）+ `maxHeight`(≤60%vh)+`overflow-y-auto` + `max-w-[320px]`/`break-words` + `z-50` + pointerdown 外部关闭；@角色业务逻辑零改动。真实浏览器三视口 **3 passed**。 |
| **目标** | artifact 移动抽屉对齐 sidebar drawer（backdrop+点击外部关闭+z 分层）；role picker 浮层不越界/不裁切/不撑横滚/长角色名不撑爆；不回退 FIX-D1、不改 @角色业务逻辑、不影响桌面三栏 |
| **方案摘要** | 复用 FIX-D1 母版（`Sidebar.tsx` `WorkspaceDropdown`）portal+computeXxx flip/clamp+pointerdown 外部关闭思路；FIX-O1 backdrop 对齐 `sidebar-backdrop` 实现；FIX-D2 按 role-picker 语义补 max-width/break-words |
| **验收方式** | Playwright 真实浏览器（1440/1280/768）+ 真实 Postgres `agenthub_acceptance` + 真实 Auth.js session；O1/D2 段升级为几何硬门禁（O1 backdrop 覆盖全视口+点击关闭+z 分层；D2 floating bbox 在视口内+width≤320+无裁切+无横滚），D1 保持 pass，禁止 `toBeVisible` |
| **测试证据** | `research/execution-reports/floating-ui-fix-remaining-001-report.md` + `floating-ui-uat-audit-001-findings.json`（全 16 ok，O1/D2/D1×3 视口 symptoms 空）+ `e2e/tests/web/floating-ui-uat-audit.spec.ts`（O1/D2 硬断言）+ `e2e/artifacts/floating-ui-uat-audit/*-{O1,D2}-*.png` |
| **阻塞问题** | 无。此前结转的 pre-existing dual `@types/react` tsc 冲突已由 WEB-BUILD-REACT-TYPES-001（REG-20260531-004）在依赖解析层根治关闭，本任务 web type-check 全绿、无新增类型错误 |
| **下一步动作** | 关闭。FLOATING-UI-UAT-AUDIT-001 全部 GAP（D1/O1）已闭环，FIX-D2 预防项一并完成 |

---

### WEB-BUILD-REACT-TYPES-001: 修复 `@agenthub/web` build 失败的 dual `@types/react` 类型冲突

| 字段 | 内容 |
|------|------|
| **优先级** | P0 build blocker（`pnpm --filter @agenthub/web build` 直接 exit 1，发布主链路 `release:web` 不可用） |
| **绑定 FR-ID** | FR-WEB-001 |
| **缺陷台账** | `research/regression-ledger.md#reg-20260531-004`（build blocker → ✅ closed 2026-05-31；由历史 carried-over concern 升级） |
| **当前状态** | ✅ 完成（2026-05-31）：根因为 pnpm 把 mobile 的 `@types/react@18.3.29` hoist 进虚拟仓库根 `node_modules/.pnpm/node_modules/@types/react`，经 `react-markdown` 等 root 依赖的 ambient `@types` 上溯污染 web(React 19) 编译图，两份 `React.ReactNode`（v18 `ReactPortal.children` 必填 vs v19 可选）结构不兼容 → `Suspense`/`ReactMarkdown`/`Sidebar` portal/`Tooltip` 全部 TS2786。修复：根 `.npmrc` 增 `hoist-pattern[]=!@types/react` / `!@types/react-dom` 排除虚拟仓库根裸副本 + `pnpm install`。各 workspace 经自身直接依赖软链解析版本，mobile 隔离 18、web/ui/desktop 用 19。 |
| **目标** | `pnpm --filter @agenthub/web build` exit 0；保持 mobile 类型隔离；不用 `any`/cast/`skipLibCheck`/关闭类型检查绕过 |
| **方案摘要** | 在依赖解析层根治：pnpm `hoist-pattern` 排除 `@types/react`/`@types/react-dom`，杜绝跨版本裸副本被 TS ambient 发现；不触碰任何业务/UI 源码 |
| **验收方式** | `pnpm --filter @agenthub/web build` / `type-check` 真实执行取退出码 + `tsc --noEmit` 残留冲突类型 grep + `pnpm -r list @types/react` 隔离核验 |
| **测试证据** | `pnpm --filter @agenthub/web build` **exit 0**（`/m/preview` 等路由成功 prerender）；`pnpm --filter @agenthub/web type-check` **exit 0**；`packages/ui` type-check **exit 0**；`apps/desktop` type-check **exit 0**；残留 `ReactNode`/`ReactPortal`/`Suspense`/`Tooltip`/`createPortal`/TS2786 **= 0**；hoist 后 `node_modules/.pnpm/node_modules/@types/react` 消失；`pnpm -r list @types/react` web/ui/desktop=19.2.15、mobile=18.3.29。报告 `research/execution-reports/web-build-react-types-001-report.md` |
| **阻塞问题** | 无。dual `@types/react` 已由 carried-over concern 升级为 build blocker（REG-20260531-004）并关闭 |
| **下一步动作** | 关闭。后续新增包遵循同一 `@types/react` 非 hoist 隔离约定 |

---

### WORKSPACE-LOCAL-DESKTOP-UAT-001: Web Workspace 与 Desktop 本地连接真实可用性修复

| 字段 | 内容 |
|------|------|
| **优先级** | P0（真实用户验收阻塞：Workspace 主入口 + Desktop 本地连接） |
| **绑定 FR-ID** | FR-WEB-001, FR-WS-001, FR-CHAT-001, FR-RUNTIME-001, FR-DESKTOP-001, FR-DEVICE-001, FR-UI-001 |
| **共享合同** | `research/contracts/WORKSPACE-LOCAL-DESKTOP-UAT-001.md` |
| **缺陷台账** | `research/regression-ledger.md#reg-20260531-012`（P0，closed） |
| **当前状态** | ✅ 完成（2026-05-31）：Web Workspace 状态栏/返回入口、本地 Desktop 创建门禁、Agents CRUD、编排错误细分、附件禁用说明，以及 Desktop `device-channel:connect` IPC fallback 全部落地。 |
| **目标** | 用户在 `/workspace/:id` 能看到登录/本地连接/runtime 状态，未连接 Desktop 时不能创建不可用本地工作区；当前右栏能管理 Role Agents 并同步 @角色；Desktop 不再暴露 `No handler registered` 低层错误。 |
| **方案摘要** | 新增 `/api/runtime/status` 真实读取 Auth.js user + devices + device_runtime_channels；`POST /api/workspaces` 对 `local_desktop` 做服务端 409 门禁；`WorkspaceShell` 状态栏 + `CreateWorkspaceDialog` 前端门禁；`ArtifactPanel` Agents Tab 接 `/api/role-agents` CRUD 并派发 `role-agents:changed`；`ChatPanel` 刷新 @角色；`OrchestratorPanel` 显示 plans/actions 具体错误；Desktop 新增 `device-channel-ipc.ts` active/fallback handler 注册单点。 |
| **验收方式** | 真实 Postgres `agenthub_acceptance` + Auth.js session + Chromium UAT；Web/Desktop type-check；Desktop IPC vitest。 |
| **测试证据** | `pnpm --filter @agenthub/web type-check` PASS；`pnpm --filter @agenthub/desktop type-check` PASS；`pnpm --filter @agenthub/desktop test -- device-channel-ipc.test.ts` 2 passed；`npx playwright test e2e/tests/web/workspace-local-desktop-uat.spec.ts --config e2e/playwright.config.ts --project=web-desktop --workers=1` 1 passed（6.5s，提升权限后真实 Chromium 通过）。报告 `research/execution-reports/workspace-local-desktop-uat-001-report.md`。 |
| **后续修复** | 2026-05-31 关闭 `REG-20260531-013`：Desktop Codex 一次性消息改用 `--output-last-message "$AGENTHUB_OUTPUT_FILE"` 读取最终回复，清理 stdout 转录噪声，Codex timeout 调整到 180s，失败活动不再重复长输出。验证：Desktop 定向测试 12 passed、全量 vitest 23 passed、type-check PASS、build PASS。 |
| **阻塞问题** | 无。附件上传后端未实现，按合同诚实禁用并登记为范围外；默认 `.env.local` 引导问题仍归属 DEV-ENV-BOOTSTRAP-001 / REG-20260530-008。 |
| **下一步动作** | 关闭本任务；如要实现真实附件上传，应另起 `ATTACHMENT-UPLOAD-001` 并定义存储/权限/预览合同。 |

---

## P2 任务

（暂无登记）

---

## 变更历史

| 日期 | 任务 | 变更 |
|------|------|------|
| 2026-05-27 | AUTH-MIG-001 | 初始登记，计划已确认待执行 |
| 2026-05-27 | AUTH-MIG-001 | Wave 1 完成：TASK-001 文档修订 + TASK-002 Auth.js 基础设施搭建，type-check 通过 |
| 2026-05-27 | AUTH-MIG-001 | Wave 2 完成：TASK-003 middleware + TASK-004 API auth guard + TASK-005 Login 替换，type-check 通过 |
| 2026-05-27 | AUTH-MIG-001 | Wave 3 完成：TASK-006 Desktop 设备绑定 + TASK-007 测试适配，全量验收通过，session completed |
| 2026-05-27 | UI-ALIGN-001 | 初始登记，impeccable improve chain critique 评分 22/40 |
| 2026-05-27 | UI-ALIGN-001 | Refine loop 1：Desktop 侧栏 lucide 图标、Web Composer 工具条、Mobile 共享色彩 token、营销文案替换 |
| 2026-05-27 | GOV-GATE-001 | 新增完成前治理门禁脚本、兼容别名、Maestro 执行治理 Prompt，并接入 research 索引和 Maestro spec injection |
| 2026-05-27 | P0-ACCEPT-001 | 初始登记 + 全量完成：Desktop 入口修复（hooks 抽取 + 绑定）、Mobile 离线提示、E2E 19 tests |
| 2026-05-28 | P0-END-TO-END-PRODUCT-FLOW | 新增 MVP 端到端产品主链路共享合同和盲验证前准备审计；登录等已知问题登记为验真样本而非直接修复目标 |
| 2026-05-28 | P0-END-TO-END-PRODUCT-FLOW | Ralph 盲验证完成：执行系统自行发现 5 个 critical blockers；流程验真通过，产品合同 FAIL/NO-GO，禁止标记产品完成 |
| 2026-05-28 | P0-END-TO-END-PRODUCT-FLOW | 首版修复计划审查发现 plan anti-pattern：外部浏览器 cookie 假设、Runtime placeholder、mock auth 混入真实 DB、E2E 只查文件/--list；已新增 Trellis 规划指南并要求 revise/review |
| 2026-05-28 | P0-END-TO-END-PRODUCT-FLOW | 修复计划生成：6 tasks / 4 waves，覆盖 BLK-1~5 + 真实 DB 集成测试 + 三端 E2E + governance gate。Plan: `.workflow/scratch/20260528-plan-p0-e2e-fix/plan.json` |
| 2026-05-28 | P0-END-TO-END-PRODUCT-FLOW | 计划修订 Rev1：TASK-002 改为 device-binding token 方案；TASK-004 禁止 mock Agent 响应 + DEVICE_OFFLINE；TASK-005 强制真实 DB 运行；TASK-006 convergence 要求真实 E2E 运行 + 结果写入报告 |
| 2026-05-28 | P0-END-TO-END-PRODUCT-FLOW | Wave 1 / TASK-001 执行完成：session-store 接真实 API、删除 mock-data.ts、workspaces 无 DB 时 500、新增 verify-p0-api-crud.ts；type-check 通过 |
| 2026-05-28 | P0-END-TO-END-PRODUCT-FLOW | Wave 2-4 / TASK-002~006 执行完成：Desktop login-intent + Mobile /m/* 鉴权 + /api/chat 重写 + 集成测试 + 三端 E2E；type-check 通过；真实 DB/Auth 验证待环境 |
| 2026-05-29 | P0-END-TO-END-PRODUCT-FLOW | 真实 DB/Auth smoke 验证通过：Docker Postgres healthy + Auth.js session 三表 + API CRUD 5/5 PASS + build 通过 + Supabase 零残留；Desktop/Mobile/Runtime/E2E 待后续 |
| 2026-05-29 | UI-ALIGN-001 | 闭环：critique→refine→polish→audit 全链完成；commits beb9825 + 1fe7b7d；audit 15/20 PASS；type-check 通过；P0 数据链路未受影响；P1 a11y gaps 残留 |
| 2026-05-29 | P0-END-TO-END-PRODUCT-FLOW | mobile-pwa.spec.ts fixture 迁移完成：Supabase cookie → Auth.js ensureP0StorageState；4/4 tests PASS |
| 2026-05-29 | P1-RT | Agent Runtime 规划完成（ralph-20260529-150000）：analyze→scope-gate→roadmap→plan 全链；scope_verdict=large；7 tasks/3 waves；**止步 plan**（跨三子系统，按约束不 execute） |
| 2026-05-29 | P1-RT | **架构修订（revised plan，止步未 execute）**：用户澄清 Cloud Runtime Gateway 是必需实体（FRP 式 relay），非 optional provider。新增架构合同 `P1-RUNTIME-GATEWAY.md`；roadmap M:P1-RT 重写为 Gateway 模型（public_cloud + user_local 两类 endpoint）；D-003 从「是否需 provider」重定义为「全部自建」，Gateway 实体不再 deferred；Phase 1 改为 contract+DB+routing/event，可执行不要求真实部署 |
| 2026-05-29 | P1-RT | **基础设施自建决策**：Postgres 使用官方镜像/自管部署，Redis 使用官方 Redis 或开源替代自部署，Runtime Gateway/worker 自建；禁止 Supabase/Fly/Neon/Upstash 等包装平台作为产品依赖 |
| 2026-05-29 | P1-RUNTIME-GATEWAY | **Phase 1 execute + 验收完成**（ralph-20260529-170344）：shared 7 事件类型 + 5 张 gateway 表幂等迁移（P0 不变）+ gateway 抽象（去 minimal_adapter）+ /api/chat 按 endpoint 路由 + session 落库；verify-p1-runtime-gateway.ts 真实 DB 12 passed/0 failed/1 skip；落库 probe 读回 + secret 脱敏；tsc exit 0；review verdict=PASS（critical/high/medium=0）；治理门禁覆盖 |
| 2026-05-29 | P1-RT-PHASE2 | **Phase 2 execute + 验收完成**（ralph-20260529-194146）：device-channel-store 连接生命周期单点 upsert device_runtime_channels（ws-gateway addConnection/close/心跳超时 hook）+ gateway invoke user_local 分支 tunnel 事件闭环（tunnel_connected/tunnel_disconnected/local_runtime_offline，曾连接后断开经 channel.connected_at 判定）+ RuntimeErrorCode 集中 packages/shared 并替换内联字符串（DEVICE_OFFLINE/endpoint_unavailable 字面值不变保 P0 兼容）；verify-p1-rt-phase2.ts 真实 DB 13 passed/0 failed/0 skip；Phase 1 回归 12 passed/0 failed/1 skip；packages/shared + apps/web tsc exit 0 |
| 2026-05-29 | P1-RT-PHASE3 | **Phase 3 execute + 验收完成**（ralph-20260529-220000）：自建 docker compose 栈（postgres:15.3+redis:7.2+node worker 官方镜像）+ redis-client 封装（enqueue/dequeue BRPOP/pub-sub/cancel 控制键）+ RuntimeExecutor 接口/FakeExecutor 流式 + worker processJob 状态机（running→completed/cancelled/failed，落 runtime_sessions/runtime_logs seq）+ gateway public_cloud 分支接入队列+订阅事件流转 SSE + cancelRuntimeSession（REDIS 未配保留 endpoint_unavailable 占位，user_local 未改）；verify-p1-rt-phase3.ts 真实 Postgres+Redis 16 passed/0 failed/0 skip（调度/流式/落库+seq/取消/失败 5 类语义）；Phase 2 回归 13 passed/0 failed/0 skip；apps/web tsc exit 0；compose config exit 0；banned-platform 扫描 clean；review verdict=PASS（critical/high=0） |
| 2026-05-29 | P1-RT | **里程碑完成（milestone-audit + milestone-complete）**：三 phase verify+review 均 PASS；milestone-audit PASS（0 critical/0 high，跨 phase 集成无契约冲突）；真实 infra 回归 Phase 3 16/16 + Phase 2 13/13，apps/web + packages/shared tsc exit 0；10 个 artifact 归档至 milestone_history + `.workflow/milestones/P1-RT/`（audit-report/summary/roadmap-snapshot）；current_milestone 置空（standalone 里程碑无 roadmap 后继）；治理门禁 exit 0 |
| 2026-05-30 | RT-REAL-EXEC-001 | **真实可插拔 RuntimeExecutor 接入完成**（ralph-20260530-010200）：executor.ts 新增 CliRuntimeExecutor（spawn claude/codex CLI，readline 流式 stdout→chunk）+ ExecutorUnavailableError（ENOENT/spawn 失败 code=executor_unavailable，禁假成功）+ stderr 仅 drain 不外发（凭证隔离）；runtime-worker.ts createExecutor 工厂按 RUNTIME_EXECUTOR env 选择，默认 FakeExecutor（gateway 零回归）；executor.test.ts 7/7 pass（unavailable/凭证隔离/Fake 回归/失败事件/工厂）；verify 6 truths VERIFIED 0 gaps；review PASS 0 blocking；apps/web tsc exit 0；治理门禁 exit 0；未改 Gateway 总架构，无托管平台依赖，无真实付费调用 |
| 2026-05-30 | RT-REAL-EXEC-001 | **adhoc 里程碑完成归档**（milestone-complete）：5 个 artifact（analyze/plan/execute/verify/review）移入 milestone_history；scratch 归档至 `.workflow/milestones/adhoc-real-runtime-executor/`（audit-report PASS / summary）；current_milestone 置空，status=idle（adhoc 无后继）；ralph-20260530-010200 全 13 步闭环 |
| 2026-05-30 | WEB-WORKSPACE-UX-001 | 用户验真发现 Web Workspace 详情页“看得到但不好点/不可测”；代码审查确认 `/workspace/[id]`、新建会话、session 选中拉消息、发送 `/api/chat` 链路存在交互闭环缺口。已登记为 P0 regression，并补充“先稳定已完成功能，再推进新功能”治理规则 |
| 2026-05-30 | RT-WORKER-HARDEN-001 | **三项 runtime 硬化完成**（ralph-20260530-013000）：G1 worker liveness（redis-client 心跳键 setHeartbeat/isAlive/clearHeartbeat，TTL 默认 30s + runtime-worker reclaimDeadSession 失联落 failed + emit runtime_failed，禁假 completed）；G2 subscribeEvents 空闲 60s/总 600s 双超时（env 可配）产出 runtime_failed 哨兵 + finally 释放 timer/订阅/连接，gateway 落 failed；G3 共享 redact（key 名 + 值级 sk-/ghp_/xoxb-/AKIA/Bearer）接入 worker log() 与 gateway persist；redact 5/5 + liveness 4/4 + subscribe-timeout 2/2 + executor 7/7 回归 = 18/18；verify PASS（G1/G2/G3 VERIFIED 0 gaps）/ review PASS / 三道 gate + goal-audit 全 proceed；apps/web tsc exit 0；commits 14d0c73 + 7fd9633；未改 Gateway 总架构，无 DB schema 迁移 |
| 2026-05-30 | RT-WORKER-HARDEN-001 | **adhoc 里程碑完成归档**（milestone-complete）：audit-report PASS（0 critical/0 high）+ summary 写入 `.workflow/milestones/adhoc-worker-harden/`；2 个 artifact（analyze/plan）移入 milestone_history；current_milestone 置空，status=idle（adhoc 无后继）；治理门禁 RT-WORKER-HARDEN-001 exit 0；ralph-20260530-013000 全 13 步闭环 |
| 2026-05-30 | PRODUCT-UAT-GAP-AUDIT-001 | 只读真实用户主链路缺口审计（真实浏览器 + 真实 DB + 真实 auth）：发现 Web/Mobile Agent 回复在真实用户默认入口不可达、Artifact 面板恒空壳、默认 `.env.local` 占位符。登记 REG-20260530-006(P0)/007(P1)/008(P1)；报告 `research/execution-reports/product-uat-gap-audit-001-report.md` |
| 2026-05-30 | WEB-WORKSPACE-UX-001 / ROLE-CHAT-CORE-001 | 复审降级：交互/技术链路通过但用户目标（可见 Agent 回复）未达成，状态由「✅ 完成」回退为「⚠️ 技术链路部分完成、用户目标未达成」，阻塞项指向 REG-20260530-006，**不得转入关闭记录**（FakeExecutor 回显 ≠ Agent 链路成功） |
| 2026-05-30 | P0-END-TO-END-PRODUCT-FLOW | 复审标注：多 Agent 协作回复核心价值在真实用户态不可达，补登 REG-20260530-006 阻塞项 |
| 2026-05-30 | ROLE-CHAT-RUNTIME-DELIVER-001 / MOBILE-CHAT-DELIVER-001 / ARTIFACT-PANEL-DATA-001 / DEV-ENV-BOOTSTRAP-001 | 新增 4 条后续修复任务（前两项 P0、后两项 P1），来源 PRODUCT-UAT-GAP-AUDIT-001 |
| 2026-05-30 | ROLE-CHAT-RUNTIME-DELIVER-001 | ✅ 完成（commit `eed577f`）：Web @架构师真实回复链路修复，关闭 REG-20260530-006 **Web GAP-001**——gateway public_cloud 改用 endpoint status/id + 活跃 worker 在线键门控、无 worker/unconfigured 立即短路明确中文错误态（<2s）、非回显 ScriptedRealExecutor、两条默认不可跳过 E2E。verify passed=true/review PASS/UAT 2/2/milestone-audit PASS。Mobile GAP-002 保留 open，转 `MOBILE-CHAT-DELIVER-001`(P0)。归档 `.workflow/milestones/adhoc-role-chat-runtime-deliver/` |
| 2026-05-31 | UI-TOOLTIP-POSITION-001 | ✅ 完成（ralph-20260531-000642）：packages/ui Tooltip 重写 portal-to-body + computePosition flip/shift + max-w-[16rem] break-words（移除 whitespace-nowrap）+ 保留 role=tooltip/aria-describedby + hover/focus 双触发；IconButton 透传 tooltipSide/tooltipAlign 零破坏向后兼容。真实浏览器 E2E 6/6 passed（1440/1280/768 × web-desktop+web-tablet），boundingBox 在 viewport 内 + 无横滚 + 未遮挡断言。verify passed=true gaps=[]/review PASS（0 critical/blocking）/test 6/6/milestone-audit PASS；四道 gate + goal-audit 全 proceed；关闭 REG-20260531-001，归档 `.workflow/milestones/M-adhoc-20260531-ui-tooltip-position/` |
| 2026-05-31 | FLOATING-UI-UAT-AUDIT-001 | ✅ 只读浮层/Overlay 真实浏览器几何审计完成（analyze→reference-extract→audit→verify，不 execute/不修复）：refer_proj（cherry-studio/lobehub/AionUi/claudecodeui）提炼 R1–R11 浮层规则写入 Reference Findings；真实浏览器三视口（1440/1280/768）几何审计 3/3 passed，14 findings。发现 GAP-001(high) workspace 下拉越界无滚动 ×3 视口、GAP-002(medium) 移动 artifact 抽屉无 backdrop；T1 tooltip 母版无回归。登记 REG-20260531-002(high)/003(medium)。产物：report + findings.json + 只读审计 spec |
| 2026-05-31 | FLOATING-UI-FIX-D1-001 | ✅ 修复 GAP-001/REG-20260531-002（workspace 下拉越界+无内部滚动）：`Sidebar.tsx` 抽出 `WorkspaceDropdown`（同构 Tooltip 母版）portal-to-body + `computeDropdown` flip/clamp + `maxHeight`(≤60%vh)+`overflow-y-auto` + `z-50` + pointerdown 外部关闭；业务逻辑零改动。审计 spec D1 段升级为几何硬门禁。真实浏览器三视口 **3 passed**，D1 high→ok（floating 高 ~4400→540/480/540，bottom 全在视口内），findings `ok×13/medium×1`（剩 medium=O1 范围外），无回归。关闭 REG-20260531-002。结转 pre-existing dual @types/react tsc 冲突（同源+1，非新缺陷） |
| 2026-05-31 | WEB-BUILD-REACT-TYPES-001 | ✅ 修复 `@agenthub/web` `next build` 失败的 dual `@types/react` 冲突（build blocker）：`tsc --traceResolution` 定位根因为 pnpm 把 mobile `@types/react@18.3.29` hoist 进虚拟仓库根 `node_modules/.pnpm/node_modules/@types/react`，经 root 依赖（`react-markdown` 等）ambient `@types` 上溯污染 web(React 19) 编译图，v18 `ReactPortal.children` 必填致两份 `ReactNode` 不兼容 → `Suspense`/`ReactMarkdown`/`Sidebar` portal/`Tooltip` 全 TS2786。修复：根 `.npmrc` 增 `hoist-pattern[]=!@types/react`/`!@types/react-dom` 剔除裸副本（不用 any/cast/skipLibCheck）+ `pnpm install`。web build exit 0 / web type-check exit 0 / ui type-check exit 0 / desktop type-check exit 0、残留冲突类型=0、mobile 隔离 18 / web-ui-desktop 19 保持。把历史 carried-over concern 升级为 build blocker REG-20260531-004 并关闭。报告 `web-build-react-types-001-report.md` |
| 2026-05-31 | FLOATING-UI-FIX-REMAINING-001 | ✅ 修复 GAP-002/REG-20260531-003（移动 artifact 抽屉无 backdrop）+ 预防升级 FIX-D2（role picker portal）：**FIX-O1** `WorkspaceShell.tsx` 补 `artifact-backdrop`（`fixed inset-0 z-20 bg-black/40 lg:hidden` onClick 关闭）+ 移动顶栏 `z-[25]`（修复 backdrop 拦截 `open-sidebar` 回归，介于 backdrop z-20 与抽屉 z-30 之间），桌面三栏零影响。**FIX-D2** `ChatPanel.tsx` role picker 从裸 `absolute z-10` 升级为 portal-to-body：抽出 `RolePicker` `createPortal` 到 body + `computeRolePicker`（上方优先/翻转 flip+clamp）+ `maxHeight`(≤60%vh)+`overflow-y-auto` + `max-w-[320px]`/`break-words` + `z-50` + pointerdown 外部关闭；@角色业务逻辑（selectedRole/sendMessage roleAgentId）零改动、未回退 FIX-D1。审计 spec O1/D2 段升级为几何硬门禁，D1 保持 pass。真实浏览器三视口 **3 passed**，findings 全 16 ok（O1/D2/D1×3 symptoms 空）。关闭 REG-20260531-003；dual @types/react 冲突已由 REG-20260531-004 根治，web type-check 全绿无新增类型错误。报告 `floating-ui-fix-remaining-001-report.md` |
| 2026-05-31 | MOBILE-CHAT-DELIVER-001 | ✅ 关闭 REG-20260530-006 **Mobile GAP-002**（至此 REG-20260530-006 整体 closed）：`apps/web/app/m/sessions/[sessionId]/page.tsx` 发送从纯 `/api/messages` 写库改为走统一 `/api/chat` runtime SSE 链路（与 Web 一致），消费 `runtime_output` deltas 累积可见 agent 回复；解析 session→workspace→role-agents，默认架构师 orchestrator 角色上下文（发送按钮在 `defaultRole` 解析前门控，附 role badge）；runtime 终态事件映射明确中文系统提示，绝不静默仅存用户消息。附带修复 `apps/web/app/api/sessions/[id]/route.ts`（自研 postgres-query-client 不支持 `workspaces!inner` 嵌套 select，改 plain select + 独立 owner_id 归属校验 403）。新增真实浏览器移动视口 E2E `e2e/tests/mobile/mobile-chat-deliver.spec.ts`（iPhone 14 390×844，真实 DB + auth）：route 监听断言 `POST /api/chat` 被调用 + 有 worker→可见非 echo 回复+架构师 badge+reload 双向持久化 / 无 worker→立即明确中文错误态+reload 无误存 badge（非仅 `toBeVisible`）。verify passed=true（G1/G2/G3 VERIFIED）、review PASS（0 findings）、UAT 双 regime 各 1 passed、type-check exit 0 |
| 2026-05-31 | PRODUCT-REALITY-GAP-AUDIT-001 | ✅ 三端假交互/占位/未闭环只读审计完成（analyze→verify→governance，不 execute 不修复）：11 findings（P0×5/P1×4/P2×2，新发现 7）。核心新缺口——原生 Mobile App(RN) `apps/mobile/src/screens/ChatScreen.tsx:13-50` `setTimeout` 回显假发送（PRGA-001，区别于已修的 PWA `/m/`）、Desktop `DesktopAgentSession.tsx:14-20` 输入只 `addActivity` echo+硬编码 success / `:73-76` 控制按钮无 onClick（PRGA-002/003）、Web `PlanCard`/`ActionCard` 全仓零引用僵尸组件（PRGA-004）；Web `ArtifactPanel.tsx:31-39` 三 Tab 恒空态建议升 P0（PRGA-005）；worker 默认 `FakeExecutor`/`ScriptedRealExecutor` 非真实 LLM（PRGA-006，已有原则再确认）；E2E `artifact/messaging/workspace/p0-main-flow.spec.ts` 全 mock 主链路+只 `toBeVisible`/不断言 agent 回复（PRGA-007/008/009/010）。P0 代码位置主进程逐文件 Read 核验；**真实 GUI/浏览器/RN 截图 DEFERRED（环境无 dev server/Electron/Metro）**。登记 REG-20260531-010(P0)/011(P1)。产物：`product-reality-gap-audit-001-report.md` + `-findings.json` + 只读锚点 `e2e/tests/web/product-reality-gap-audit.spec.ts` |
| 2026-05-31 | DESKTOP-SESSION-RUNTIME-001 | ✅ 部分关闭 REG-20260531-010（PRGA-002/003）：Desktop 本地 Agent 会话从假交互改真实本地 runtime 执行。`main/index.ts` `setupRuntime()` 激活原死代码 `registerRuntimeIPC()`（`runtime:execute`→`LocalRuntimeAdapter` 真实 `child_process.exec`）；`preload/index.ts` contextBridge 暴露 `runtime.execute/available`；`renderer/utils/electron-api.ts` 补 `RuntimeExecResult` 类型；`DesktopAgentSession.tsx` `handleSend` 改 async 调真实 IPC，按 `exitCode`/catch 写 `success`/`failed` + stdout/stderr 摘要，无 runtime→明确 failed 错误态，删除硬编码 success echo；诊断/继续/重试/停止 改 `disabled`+`title=能力未实现（需远程流式 runtime，见 P1-RT）` 非死按钮。新增 renderer 测试 `apps/desktop/__tests__/desktop-agent-session.test.tsx` **4 passed**（runtime.execute 被调用+真实返回驱动状态 / exitCode≠0 失败态 / 无 runtime 失败态 / 四控制按钮 disabled+原因 title，非 `toBeVisible`），新增 vitest(jsdom)+testing-library 配置；type-check exit 0、build 通过；审计锚点 spec PRGA-002/003 反转为修复后事实。⚠️ Electron GUI 截图仍 DEFERRED。剩 PRGA-001(Mobile RN)/PRGA-004(Web 编排) 仍 open |
| 2026-05-31 | WEB-ORCHESTRATOR-UI-001 | ✅ 关闭 REG-20260531-010（PRGA-004）→ 全账本（PRGA-001/002/003/004）关闭：Web 编排 UI 从「未上线 + PlanCard/ActionCard 全仓零引用僵尸」改真实面板。新增 `apps/web/components/orchestrator/OrchestratorPanel.tsx`（`'use client'` 读 `useSessionStore().activeSessionId`，并行 `fetch` 真实 `GET /api/plans`+`GET /api/actions`，渲染 PlanCard(onConfirm→`POST /api/plans/:id/confirm`)+ActionCard(onApprove→`POST /api/actions/:id/approve {approved}`)，成功后 re-fetch，未选会话/空/error 显式 StateCard 空态，无 mock/硬编码）；`ArtifactPanel.tsx` TABS 增「编排」渲染 `<OrchestratorPanel />` 消除僵尸。E2E `e2e/tests/web/web-orchestrator-ui.spec.ts`（new）真实 API 播种 plan+high-risk action→切编排 tab→深度断言标题/节点/命令/风险/批准按钮（非 `toBeVisible`）→点批准 `waitForResponse` 真实 approve POST ok→GET 断言 `status=approved` 持久；`type-check` exit 0、`build` success（`/workspace/[id]` 7.18 kB）、`playwright --list` 1 test、`grep PlanCard\|ActionCard` 仅 OrchestratorPanel 引用、反模式扫描 clean。⚠️ E2E 真实运行需 Supabase DB（`TEST_AUTH_COOKIE`+`TEST_SESSION_ID`+`TEST_WORKSPACE_ID`），CI 无真实 DB → `test.skip` DEFERRED 保留断言骨架；GUI 截图 DEFERRED |
| 2026-05-31 | ARTIFACT-PANEL-DATA-001 | ✅ 关闭 REG-20260530-007 / PRGA-005：Web `ArtifactPanel.tsx` 产物/上下文/Agents 三 Tab 从硬编码 `StateCard empty` 恒空态改接真实数据。AgentsTab 读 `activeWorkspaceId`→`fetch GET /api/role-agents?workspace_id` 按 snake_case 渲染 name/role_type/capabilities/is_orchestrator；ContextTab+OutputTab 共用 `useSessionMessages()` 读 `GET /api/messages?session_id`，上下文筛 `is_pinned||metadata` 非空、产物筛 `message_type∈{plan_card,result_card}||metadata.artifact`；空态仅真实 fetch 为空时显示，未选/error 单独显式态；`data-testid` artifact-agents/context/output；**编排 Tab `<OrchestratorPanel />` 保留**；无 mock/硬编码假空态。E2E `e2e/tests/web/artifact-panel-data.spec.ts`（new）真实 API 播种 role agent+session+pinned 上下文+result_card 产物（非 `page.route` mock）→切三 Tab 断言真实数据文本（非 `toBeVisible`）+交叉校验 `GET /api/role-agents`；`type-check` exit 0、`build` exit 0（`/workspace/[id]` 7.68 kB）、`playwright --list` 1 test、反模式扫描 clean。⚠️ E2E 实跑需真实 Supabase DB（`TEST_AUTH_COOKIE`+`TEST_WORKSPACE_ID`），CI 无真实 DB → `test.skip` DEFERRED 保留断言骨架；GUI 截图 DEFERRED。遗留 `artifact.spec.ts` 等假数据门禁缺陷见 REG-20260531-011（P1，独立） |
| 2026-05-31 | WORKSPACE-LOCAL-DESKTOP-UAT-001 | ✅ Trellis inline 完成（未使用 Maestro/Ralph）：修复 Web workspace 真实验收缺口（返回“我的工作区”、登录/Desktop/runtime 状态、本地工作区 connected 门禁、Agents CRUD + @角色同步、编排错误细分、附件明确禁用）与 Desktop `device-channel:connect` no-handler fallback。真实 Chromium + Postgres + Auth.js UAT 1 passed（cloud 201、本地未连接 409、Agents create/edit/delete、@同步、无横滚）；Web/Desktop type-check PASS；Desktop IPC unit 2 passed。报告 `workspace-local-desktop-uat-001-report.md`；REG-20260531-012 closed。 |
| 2026-05-31 | TEST-REALITY-GATE-001 | ✅ 关闭 REG-20260531-011（PRGA-007/008/009/010）：四个「假绿」mock E2E spec 改真实栈集成测试并实跑全绿。`artifact.spec.ts` 从全程 `page.route` 伪造改真实 `POST /api/workspaces+role-agents+sessions+messages` 播种→切 Agents/上下文/产物三 Tab 断言真实数据（agent 列表项按钮无障碍名定位，规避详情面板/系统提示词 prose 同名 strict-mode）+交叉校验 GET API；`messaging.spec.ts` 改真实 `@架构师`→发送→`waitForResponse(/api/chat POST)`→断言回复或明确错误终态→reload 持久化（`.bg-primary/10` 取代失效 `.bg-blue-500`）；`workspace.spec.ts` 改真实 `POST /api/workspaces`→交叉校验落库→self-scoped 列表渲染（`scrollIntoViewIfNeeded`）→点击导航进 shell，删除 `list[0]`/全局空态污染断言；`p0-main-flow.spec.ts` 删除全部 `if(await x.isVisible())` 静默守卫，硬断言 workspace→session→@角色→发送→回复/错误终态→reload+布局无横滚/不重叠。`playwright.config.ts` web-desktop `testMatch` 补 `workspace/artifact/messaging.spec`（此前在 `tests/` 根目录从不被任何 project 收集——比 mock 更致命的「从不执行」缺口）。审计锚点 `product-reality-gap-audit.spec.ts` PRGA-005/007/008/009/010 反转为修复后事实，顺带反转 sibling 任务遗漏的 PRGA-001（MOBILE-RN-CHAT-RUNTIME-001：`ChatScreen` 用 `sendChat`→`/api/chat`）/PRGA-004（WEB-ORCHESTRATOR-UI-001：`OrchestratorPanel` 真实引用卡片）。真实栈实跑 **14 passed**（4 spec 7 test + 审计锚点 7 test，serial，cleaned DB，真实 Supabase/Next API/authjs cookie），`/api/chat` 实际 compiled+被调用，0 mock 0 silent-skip。⚠️ RUNTIME_E2E worker-mode（真实 agent 回复路径）本次仅覆盖 no-worker 错误终态 → DEFERRED 由 `RUNTIME-REAL-EXECUTOR-E2E-001` 跟进；GUI 截图 DEFERRED |
