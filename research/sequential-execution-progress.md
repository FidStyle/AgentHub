# AgentHub 单分支顺序执行总表

> 本表是 2026-06-05 起的执行总账。后续 AgentHub 任务默认在当前会话、当前分支 `AgentHub_new_claude_test` 顺序推进，不再用多 worktree/lane 并行开发，除非用户显式恢复并行模式。

---

## 执行规则

1. **单 active task**：任意时刻只执行一个 active Trellis task。当前任务未验证、未提交、未关闭前，不开始下一个任务。
2. **失败即停**：当前任务验证失败时，停在同一功能点内拆修复/验证子任务；修复通过前不能跳过做后续功能。
3. **三端验收默认必需**：每个功能任务的验收标准必须覆盖 Web、Mobile 浏览器/PWA、Desktop/Electron 三端。某端确实不适用时必须写明原因并标为 `not-applicable`；未运行或被阻塞必须标为 `not-run`/`blocked`，不得计入通过。
4. **OpenCLI 优先**：涉及真实用户 UI 链路时，OpenCLI 是 Web、Mobile 浏览器/PWA、Electron 的首选验收工具。Playwright、unit、type-check 只能作为补充，不能替代 OpenCLI UAT。
5. **真实主链路**：不得用 fake/script runtime、mock 主链路 API、截图存在、`playwright --list` 或局部单测冒充 Bytedance 产品目标通过。
6. **clean gate**：每个任务开始和结束都检查 `git status --short`；下一任务开始前必须 clean。
7. **证据入账**：任务开始、阻塞、验证通过、提交、关闭时都更新本表；证据路径优先写 execution report、OpenCLI screenshot/log、命令输出摘要和 commit hash。
8. **规则沉淀**：可复用规则写入 `.trellis/spec`；单任务临时状态、当前阻塞和一次性证据只写本表或 execution report。

---

## 当前执行指针

| 字段 | 内容 |
| --- | --- |
| 当前任务 | `.trellis/tasks/06-05-fix-approved-native-tool-execution-result` |
| 当前分支 | `AgentHub_new_claude_test` |
| 模式 | 单分支顺序执行 |
| 开始状态 | 非 clean（当前任务修复和 UAT 证据仍未提交） |
| 当前状态 | verified-for-blocker / product-gate-partial：approved native tool 执行结果续接已通过；固定样本 calculator + SQLite 产物已通过 Web/Mobile/OpenCLI 和 Electron fallback；但按 Bytedance 原始 PRD/视频和用户最新固定样本验收标准，完整 Orchestrator -> 前端工程师 -> 编排执行 -> 架构师验收链路仍未完成 |
| 阻塞项 | 无当前 approved-result 代码 blocker；产品门槛阻塞是固定样本 plan 中 `前端工程师执行` 和 `架构师汇总` 仍 waiting，需要 fresh fixed-sample rerun/续跑证明新提示避免 `/tmp`，并完成三端 AgentHub 编排读回 |
| 下一步 | 提交/归档当前 blocker task；clean 后先继续固定样本 Bytedance product gate，不进入 P1；未开始的 P2 不启动 |

---

## 顺序队列

