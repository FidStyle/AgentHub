# Milestone: M-adhoc-20260530-role-chat-uat-reply — Ad-hoc: ROLE-CHAT-UAT-REPLY (真实回复闭环 + UI 可用性 UAT)

**Completed**: 2026-05-30
**Type**: adhoc
**Artifacts**: 5 (analyze: 1, plan: 1, execute: 1, verify: 1, review: 1)
**Session**: ralph-20260530-190032

## Key Outcomes
- 关闭 ROLE-CHAT-CORE-001 在 P0 harness 下 deferred 的「可见 agent 回复 + 角色 Badge」P0 缺口。
- `/api/chat` 在 `runtime_completed && reply` 非空时落 `sender_type=agent`（no-fake-success：失败/不可用终态不伪造成功）。
- E2E harness `RUNTIME_E2E=1` 拉起 Redis + worker(FakeExecutor) 接同一 p0 DB，端到端验证可见回复 + role badge + reload 双向持久化。
- 修复 auth cookie 裸 token 取值（`split('=').pop()`），消除全 spec 401。
- 治理台账同步：REG-20260530-003（deferred 重定级 P0 后关闭）+ REG-20260530-001 关闭 + project-tracker ROLE-CHAT-UAT-REPLY-001 完成。

## Learnings
- 当 FakeExecutor 回显「系统提示 + 问题文本」时，reload 后裸文本定位会与 agent 回显串味；按用户气泡 class（`.bg-primary/10`）精确定位是 harness-agnostic 的稳妥做法。
- dev E2E 首次冷启动需预热：Next.js 按需编译 `/api/chat`+`/api/messages` 叠加 worker `dequeue(5)` 轮询，首个 job 可见回复可能逼近 30s 断言上限；预热后稳定。
- 全量 vitest 既有 7 失败需用 `git stash` baseline 对照确认与本次改动无关，避免误判回归。

## Next Milestone
Ad-hoc task complete — 无后续里程碑（adhoc 自包含）。
