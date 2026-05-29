# P1-RT Phase 3 执行报告 — 自建 public_cloud Runtime Worker/Pool

- **任务**: P1-RT-PHASE3 / `PLN-P3-03-public-cloud-pool`（4 tasks / 2 waves）
- **会话**: ralph-20260529-220000
- **日期**: 2026-05-29
- **基线 commit**: b91a925（Phase 2 + 治理规则）
- **合同/决策**: D-003（基础设施全部自建，禁用 Upstash/Neon/Modal 等托管平台）；`research/contracts/P1-RUNTIME-GATEWAY.md`

## 范围

在现有 gateway.ts public_cloud 占位分支处接入自建 Redis 队列调度：gateway 入队 runtime job 并订阅事件流 → 自建 worker BRPOP 消费 → RuntimeExecutor 接口 + FakeExecutor 流式增量 → 事件经 Redis pub/sub 回流 gateway 并落 runtime_logs，状态机落 runtime_sessions（running→completed/cancelled/failed）。全部自建（Postgres+Redis+worker docker compose 栈），无付费 API、无真实 CLI spawn、无托管平台依赖。user_local 分支不动；REDIS_URL 未配时保留 endpoint_unavailable 占位（向后兼容）。

## 改动清单

| Task | Goal | 文件 | 说明 |
|------|------|------|------|
| TASK-001 | G1 | `docker/docker-compose.runtime.yml`（新）、`apps/web/lib/runtime/redis-client.ts`（新）、`apps/web/package.json` | 自建 compose 栈（postgres:15.3 + redis:7.2 + node worker，官方镜像 + healthcheck + 内网）；redis 官方客户端封装 enqueue/dequeue(BRPOP)/publishEvent/subscribeEvents(pub-sub)/setCancel/isCancelled/clearCancel；新增 redis ^4.7.1 依赖 |
| TASK-002 | G2 | `apps/web/lib/runtime/executor.ts`（新）、`apps/web/server/runtime-worker.ts`（新） | RuntimeExecutor 接口 + FakeExecutor（按空格分块 echo prompt + fail 注入）；worker processJob 状态机 running→stream(每 chunk 检 isCancelled)→completed/cancelled/failed，落 runtime_logs(seq) + publishEvent；main loop dequeue 消费；processJob 导出供测试驱动 |
| TASK-003 | G3 | `apps/web/lib/runtime/gateway.ts`、`apps/web/app/api/chat/route.ts`、`apps/web/lib/runtime/hosted-adapter.ts`、`packages/shared/src/runtime/gateway.ts` | gateway public_cloud 分支：REDIS 可用→public_runtime_available:true + enqueue + subscribeEvents 转发 RuntimeGatewayEvent；不可用→保留 endpoint_unavailable 占位；新增 cancelRuntimeSession→setCancel；userMessage 透传链 route→adapter→gateway.prompt |
| TASK-004 | G4 | `apps/web/scripts/verify-p1-rt-phase3.ts`（新）、tracker、本报告 | Phase 3 集成测试（真实 Postgres+Redis，5 类语义）+ 治理账本同步 |

## 关键设计

- **队列结构（D-P3-4）**：runtime job 用 Redis LIST + BRPOP（单 worker 阻塞消费）；事件回流用 pub/sub channel `agenthub:runtime:events:{id}`；取消用控制键 `agenthub:runtime:cancel:{id}`（EX 300）。
- **流式事件闭环**：worker 每产出一个 chunk → log runtime_logs(seq++) + publishEvent；gateway 端 subscribeEvents 用带背压队列的 async generator，遇 terminal 事件（completed/failed/cancelled）结束订阅并转发为 SSE。
- **取消语义**：gateway.cancelRuntimeSession → setCancel 写控制键；worker 在每个 chunk emit 前 isCancelled 检查，命中即落 cancelled 终态并 emit runtime_cancelled，不伪装 completed。
- **失败语义**：FakeExecutor 在 job.fail 时于流中途抛异常；worker catch 落 failed 终态 + emit runtime_failed，不伪装 completed。
- **向后兼容**：REDIS_URL 未配 → public_cloud 仍返回 public_runtime_available:false + endpoint_unavailable（Phase 1 占位语义）；user_local 分支（getConnectionByUserId + tunnel 事件）完全未改。
- **自建合规（D-003）**：compose 仅用官方 postgres/redis/node 镜像；依赖仅新增 redis 官方客户端；banned-platform 扫描（upstash/neon/supabase/modal/planetscale 等）无匹配。

## 验证证据

```
# Phase 3 集成测试（真实 Postgres agenthub_p0_test + Redis :6380）
$ DATABASE_URL=postgresql://agenthub:***@localhost:5432/agenthub_p0_test \
  REDIS_URL=redis://localhost:6380 npx tsx scripts/verify-p1-rt-phase3.ts
SUMMARY: 16 passed, 0 failed, 0 skipped, status=PASS
  - [调度] enqueue → dequeue 取回同一 job + 保留 prompt
  - [流式] FakeExecutor runtime_output 增量 ≥2（实测 4）
  - [落库] runtime_sessions.status=completed + runtime_logs seq 严格递增有序（0,1,2,3,4,5）
  - [取消] setCancel → processJob 落 cancelled + emit runtime_cancelled，不伪装 completed
  - [失败] job.fail → processJob 落 failed + emit runtime_failed，不伪装 completed

# Phase 2 回归（真实 DB）
$ DATABASE_URL=... npx tsx scripts/verify-p1-rt-phase2.ts
SUMMARY: 13 passed, 0 failed, 0 skipped, status=PASS

# 类型检查
$ cd apps/web && npx tsc --noEmit          → exit 0

# docker compose 配置校验
$ docker compose -f docker/docker-compose.runtime.yml config   → exit 0

# 禁用平台依赖扫描（新增 runtime 文件 + compose）
$ rg -i 'upstash|@neondatabase|supabase|modal|planetscale' ...  → 无匹配（clean）

# Redis 连接 smoke
$ docker exec agenthub_runtime_redis redis-cli ping            → PONG
```

## 评审结论

`review.json` verdict=PASS：spec-compliance 4/4 MET，0 critical/0 high。1 medium（subscribeEvents 无订阅超时，worker 进程崩溃可致 gateway 挂起）+ 1 low（worker 落库未走 redact 脱敏）均判定为 out-of-scope 后续项：Phase 3 单 fake-executor worker + processJob 进程内异常路径已闭环必发终态事件，真实 worker liveness/heartbeat 与脱敏统一属接真实 executor 前的后续阶段。

## 阻塞问题

无（Phase 3 范围内）。后续项：真实 RuntimeExecutor 接入前需补 worker liveness/订阅超时 + runtime_logs 统一脱敏路径。

## 下一步动作

P1-RT 里程碑 milestone-audit / complete；真实 executor（CLI spawn / 容器执行）接入与 worker 池水平扩展为后续独立范围。