| 顺序 | 功能点 / Trellis task | 优先级 | 状态 | 验证方式 | 证据路径 | 阻塞项 | 下一步 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `06-05-sequential-execution-governance-reset` | P0 | closed | 文档/spec 检查；`git status --short`；Trellis current 指针；本表和 tracker/index 可检索 | `python3 -m json.tool` 覆盖 7 个 touched task.json；`python3 ./.trellis/scripts/task.py current --source` 指向本任务；`python3 ./.trellis/scripts/task.py list` 显示旧 lane 为 `superseded-by-sequential-queue`；`rg` 可检索 `sequential-execution-progress` / 三端 OpenCLI 规则；`git diff --check` PASS；work commit `10c9e87 docs: 建立单分支顺序执行治理` | 无 | clean 后进入 `06-05-sync-role-runtime-opencli-failure-evidence` |
| 2 | `06-05-sync-role-runtime-opencli-failure-evidence` | P0 | closed | 只同步旧 `role-runtime-workspace-permissions` lane 的合同级证据与 OpenCLI 三端未验收事实；不修业务代码 | Source: `.trellis/tasks/06-03-role-runtime-workspace-permissions/research/acceptance-report.md`；Report: `research/execution-reports/role-runtime-opencli-failure-evidence-2026-06-05.md`；归档：`.trellis/tasks/archive/2026-06/06-05-sync-role-runtime-opencli-failure-evidence`；结论：旧 lane 未启动 dev server、未使用 `http://127.0.0.1:3106`、Web/Mobile/PWA/Desktop/Electron OpenCLI 均 `not-run`；验证：`task.py validate` PASS、task.json JSON PASS、JSONL 逐行解析 PASS、`task.py current --source` 归档后为 none、`rg` 可检索 not-run/not-accepted 结论、`git diff --check` PASS；work commit `31dc562 docs: 同步 role runtime OpenCLI 未验收事实`；status commit `2d42395 docs: 记录 role runtime 证据同步提交状态` | 无 | clean 后进入 `06-05-fix-role-runtime-cwd-context-isolation` |
| 3 | `06-05-fix-role-runtime-cwd-context-isolation` | P0 | closed | Unit/API/runtime worker cwd 断言；context payload 不含宿主 repo；三端 OpenCLI UAT 相关状态不假绿 | Report: `research/execution-reports/role-runtime-cwd-context-isolation-2026-06-05.md`；Archive: `.trellis/tasks/archive/2026-06/06-05-fix-role-runtime-cwd-context-isolation`；`pnpm --filter @agenthub/shared build` PASS；`pnpm --filter @agenthub/web test` PASS（30 files / 252 tests）；focused Web runtime/chat suite PASS（7 files / 57 tests）；`pnpm --filter @agenthub/web type-check` PASS；`pnpm --filter @agenthub/shared type-check` PASS；`pnpm --filter @agenthub/shared test -- src/domain/runtime-workspace.test.ts` PASS（1 file / 9 tests）；`pnpm --filter @agenthub/web lint` PASS（existing Next lint deprecation/config warnings only）；`task.py validate` PASS；task JSON/JSONL parse PASS；`git diff --check` PASS；OpenCLI Web/Mobile/PWA/Desktop-Electron UAT `not-run` by scope；work commit `b5da89d fix: 绑定角色 runtime 工作区 cwd`；status commit `cf161b7 docs: 记录 role runtime cwd 修复提交`；archive commit `0478ce3 chore(task): archive 06-05-fix-role-runtime-cwd-context-isolation` | 无 | clean 后进入 `06-05-fix-architect-durable-dispatch` |
| 4 | `06-05-fix-architect-durable-dispatch` | P0 | closed | 架构师收到工程需求后产生 durable plan/mailbox/attempt 或等价可审计派发记录；自动化覆盖固定样本，OpenCLI 三端 UAT 本任务不冒充通过 | Report: `research/execution-reports/architect-durable-dispatch-2026-06-05.md`；Archive: `.trellis/tasks/archive/2026-06/06-05-fix-architect-durable-dispatch`；`pnpm --filter @agenthub/web test -- __tests__/api/chat.test.ts __tests__/orchestrator.test.ts` PASS（2 files / 31 tests）；`pnpm --filter @agenthub/shared test -- src/domain/runtime-workspace.test.ts` PASS（1 file / 9 tests）；`pnpm --filter @agenthub/web test -- __tests__/orchestrator/action-dispatcher.test.ts __tests__/api/mailbox-controls.test.ts` PASS（2 files / 10 tests）；`pnpm --filter @agenthub/web test` PASS（30 files / 253 tests）；`pnpm --filter @agenthub/shared test` PASS（7 files / 47 tests）；`pnpm --filter @agenthub/web type-check` PASS；`pnpm --filter @agenthub/shared type-check` PASS；`pnpm --filter @agenthub/web lint` PASS（existing Next lint deprecation/config warnings only）；`task.py validate` PASS；task JSON/JSONL parse PASS；`git diff --check` PASS；OpenCLI Web/Mobile/PWA/Desktop-Electron UAT `not-run` by scope；work commit `8ab4b10 fix: 修复架构师 durable dispatch`；status commit `161ca12 docs: 记录架构师 dispatch 修复提交`；archive commit `3a6bf73 chore(task): archive 06-05-fix-architect-durable-dispatch` | 无 | clean 后进入 `06-05-fix-runtime-permission-broker` |
| 5 | `06-05-fix-runtime-permission-broker` | P0 | closed | 写文件、依赖安装、启动服务、网络、越界路径、破坏性命令的 pending/reject/allow-root-boundary；Web message 权限卡结构化元数据；OpenCLI 三端本任务 `not-run by scope` | Report: `research/execution-reports/runtime-permission-broker-2026-06-05.md`；Archive: `.trellis/tasks/archive/2026-06/06-05-fix-runtime-permission-broker`；`pnpm --filter @agenthub/shared test -- src/domain/runtime-workspace.test.ts` PASS（1 file / 15 tests）；`pnpm --filter @agenthub/web test -- __tests__/runtime/executor.test.ts __tests__/orchestrator/action-dispatcher.test.ts __tests__/message-markdown.test.ts __tests__/api/chat.test.ts __tests__/runtime/gateway-gating.test.ts __tests__/runtime/local-device-relay.test.ts` PASS（6 files / 66 tests）；`pnpm --filter @agenthub/web type-check` PASS；`pnpm --filter @agenthub/shared type-check` PASS；`pnpm --filter @agenthub/web lint` PASS（existing Next lint deprecation/config warnings only）；`git diff --check` PASS；OpenCLI Web/Mobile/PWA/Desktop-Electron UAT `not-run by scope`；work commit `d9c4b27 fix: 修复 runtime permission broker`；status commit `7a5b0a2 docs: 记录 runtime permission broker 提交`；archive commit `77f4e0f chore(task): archive 06-05-fix-runtime-permission-broker` | 无 | clean 后进入 `06-05-opencli-role-runtime-uat` |
| 6 | `06-05-opencli-role-runtime-uat` | P0 | blocked | OpenCLI Web + Mobile 浏览器/PWA + Electron；workspace `/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2`；prompt `做一个加减乘除的简单网站，使用sqlite存储历史记录`；验证 URL、fixture auth、cwd、context、plan/mailbox/attempt、权限卡、拒绝/允许行为 | Report: `research/execution-reports/opencli-role-runtime-uat-2026-06-05.md`；Screenshots: `e2e/artifacts/opencli-uat/role-runtime-uat-2026-06-05/`; Web OpenCLI PASS for auth/workspace/cwd/permission card/reject/allow UI; Mobile OpenCLI shows failed plan state; Electron Playwright fallback PASS (3 tests) | 批准 action `4671f8db-199e-49ae-b65e-1c735b3b99ca` 后 queued runtime session `fcf7af63-f34d-49e5-8550-c771402f1061`，但 action command 是 malformed `shell_command: /Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2`，没有继续原始 `Read` 工具请求；计划仍 failed，无 calculator/sqlite artifact | 同功能点创建并进入 `06-05-fix-approved-native-tool-continuation`，修复后重跑固定样本 UAT |
| 6.1 | `06-05-fix-approved-native-tool-continuation` | P0 | closed | 修复 approved native tool continuation；确保非 shell 工具不被转成 malformed shell command；重跑 Web/Mobile/Electron UAT | Report: `research/execution-reports/approved-native-tool-continuation-uat-2026-06-05.md`；Screenshots: `e2e/artifacts/opencli-uat/approved-native-tool-continuation-2026-06-05/`; Fresh acceptance restart + `pnpm env:acceptance:smoke` PASS；Web OpenCLI rerun PASS for fixed blocker：action `d23a4396-a3e0-4521-a91c-644bc3291911` stayed `read_file`, command `Read: .../README.md`, broker metadata retained through queued/running/terminal updates, continuation runtime session `ebda99b8-a6bc-4b3c-a376-1a07b7c926e7` kept same cwd/native session/role; Mobile `/m/sessions/b7cb9b2d-227a-4188-8c41-95319936acc3` PARTIAL; Electron fallback PASS (`pnpm --filter @agenthub/desktop build`, Playwright Electron 3/3); final quality gate PASS：focused Web tests 42 passed、Web type-check/lint PASS、Shared type-check PASS、Shared runtime-workspace 15 passed、Trellis validate PASS、`git diff --check` PASS；work commit `5280a7c fix: 修复 approved native tool continuation`；archive commit `fa83688 chore(task): archive 06-05-fix-approved-native-tool-continuation`；journal commit `d10007d chore: record journal` | 原 blocker 无；残留 follow-up 已拆：`REG-20260605-001`、`REG-20260605-002` | 已关闭；进入 `06-05-fix-ask-user-question-native-tool` |
| 6.2 | `06-05-fix-ask-user-question-native-tool` | P0 | closed | 修复 Claude native `AskUserQuestion` 分类；不得创建 `shell_command` action；Web/Mobile 读回 durable question；Electron fallback smoke | Report: `research/execution-reports/ask-user-question-native-tool-uat-2026-06-05.md`；Screenshots/DOM/SSE: `e2e/artifacts/opencli-uat/ask-user-question-native-tool-2026-06-05/`；real-user session `02ebaf71-fcef-4b5f-bec6-e334bad137db`；SSE `hasQuestion=true`、`hasApproval=false`、`questionId=tooluse_EEqwBGTYilRNQOUUIw706G`；Web OpenCLI `questionCards=1`；Mobile/PWA OpenCLI `questionCards=1`；DB/API 无 `AskUserQuestion` action，agent message `metadata.runtimeParts[0].type=question`；focused Web tests 52 passed；Web type-check/lint PASS；Shared type-check PASS；Shared runtime-workspace 15 passed；Desktop build PASS；Electron Playwright fallback 3/3 PASS；work commit `3a13421 fix: 修复 AskUserQuestion 原生问题事件`；archive commit `1ef7644 chore(task): archive 06-05-fix-ask-user-question-native-tool` | 原 blocker 无；残留 P0：`REG-20260605-002` Mobile/PWA durable permission detail readback | clean 后创建 `06-05-fix-mobile-permission-readback` |
| 6.3 | `06-05-fix-mobile-permission-readback` | P0 | closed | 修复 Mobile/PWA durable permission/action readback；同 session 刷新后显示 approved `read_file` 权限详情；Electron fallback smoke | Report: `research/execution-reports/mobile-permission-readback-uat-2026-06-05.md`；Artifacts: `e2e/artifacts/opencli-uat/mobile-permission-readback-2026-06-05/`；OpenCLI current browser user session `43361319-a417-4db9-a135-c2c9fd44dd61`；action `7a5052d7-d0fc-4f55-8399-0671ebeae2c1`；`/api/actions?session_id` returned `read_file`/`approved`/`runtime_permission_broker`; Mobile/PWA DOM `readback=1`、`durablePermissionCards=1`、`hasApprovedText=true`、`hasReadFile=true`、`hasTargetPath=true`、`overflow=false`; screenshot `mobile-permission-readback.png`; focused Web test 15 passed；Web type-check/lint PASS；Shared type-check PASS；Shared runtime-workspace 15 passed；Desktop build PASS；Electron Playwright fallback 3/3 PASS；Trellis validate PASS；`git diff --check` PASS；work commit `4b26d0a fix: 修复 Mobile 权限详情读回`；archive commit `fbffcdf chore(task): archive 06-05-fix-mobile-permission-readback` | 原 blocker 无 | clean 后回到 `06-05-opencli-role-runtime-uat` 固定样本三端 UAT |
| 6.4 | `06-05-fix-approved-native-tool-execution-result` | P0 | verified-for-blocker / product-gate-partial | 修复 approved native tool 执行结果注入和续接；继续固定样本 UAT；验证 calculator + SQLite 产物；三端 OpenCLI/Electron fallback；按 Bytedance 固定样本门槛反查 Orchestrator 首响、前端工程师派发、逐步编排、权限/Git/审批/文件树/代码引用 | Report: `research/execution-reports/approved-native-tool-execution-result-uat-2026-06-05.md`；Artifacts: `e2e/artifacts/opencli-uat/approved-native-tool-execution-result-taskupdate-2026-06-05/`；real-user session `bd36feef-c731-45c8-8551-b1f29fb4940c`；Orchestrator/架构师首响 PASS：message `bf47ea1a-f004-4ff6-9fcc-554807d3412a` 和 node `f708e666-66f5-4a3e-8f99-27e627bacd5b`；后端 node PASS：`8a1be434-7d6f-4438-912a-7a6dd5e59186` completed；前端派发 PARTIAL：node `2aebd4a0-1ca4-4b30-aa12-b8b2425d149b` / mailbox `c787275c-24c1-4a6f-b971-fadba0f85441` exists but waiting；架构师汇总 PARTIAL：node `251844da-0d35-4517-9d97-2dc132922db8` waiting；permission PASS：Read/Glob/Write/Bash completed and `/tmp` destructive command rejected；workspace product verified by `DB_PATH=./calc-verify.db node verify.mjs`; Web OpenCLI product UI `8 * 9 = 72`; Mobile OpenCLI product UI `12 / 3 = 4`; Mobile AgentHub readback shows 7 durable authorization records; Desktop build PASS; Electron fallback 3/3 PASS; focused Web tests 69 passed; Web/shared type-check PASS; Web lint PASS | 原 approved-result blocker 无；完整 Bytedance product gate 未过：前端执行和架构师最终验收仍 waiting，Git/change/code-reference 三端一体读回未在本轮闭环 | 提交/归档当前 blocker task；clean 后继续固定样本 product gate，不能进入 P1 |
| 6.5 | 固定样本 Bytedance product gate completion | P0 | queued | OpenCLI Web + Mobile/PWA + Electron fallback；从真实 IM 入口发送固定 prompt；必须证明 Orchestrator 首响、前端工程师派发并执行、权限/审批/Git/文件树/代码引用、最终架构师验收和三端读回 | 待补 | 等待当前 blocker task 提交/归档 | 拆 Trellis task，续跑/重跑固定样本；未通过前不进入 P1 |
| 7 | IM/联系人/自建 Agent 体验补全 | P1 | queued | 三端 OpenCLI + 真实 API/DB/session；PRD/Bytedance 反查 | 待补 | 等待 P0 fixed-sample product gate | 按 Bytedance 演示价值拆 Trellis task |
| 8 | 聊天式部署发布闭环 | P1 | queued | Web/Mobile/Electron 真实用户链路；部署 artifact/URL 可读回；权限审批 | 待补 | 等待前序 | 拆合同/task |
| 9 | Mini IDE / 富文档 / Artifact workbench 演示链路硬化 | P1/P2 demo-value | queued | 三端验收；OpenCLI real UI；artifact 可刷新读回 | 待补 | 等待前序 | 按演示价值拆 task |
| 10 | 最终 Demo 包和 3 分钟视频素材 | P1 | queued | Bytedance 原始 PRD 反查；三端录屏/截图/脚本证据 | 待补 | 等待 P0/P1 通过 | 整理最终 demo |

