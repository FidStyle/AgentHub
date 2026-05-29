# Execution Report — rt-worker-harden (adhoc)

> Task: RT-WORKER-HARDEN-001
> Session: ralph-20260530-013000 · Plan: PLN-20260530-rt-worker-harden
> Date: 2026-05-30 · Milestone: adhoc-worker-harden

## 范围

在已完成 P1-RUNTIME-GATEWAY 与 RT-REAL-EXEC-001 基础上，完成三项 runtime 硬化（不改 Gateway 总架构、不重开既有里程碑、不新增 DB schema）：

- **G1 worker liveness**：`running` 会话周期写 Redis 心跳键；失联（心跳过期）的卡死会话被回收为 `failed` + emit `runtime_failed`，禁止伪装 completed。
- **G2 订阅双超时**：`subscribeEvents` 空闲/总时长双超时（env 可配），超时产出 `runtime_failed` 哨兵并释放订阅/生成器；gateway 据此落 `failed`，无静默成功。
- **G3 runtime_logs 统一脱敏**：抽取共享 `redact`（key 名匹配 + 值级凭证扫描 sk-/ghp_/xoxb-/AKIA/Bearer），worker `log()` 与 gateway persist 两路径均接入，runtime_logs 不落明文密钥。

## Wave 1 — TASK-001 统一脱敏

**状态**: ✅ 完成

### 改动
- `apps/web/lib/runtime/redact.ts`（新建）：导出 `redact(payload)`。两层脱敏——保留既有 `SECRET_KEY_PATTERN` key 名匹配（向后兼容）+ 新增 `CREDENTIAL_VALUE_PATTERN`（global flag，仅用于 `value.replace(...)`，无 `.test()` lastIndex 状态 bug）；递归 string/array/object。
- `apps/web/server/runtime-worker.ts`：`log()` 写 runtime_logs 前 `payload: redact(payload)`。
- `apps/web/lib/runtime/gateway.ts`：persist 路径复用 `redact`。

### 验收
- `tsc --noEmit` → exit 0
- `redact.test.ts` 5/5 passed（key 名 + 值级 sk-/ghp_/xoxb-/AKIA/Bearer 均落 [REDACTED]）
- commit `14d0c73`

## Wave 2 — TASK-002/003 liveness + 订阅双超时 + gateway 收尾

**状态**: ✅ 完成

### 改动
- `apps/web/lib/runtime/redis-client.ts`
  - 心跳键 `agenthub:runtime:hb:{id}`；`setHeartbeat(id, ttlSec=30)` / `isAlive(id)` / `clearHeartbeat(id)`
  - `subscribeEvents` 重写为带 idle/total 双 timer 的生成器（`SUB_IDLE_TIMEOUT_MS` 默认 60s / `SUB_TOTAL_TIMEOUT_MS` 默认 600s，env 可配）；超时 yield `{ type:'runtime_failed', error:'subscription timeout' }`；`finally` 中 clearTimers + unsubscribe + quit，消费者提前 break 也不泄漏 timer/订阅/连接
- `apps/web/server/runtime-worker.ts`
  - `running` 入口 + 每 chunk `setHeartbeat`；cancelled/failed/completed 终态 `clearHeartbeat`（TTL 默认 30s < idle 60s，失联在订阅超时前可检出）
  - `reclaimDeadSession(runtimeSessionId, endpointId?, seq=0)`：`isAlive` 为真返回 false；否则 setStatus failed + clearHeartbeat + log/publish `runtime_failed`（liveness lost）
- `apps/web/lib/runtime/gateway.ts`
  - public_cloud invoke 循环跟踪 `failed` 标志，订阅超时哨兵到达时落 `setSessionStatus(id, 'failed')`

### 验收
- `tsc --noEmit` → exit 0
- `liveness.test.ts` 4/4 passed（心跳写入/清除 + reclaimDeadSession 失联落 failed + alive 不回收 + dead 永不报 completed）
- `subscribe-timeout.test.ts` 2/2 passed（双超时触发 runtime_failed + 释放订阅；终态先到不误触发）
- commit `7fd9633`

## 回归确认
- 全量 runtime suite：18/18 fresh PASS（redact 5 + executor 7 + liveness 4 + subscribe-timeout 2）
- `executor.test.ts` 回归修复：Wave 2 后 `processJob` 调用 `setHeartbeat/clearHeartbeat`，其 redis-client mock 补齐这三个导出（含 `isAlive`），7/7 复绿
- 7 个全量套件失败（`api/messages`、`api/workspaces`、`integration/api-crud`）为**预先存在**（测试环境未设 `DATABASE_URL`）；`git stash` Wave 2 文件后在干净 committed 基线复现同样 7 个失败 → 本次改动零回归

## 边界遵守
- ✅ 未改 Gateway 总架构与 public_cloud/user_local 路由分支语义
- ✅ 未重开 P1-RT / RT-REAL-EXEC-001；RuntimeExecutor 接口零改动；默认 FakeExecutor 行为不变
- ✅ 纯 Redis 心跳键 liveness，不新增 DB 表/列
- ✅ 无托管平台依赖、无真实付费 CLI 调用
- ✅ 禁假成功：超时/失联落 failed + emit runtime_failed，未用 skip/ts-ignore 伪装

## 质量门禁
- verification.json：verdict PASS，G1/G2/G3 全 VERIFIED，0 gaps，confidence 92/high
- review.json：verdict PASS，spec ALL_MET，severity 全 0，findings []
- auto-test-report.json：code-forward，18/18，new_scenarios 0，PASS_NO_NEW
- uat.md：smoke 替代（后端 runtime 无 UI 面），5/5 expected-vs-reality PASS
- 三道 decision gate（post-verify / post-review / post-test）+ goal-audit 全 proceed/all_met
