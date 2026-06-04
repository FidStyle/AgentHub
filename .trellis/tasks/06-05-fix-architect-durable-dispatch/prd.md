# 修复架构师 durable dispatch

## 背景

本任务承接单分支顺序队列第 4 项：`06-05-fix-architect-durable-dispatch`。

共享合同：`research/contracts/ROLE-RUNTIME-WORKSPACE-PERMISSIONS-2026-06-03.md`

前置任务 `06-05-fix-role-runtime-cwd-context-isolation` 已修复角色 runtime cwd/context 隔离，并明确 OpenCLI 三端 UAT 尚未运行。本任务只处理 `@架构师` 收到工程需求后没有产生 durable 派发记录的问题。

## 用户链路

1. 用户在 cloud workspace session 中选择 workspace root：
   `/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2`
2. 用户向 `@架构师` 发送：
   `做一个加减乘除的简单网站，使用sqlite存储历史记录`
3. 系统判断该请求需要工程执行。
4. 在角色 runtime 执行前，系统必须产生可审计的 durable dispatch evidence：
   - orchestration plan / plan node，或
   - mailbox item / handoff，或
   - 等价 durable dispatch record。
5. 派发目标至少覆盖后端角色；页面交互需求应覆盖前端角色，或明确由同一工程角色承担。
6. 派发、attempt、mailbox、runtime session 记录必须保留 selected workspace root/cwd，不得退回宿主 AgentHub repo。

## 范围

本任务包含：

- 修复默认或显式 `@架构师` 工程请求只 direct chat、不产生 durable dispatch 的行为。
- 确保架构师工程请求会创建 plan/mailbox/attempt 或等价可读回记录。
- 补自动化测试覆盖固定中文样本、dispatch 目标、durable evidence 和 cwd 传递。
- 更新顺序执行总表、project tracker 和 execution report。

本任务不包含：

- 修复 native CLI permission broker 或结构化权限卡；该项属于后续 `06-05-fix-runtime-permission-broker`。
- 运行最终固定样本 OpenCLI Web/Mobile/Electron 三端 UAT；该项属于后续 `06-05-opencli-role-runtime-uat`。
- 引入 mock runtime 数据来满足产品主链路。

## 验收标准

- `@架构师` 或默认架构师路径收到固定中文样本时，自动产生 durable plan/mailbox/attempt 或等价 dispatch evidence。
- Dispatch target 包含后端和前端角色，或测试中能证明同等工程角色覆盖 SQLite 持久化与页面交互。
- `/api/chat` 相关测试证明 selected workspace root/cwd 传入 runtime jobs/session/attempt evidence。
- 不回归前置任务的 cwd/context 隔离断言。
- 受影响 package 的 focused tests、type-check、lint/check 命令通过；无法运行的验收项必须标记为 `not-run`，不得写作通过。

## 证据要求

- `research/sequential-execution-progress.md` 第 4 项状态和命令证据。
- `research/project-tracker.md` 对 P0 回归关闭状态的同步。
- `research/execution-reports/architect-durable-dispatch-2026-06-05.md` 记录 scope、变更、测试、OpenCLI 状态和残留风险。
- Trellis task 归档前通过 task validation / JSON / JSONL / git diff checks。
