# 修复 Runtime Permission Broker

## 背景

本任务承接单分支顺序队列第 5 项：`06-05-fix-runtime-permission-broker`。

共享合同：`research/contracts/ROLE-RUNTIME-WORKSPACE-PERMISSIONS-2026-06-03.md`

前置任务已完成：

- `06-05-fix-role-runtime-cwd-context-isolation`：cloud role runtime `cwd` 和上下文隔离。
- `06-05-fix-architect-durable-dispatch`：单独/默认 `@架构师` 工程请求产生 durable plan/mailbox/attempt。

本任务只处理 native CLI/tool 行为进入产品 permission broker，以及 Web/Mobile/Electron 可验收的结构化权限状态。不运行最终固定样本三端 OpenCLI UAT；最终 UAT 属于后续 `06-05-opencli-role-runtime-uat`。

## 用户链路

1. 用户在 cloud workspace session 中通过 `@架构师` 发起工程需求。
2. 架构师派发后端/前端角色，runtime worker 在 selected workspace root 中执行。
3. 当角色需要执行写文件、安装依赖、启动服务、网络请求、workspace 外路径访问或破坏性命令时，系统必须产生产品权限事件。
4. Web 消息流必须显示结构化权限卡，包含动作类型、路径/命令、workspace root、风险、允许/拒绝按钮。
5. 用户拒绝时，对应动作不得执行，并显示 `已拒绝，未执行该操作。`
6. 用户允许时，动作仍必须限制在 selected workspace root 内；越界路径必须被阻止并显示中文错误。

## 范围

包含：

- 审查并修复 native CLI/tool event 到 permission broker 的进入路径。
- 覆盖以下动作类型的 allow/reject/blocked 行为：
  - file write
  - dependency install
  - service start
  - network request
  - outside workspace access
  - destructive command
- Web 消息流结构化权限卡回归测试。
- 必要时补 Mobile/PWA 与 Desktop/Electron 状态可读性或说明本任务的 not-run/not-applicable 边界。
- 更新顺序执行总表、project tracker 和 execution report。

不包含：

- 最终固定样本 Web/Mobile/PWA/Desktop-Electron OpenCLI UAT。
- 新增复杂 permission policy 编辑器。
- 使用 mock runtime 成功结果替代真实 broker 行为。

## 验收标准

- 未授权动作不执行，并产生可审计 pending approval event。
- 拒绝授权后产生 rejected / execution_blocked 证据，且不执行动作。
- 允许授权后仅允许 workspace root 内动作；workspace 外路径即使已授权也阻止。
- Web 消息流可渲染结构化权限卡并提供允许/拒绝按钮。
- 自动化测试覆盖上述六类动作的关键路径。
- 受影响 package 的 focused tests、type-check、lint/check 命令通过；OpenCLI 未跑项必须写 `not-run`，不得冒充通过。

## 证据要求

- `research/sequential-execution-progress.md` 第 5 项状态和命令证据。
- `research/project-tracker.md` 增加/更新 P0 回归关闭状态。
- `research/execution-reports/runtime-permission-broker-2026-06-05.md` 记录 scope、变更、测试、OpenCLI 状态和残留风险。
- 如发现新的 broker 边界规则，更新 `.trellis/spec/backend/runtime-workspace-contract.md` 或相关 cross-layer spec。
