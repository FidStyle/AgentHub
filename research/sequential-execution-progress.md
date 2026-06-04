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
| 当前任务 | `.trellis/tasks/archive/2026-06/06-05-fix-runtime-permission-broker` |
| 当前分支 | `AgentHub_new_claude_test` |
| 模式 | 单分支顺序执行 |
| 开始状态 | `git status --short` clean（2026-06-05，第 4 项归档后） |
| 当前状态 | closed |
| 阻塞项 | 无 |
| 下一步 | clean 后进入 `06-05-opencli-role-runtime-uat` |

---

## 顺序队列

| 顺序 | 功能点 / Trellis task | 优先级 | 状态 | 验证方式 | 证据路径 | 阻塞项 | 下一步 |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 1 | `06-05-sequential-execution-governance-reset` | P0 | closed | 文档/spec 检查；`git status --short`；Trellis current 指针；本表和 tracker/index 可检索 | `python3 -m json.tool` 覆盖 7 个 touched task.json；`python3 ./.trellis/scripts/task.py current --source` 指向本任务；`python3 ./.trellis/scripts/task.py list` 显示旧 lane 为 `superseded-by-sequential-queue`；`rg` 可检索 `sequential-execution-progress` / 三端 OpenCLI 规则；`git diff --check` PASS；work commit `10c9e87 docs: 建立单分支顺序执行治理` | 无 | clean 后进入 `06-05-sync-role-runtime-opencli-failure-evidence` |
| 2 | `06-05-sync-role-runtime-opencli-failure-evidence` | P0 | closed | 只同步旧 `role-runtime-workspace-permissions` lane 的合同级证据与 OpenCLI 三端未验收事实；不修业务代码 | Source: `.trellis/tasks/06-03-role-runtime-workspace-permissions/research/acceptance-report.md`；Report: `research/execution-reports/role-runtime-opencli-failure-evidence-2026-06-05.md`；归档：`.trellis/tasks/archive/2026-06/06-05-sync-role-runtime-opencli-failure-evidence`；结论：旧 lane 未启动 dev server、未使用 `http://127.0.0.1:3106`、Web/Mobile/PWA/Desktop/Electron OpenCLI 均 `not-run`；验证：`task.py validate` PASS、task.json JSON PASS、JSONL 逐行解析 PASS、`task.py current --source` 归档后为 none、`rg` 可检索 not-run/not-accepted 结论、`git diff --check` PASS；work commit `31dc562 docs: 同步 role runtime OpenCLI 未验收事实`；status commit `2d42395 docs: 记录 role runtime 证据同步提交状态` | 无 | clean 后进入 `06-05-fix-role-runtime-cwd-context-isolation` |
| 3 | `06-05-fix-role-runtime-cwd-context-isolation` | P0 | closed | Unit/API/runtime worker cwd 断言；context payload 不含宿主 repo；三端 OpenCLI UAT 相关状态不假绿 | Report: `research/execution-reports/role-runtime-cwd-context-isolation-2026-06-05.md`；Archive: `.trellis/tasks/archive/2026-06/06-05-fix-role-runtime-cwd-context-isolation`；`pnpm --filter @agenthub/shared build` PASS；`pnpm --filter @agenthub/web test` PASS（30 files / 252 tests）；focused Web runtime/chat suite PASS（7 files / 57 tests）；`pnpm --filter @agenthub/web type-check` PASS；`pnpm --filter @agenthub/shared type-check` PASS；`pnpm --filter @agenthub/shared test -- src/domain/runtime-workspace.test.ts` PASS（1 file / 9 tests）；`pnpm --filter @agenthub/web lint` PASS（existing Next lint deprecation/config warnings only）；`task.py validate` PASS；task JSON/JSONL parse PASS；`git diff --check` PASS；OpenCLI Web/Mobile/PWA/Desktop-Electron UAT `not-run` by scope；work commit `b5da89d fix: 绑定角色 runtime 工作区 cwd`；status commit `cf161b7 docs: 记录 role runtime cwd 修复提交`；archive commit `0478ce3 chore(task): archive 06-05-fix-role-runtime-cwd-context-isolation` | 无 | clean 后进入 `06-05-fix-architect-durable-dispatch` |
| 4 | `06-05-fix-architect-durable-dispatch` | P0 | closed | 架构师收到工程需求后产生 durable plan/mailbox/attempt 或等价可审计派发记录；自动化覆盖固定样本，OpenCLI 三端 UAT 本任务不冒充通过 | Report: `research/execution-reports/architect-durable-dispatch-2026-06-05.md`；Archive: `.trellis/tasks/archive/2026-06/06-05-fix-architect-durable-dispatch`；`pnpm --filter @agenthub/web test -- __tests__/api/chat.test.ts __tests__/orchestrator.test.ts` PASS（2 files / 31 tests）；`pnpm --filter @agenthub/shared test -- src/domain/runtime-workspace.test.ts` PASS（1 file / 9 tests）；`pnpm --filter @agenthub/web test -- __tests__/orchestrator/action-dispatcher.test.ts __tests__/api/mailbox-controls.test.ts` PASS（2 files / 10 tests）；`pnpm --filter @agenthub/web test` PASS（30 files / 253 tests）；`pnpm --filter @agenthub/shared test` PASS（7 files / 47 tests）；`pnpm --filter @agenthub/web type-check` PASS；`pnpm --filter @agenthub/shared type-check` PASS；`pnpm --filter @agenthub/web lint` PASS（existing Next lint deprecation/config warnings only）；`task.py validate` PASS；task JSON/JSONL parse PASS；`git diff --check` PASS；OpenCLI Web/Mobile/PWA/Desktop-Electron UAT `not-run` by scope；work commit `8ab4b10 fix: 修复架构师 durable dispatch`；status commit `161ca12 docs: 记录架构师 dispatch 修复提交`；archive commit `3a6bf73 chore(task): archive 06-05-fix-architect-durable-dispatch` | 无 | clean 后进入 `06-05-fix-runtime-permission-broker` |
| 5 | `06-05-fix-runtime-permission-broker` | P0 | closed | 写文件、依赖安装、启动服务、网络、越界路径、破坏性命令的 pending/reject/allow-root-boundary；Web message 权限卡结构化元数据；OpenCLI 三端本任务 `not-run by scope` | Report: `research/execution-reports/runtime-permission-broker-2026-06-05.md`；Archive: `.trellis/tasks/archive/2026-06/06-05-fix-runtime-permission-broker`；`pnpm --filter @agenthub/shared test -- src/domain/runtime-workspace.test.ts` PASS（1 file / 15 tests）；`pnpm --filter @agenthub/web test -- __tests__/runtime/executor.test.ts __tests__/orchestrator/action-dispatcher.test.ts __tests__/message-markdown.test.ts __tests__/api/chat.test.ts __tests__/runtime/gateway-gating.test.ts __tests__/runtime/local-device-relay.test.ts` PASS（6 files / 66 tests）；`pnpm --filter @agenthub/web type-check` PASS；`pnpm --filter @agenthub/shared type-check` PASS；`pnpm --filter @agenthub/web lint` PASS（existing Next lint deprecation/config warnings only）；`git diff --check` PASS；OpenCLI Web/Mobile/PWA/Desktop-Electron UAT `not-run by scope`；work commit `d9c4b27 fix: 修复 runtime permission broker`；status commit `7a5b0a2 docs: 记录 runtime permission broker 提交`；archive commit `77f4e0f chore(task): archive 06-05-fix-runtime-permission-broker` | 无 | clean 后进入 `06-05-opencli-role-runtime-uat` |
| 6 | `06-05-opencli-role-runtime-uat` | P0 | queued | OpenCLI Web + Mobile 浏览器/PWA + Electron；workspace `/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2`；prompt `做一个加减乘除的简单网站，使用sqlite存储历史记录`；验证 URL、fixture auth、cwd、context、plan/mailbox/attempt、权限卡、拒绝/允许行为 | 待补 | 等待任务 5 完成 | 跑固定样本验收，失败则在同功能点拆修复任务 |
| 7 | IM/联系人/自建 Agent 体验补全 | P1 | queued | 三端 OpenCLI + 真实 API/DB/session；PRD/Bytedance 反查 | 待补 | 等待当前 P0 队列 | 按 Bytedance 演示价值拆 Trellis task |
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
