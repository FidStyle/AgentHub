# Execution Report — real-runtime-executor (adhoc)

> Session: ralph-20260530-010200 · Plan: PLN-20260530-real-runtime-executor
> Date: 2026-05-30 · Milestone: adhoc-real-runtime-executor

## Wave 1 — TASK-001 实现真实可插拔 RuntimeExecutor + worker 注入工厂

**状态**: ✅ 完成

### 改动
- `apps/web/lib/runtime/executor.ts`
  - 新增 `ExecutorUnavailableError`（`code='executor_unavailable'`）
  - 新增 `CliRuntimeExecutor implements RuntimeExecutor`：`child_process.spawn` 拉起 `claude`/`codex` CLI，readline 逐行将 stdout 转 `ExecutorChunk`
  - 二进制缺失（ENOENT）/ spawn error → 抛 `ExecutorUnavailableError`；退出码非 0 → 抛脱敏 Error（不含 env）
  - stderr 仅用于失败判定，**不**外发为 `runtime_output`（防凭证回显）
  - 凭证仅经构造参数 `env` 注入子进程 `spawn({ env })`
  - `FakeExecutor` 保留不变
- `apps/web/server/runtime-worker.ts`
  - 新增 `createExecutor()` 工厂：`RUNTIME_EXECUTOR=real` → `CliRuntimeExecutor`（`RUNTIME_CLI=codex` 选 codex），否则 `FakeExecutor`
  - `main()` 改用 `createExecutor()`；`processJob(job, executor = new FakeExecutor())` 默认参数不变（向后兼容）

### 验收
- `tsc --noEmit` → exit 0
- grep 收敛条件 5/5 通过（CliRuntimeExecutor / executor_unavailable / FakeExecutor 保留 / createExecutor / 默认 FakeExecutor）

## Wave 2 — TASK-002 Integration test

**状态**: ✅ 完成

### 改动
- `apps/web/__tests__/runtime/executor.test.ts`（新建，7 用例）
  - CLI 缺失 → `ExecutorUnavailableError` + `code='executor_unavailable'`
  - unavailable 错误信息不含注入凭证
  - `processJob` + FakeExecutor 回归：流式输出 + completed
  - executor 抛 unavailable → `processJob` 返回 `failed` + `runtime_failed` 事件
  - **凭证隔离**：`process.env` 中的 SECRET 不出现在任何 emitted 事件 / db insert / db update（序列化断言）
  - `createExecutor` 默认 Fake；`RUNTIME_EXECUTOR=real` → Cli

### 验收
- `vitest run __tests__/runtime/executor.test.ts` → 7 passed / 7
- `tsc --noEmit` → exit 0（含 test 文件）

## 回归确认
- 全量 web 测试：85 passed / 7 failed
- 7 个失败为**预先存在**（`api/workspaces`、`api/messages`、`integration/api-crud`），均因测试环境未设 `DATABASE_URL`；git stash 基线复现同样 7 个失败 → **本次改动零回归**

## 边界遵守
- ✅ 未改 Gateway 总架构（redis-client / publishEvent / relay / RuntimeJob 契约）
- ✅ 未重开 P1-RT phase
- ✅ 无托管平台依赖（纯本地 child_process spawn）
- ✅ 无真实付费 API 调用（测试用缺失二进制 + 注入式 stub）
- ✅ 凭证不进 logs/stdout/stderr 外发/report

## Verify 阶段补强
- `executor.ts`：新增 `child.stderr?.resume()` 仅 drain stderr，防止 chatty CLI 填满 pipe buffer 阻塞子进程；stderr 仍**不**外发为 output（凭证隔离不变）
- 复验：tsc exit 0；executor.test.ts 7/7 passed
- verification.json：6 truths 全 VERIFIED，0 gaps，confidence 92/high
