# Milestone: adhoc-worker-harden — Runtime worker 硬化

**Completed**: 2026-05-30
**Type**: adhoc (self-contained, no successor)
**Task**: RT-WORKER-HARDEN-001
**Artifacts**: 2 (analyze: 1, plan: 1) + execute via commits 14d0c73 + 7fd9633

## Key Outcomes
- **G1 worker liveness**：redis-client 心跳键 `agenthub:runtime:hb:{id}`（setHeartbeat/isAlive/clearHeartbeat，TTL 默认 30s）；worker running 入口 + 每 chunk 写心跳，终态清心跳；`reclaimDeadSession` 检出失联卡死会话 → 落 failed + emit runtime_failed，杜绝假 completed
- **G2 订阅双超时**：subscribeEvents 重写为带 idle（默认 60s）/ total（默认 600s）双 timer 的生成器（env 可配）；超时 yield runtime_failed 哨兵；finally 释放 timer/订阅/连接；gateway 据哨兵落 failed
- **G3 统一脱敏**：抽取共享 `redact`（既有 SECRET_KEY_PATTERN key 名匹配 + 新增 CREDENTIAL_VALUE_PATTERN 值级扫描 sk-/ghp_/xoxb-/AKIA/Bearer，global flag 仅用于 .replace 无 lastIndex bug），worker log() 与 gateway persist 两路径接入
- 验收全过：verify(G1/G2/G3 VERIFIED 0 gaps) → review(PASS 0 findings) → auto-test(18/18) → test(5/5 smoke) → goal-audit(all_met)；runtime suite 18/18

## Learnings
- 全局 flag 正则只配 `.replace()` 用，绝不与 `.test()` 混用——`.test()` 会推进 lastIndex 造成隔次漏匹配
- 心跳 TTL 必须 < 订阅 idle 超时，失联才能在订阅超时前被 reclaim 检出（30s < 60s）
- 异步生成器双超时用单 wake() 回调 + 标志位协调，比多 Promise.race 更易在 finally 里干净释放，消费者提前 break 也不泄漏

## Boundary Compliance
未改 Gateway 总架构与路由分支语义；未重开 P1-RT/RT-REAL-EXEC-001；纯 Redis 心跳键无 DB schema 迁移；无托管平台依赖；无真实付费调用；禁假成功（超时/失联落 failed）。

## Next Milestone
Project idle — adhoc 里程碑自包含，无后继。worker 池接入 + 真实端到端会话验证为后续独立范围。
