# Milestone: adhoc-role-chat-runtime-deliver — ROLE-CHAT-RUNTIME-DELIVER (REG-20260530-006)

**Completed**: 2026-05-30
**Type**: adhoc (single-phase, standalone)
**Commit**: eed577f
**Artifacts**: 2 registered (analyze: 1, plan: 1) + execute/verify/review/uat evidence in archive

## Key Outcomes

修复角色对话 public_cloud 真实交付闭环（REG-20260530-006）：

- gateway public_cloud 分支改用 `resolveEndpoint` 的 status/id + 活跃 worker 在线键门控，不再仅凭 `REDIS_URL`。
- 无 worker / unconfigured 立即短路为明确中文错误态（实测 <2s，消除原 60s idle 空等），不再 enqueue 无消费者的死任务。
- 有真实 Redis + worker 时消费队列，回流可见的非 echo agent 回复并落 `messages` 表，reload 后 user+agent 双向持久化。
- 新增确定性非回显 `ScriptedRealExecutor`（区别于回显输入的 `FakeExecutor`），用于无需付费 CLI 的真实交付路径验证。
- 两条默认不可跳过 E2E（无 worker→立即错误态 / 真实 worker→可见回复+reload），真实浏览器 + DB/auth + Redis + worker。

## Verification

- 单元 21/21 通过（含 gateway-gating 正反三路：unconfigured / 无 worker / worker 在线）
- E2E-A（role-chat-no-worker）+ E2E-B（role-chat-uat-reply）真实环境全绿
- apps/web tsc --noEmit exit 0
- verify passed=true（6 truths VERIFIED, gaps=[]）、review verdict=PASS、UAT 2/2、milestone-audit PASS（0 gaps）
- 子目标 G1/G2/G3 全部 done

## Learnings

- public_cloud 运行时门控不能仅凭 `REDIS_URL` 环境变量——必须探测活跃 worker 在线键，否则无消费者时请求会空等到 idle 超时，并可能被误判为成功。生产者（worker `setWorkerAlive`）与消费者（gateway `isWorkerAlive`）必须共用同一模块级常量 `workerAliveKey`，避免字面量重复导致静默失配。
- 在线键 TTL（默认 15s）必须 > worker 刷新间隔（dequeue 超时 5s），否则键会在 worker 存活期间中途过期。
- E2E 默认不可跳过（fail-loud beforeAll 而非静默 skip），防止主链路可见回复断言被环境变量掩盖。
- 交付路径验证用非回显的 ScriptedRealExecutor，避免 FakeExecutor 回显冒充“完成”。

## Next Milestone

Ad-hoc task complete — 无后继里程碑（adhoc 自包含）。
