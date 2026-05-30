# Milestone Audit — adhoc-role-chat-core

> Type: adhoc · Session: ralph-20260530-054910 · Date: 2026-05-30
> Task: ROLE-CHAT-CORE-001 Web Workspace 角色对话核心链路

## Verdict: **PASS** (0 critical / 0 high)

> review.json verdict=WARN（3 medium / 2 low 健壮性增强项，非阻塞），critical/high 均为 0，满足 milestone-complete 非 FAIL/BLOCK 门槛。

## 范围与目标
在仅 Web 端、不重开编排调度、复用既有 Runtime Gateway 链路前提下，落地角色对话核心链路：G1 role_agents CRUD + 默认架构师 seed + `/api/chat` 角色校验与 system_prompt 注入；G2 结构化验证 + 代码评审；G3 业务/自动化测试覆盖；G4 真实 DB E2E（创建→@→runtime→持久化→reload 保留角色上下文）。

## Artifact 链
| 阶段 | Artifact | 状态 |
|------|----------|------|
| analyze | ANL-role-chat-core | completed |
| plan | PLN-role-chat-core (standalone) | completed |
| execute | d0cbd06（/api/chat 角色链路 + role_agents + jsonb 修复 + @选择 UI） | completed |
| verify | verification.json | passed（T1-T8 全 VERIFIED，0 gaps） |
| review | review.json | WARN（0 critical / 0 high，3 medium / 2 low 非阻塞） |
| auto-test | .tests/auto-test/report.json | 5/5 PASS（L0×1 / L1×4 / L3×1） |
| test | uat.md | role-chat-core E2E 1 passed（web-desktop 真实 DB） |

## 跨阶段一致性检查
- ✅ 契约一致：`/api/chat` 复用既有 SSE + Runtime Gateway 路由；`systemPrompt` 透传 adapter→gateway→job→worker→executor，缺省回退旧行为（向后兼容）；`runtime_sessions.role_agent_id` 为 additive nullable 列（契约纠正，非破坏）。
- ✅ 无回归：runtime executor 单测 7/7 复绿；vitest runtime + role-agents 37/37；type-check 干净；7 个全量套件预存失败为既有中英文断言漂移（git stash 基线对照一致），与本特性无关。
- ✅ 验收闭环：verify(T1-T8 VERIFIED) → review(WARN 0critical/0high) → auto-test(5/5) → E2E(1 passed) → goal-audit(G1-G4 all MET) 全门通过。
- ✅ 缺陷暴露：quality 阶段经 E2E 发现并修复 2 个单测/业务测试 mock 漏过的真实缺陷（会话创建 UI 不可达、jsonb 写库 500）。

## 四项目标达成
| 目标 | done_when | 证据 |
|------|-----------|------|
| G1 | plan/execution 子任务 completed + lint/type 通过 | verification.json T1-T8 VERIFIED |
| G2 | verification passed=true 且 review verdict≠BLOCK | passed=true + WARN(0critical/0high) |
| G3 | auto-test report 全绿，覆盖创建架构师/@发送/角色展示 | report.json 5/5 + AT-005 E2E |
| G4 | uat.md 全 passed 且 reload 后 role_agent_id/角色展示断言通过 | uat.md E2E 1 passed(7.9s) reload 保留 |

## 边界遵守（用户约束）
- ✅ 仅 Web；未实现编排调度；未重开已完成里程碑。
- ✅ runtime_sessions.role_agent_id 为 additive nullable 列，未破坏既有 schema 契约。
- ✅ 禁假成功：P0 harness 无 Redis/worker → agent 回复角色 Badge 切片 deferred 并在 uat.md/执行报告显式登记，未用 skip/ts-ignore 伪装；G4 done_when 核心（reload 持久化 + @角色选择）已真实覆盖。

## 治理门禁
`bash scripts/verify-governance-gate.sh ROLE-CHAT-CORE-001` → exit 0（milestone-complete 前已运行确认，9/9 检查全过，工作区干净）。

## Critical / High Issues
无。

## 残留跟进（非阻塞）
- review WARN 3 medium：RV-001 messages insert 未检查 error / RV-002 runtime_sessions 空 id 吞错 / RV-003 客户端未处理错误终态事件 → 纳入 P1-RT。
- review WARN 2 low：RV-004 切 workspace 后 selectedRole 未清空 / RV-005 system_prompt 缺约束。
- agent 回复角色 Badge E2E 断言在 Redis+worker 环境补齐。
