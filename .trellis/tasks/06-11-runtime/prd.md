# 修复 Runtime 空闲超时误杀与标准模式审批死循环

## Goal

根因修复两个 Runtime 执行稳定性缺陷，使「为字节跳动创建介绍文档以及 PPT」这类「先调研后长生成」的多角色编排在 full_control 与标准权限模式下都能跑通到 4/4 节点 completed，不再出现「活着但安静被误杀」或「同意审批卡后不前进」。

## Current Failure Evidence

来源：Postgres `agenthub_acceptance` `runtime_logs`，失败 session `c948dfa9-3e27-4c49-9a63-f428d3e52b15`（runtime_type=codex，cwd `123-c11b0363`）。

- **Bug 1（空闲超时误杀，已确证）**：19:22:52 启动 → 19:31:07 失败，历时 8.5min。最后一次 executor 产出为 seq 39 @ 19:26:07（一批 network_request 抓取字节官网/TikTok newsroom），之后**整整 5min 无任何 executor chunk**，仅 15s 一次的 `runtime_status` 心跳（seq 40–59），最终 seq 60 报 `Runtime 输出空闲超时，已终止。`。心跳持续在跳证明 worker 与 Codex 子进程都活着——长模型推理/产物生成期被误判卡死。工作区最终仅剩 README.md，8.5min 工作全丢。
- **Bug 2（标准模式审批死循环，确证为真 / GAP A）**：`research/execution-reports/standard-permission-approval-card-2026-06-10.md` 声称标准模式审批已通过，但其证据仅覆盖 `toolRequest`（Claude Code）路径的 allow/reject，**未覆盖 Codex 的 `observedAction` 路径**。该路径缺少 `toolRequest` 已有的「已授权工具去重」守卫，导致 Codex `--resume` 续跑时对同一条已授权命令再次进入审批分支抛出、再弹卡片，陷入「同意→不前进→又弹卡片」死循环。这正是用户「之前修过、不确定修干净」的残留缺口。

## Requirements

### Bug 1
- 「活着但安静」的子进程（模型推理 / 长子命令运行）**不得**被 worker 端空闲看门狗杀掉。
- 「真正卡死 / 已退出」的子进程**仍须**被杀（看门狗不能失效）。
- `RUNTIME_JOB_TIMEOUT_MS`（默认 15min）保留为绝对上限。
- 空闲超时默认值 5min **不调高**（仅作子进程已死时的兜底回收窗口）。
- keepalive 信号严格绑定子进程存活（`child.exitCode === null && !child.killed`），不得用「盲定时器」。
- keepalive 在 worker 内部消费，不写 `runtime_logs`、不发 Redis、不计入输出。
- 不破坏 `FakeExecutor` / `ScriptedRealExecutor` 与 `RuntimeExecutor` 接口契约。
- relay/subscribe 层（`redis-client.ts`）**不改**——其三计时器设计本就正确。

### Bug 2
- 标准（非 full_control）模式下 Codex `observedAction` 审批路径与 `toolRequest` 路径行为一致：续跑时对「已授权的同一工具」放行（发 `approved_tool_result_consumed` 并 continue），让 Codex 继续执行。
- 不同命令仍须重新审批（保留反例正确性）。
- 复用既有 `sameApprovedNativeToolRequest` + `observedActionAsToolRequest` + `suppressedApprovedToolRequest` 标志，不引入新机制。
- dispatcher 续跑入队逻辑（`action-dispatcher.ts:1162-1182`）本就正确，不改。

## Out of Scope

- 不改 relay/subscribe、gateway、dispatcher 入队逻辑。
- 不调高任何超时默认值。
- 前端 SSE 重连（GAP B，探查中提及但非本次根因）暂不在本任务范围；若验证发现确为阻断再另开。

## Verification

详见 plan 文件 `/Users/joytion/.claude/plans/noble-beaming-turtle.md` 的 Verification 章节：单元测试（executor.test.ts 加 keepalive 存活/已死两用例 + observedAction 去重用例）、`pnpm --filter @agenthub/web test`、`mcp__ide__getDiagnostics`、full_control 与标准模式各跑一次字节跳动 PPT 真实全流程并以 `runtime_logs` 取证。