---

## 旧 Worktree/Lane 任务收口

以下任务来自旧并行 worktree/lane 流。2026-06-05 起不再作为并行 active task 推进；如仍有价值，必须按上方顺序队列拆成新的单分支 Trellis task。

| 旧任务 | 原状态 | 收口状态 | 处理方式 |
| --- | --- | --- | --- |
| `06-03-mini-ide-agentic-edit` | in_progress | superseded-by-sequential-queue | 演示价值保留，后续并入 Mini IDE / Artifact workbench 硬化队列 |
| `06-03-oss-component-migration-workbench-upgrade` | in_progress | superseded-by-sequential-queue | 规划资料保留，不作为并行实现入口 |
| `06-03-rich-doc-ppt-artifacts` | in_progress | superseded-by-sequential-queue | 演示价值保留，后续按三端验收重新拆任务 |
| `06-03-role-runtime-workspace-permissions` | in_progress | superseded-by-sequential-queue | P0 价值保留，但拆为同步失败证据、cwd/context、durable dispatch、permission broker、OpenCLI UAT 多个顺序任务 |
| `06-04-message-actions-topbar` | in_progress | superseded-by-sequential-queue | 已有结果不得自动算通过；后续如有回归按三端验收重新入队 |
| `06-04-worktree-e2e-governance` | planning | superseded-by-sequential-queue | 旧 worktree 治理规划被本表取代 |

---

## 更新协议

每次任务状态变化时更新对应行：

- `queued`：已排队，未开始。
- `in_progress`：当前唯一执行任务。
- `blocked`：当前任务失败或缺权限，必须停在本任务内拆修复/验证子任务。
- `verified`：任务验收通过但尚未提交/关闭。
- `committed`：任务变更已提交，等待关闭。
- `closed`：Trellis task 已关闭/归档，工作区 clean，可开始下一任务。
- `superseded-by-sequential-queue`：旧并行任务被顺序队列接管，不再作为执行入口。

证据必须写具体路径或命令摘要；没有证据时写 `待补`，不能写 `PASS`。
