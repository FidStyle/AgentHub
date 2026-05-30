# 回归、缺陷与未完成项台账

> 文档注释：本文件不是执行报告，也不是临时 TODO。它是 AgentHub 已完成功能面暴露出的 bug、未完成项、不完善项和质量债的长期台账。每一条必须挂钩到 PRD/FR、已完成任务或合同、受影响功能面、验证方式和关闭条件。新功能推进前必须先检查本文件是否存在阻塞级未关闭项。

## 使用规则

1. 已声明完成的功能，如果用户或审计发现真实链路不可用、点击无效、数据未闭环、状态不一致、测试未覆盖，应先登记到本文件。
2. 每条记录必须至少包含：ID、类型、优先级、状态、关联 FR/PRD、关联任务/合同、影响面、发现方式、证据、关闭条件、下一步。
3. `P0 regression` 和 `P0 blocker` 默认阻塞继续扩大同一功能面；除非用户明确接受风险，否则应先修复。
4. 修复完成后，不能只改状态；必须补测试证据、execution report、tracker 记录和中文 commit。
5. Maestro/Ralph/Codex 完成功能后，应检查本文件并补登新发现问题；不得只写在聊天或 `.workflow/.maestro/*/status.json`。

## 状态定义

| 状态 | 含义 |
| --- | --- |
| `open` | 已确认存在，尚未进入修复 |
| `in_progress` | 已进入修复/验证 session |
| `blocked` | 需要外部条件或用户决策 |
| `fixed_pending_verify` | 已修复，等待真实链路验证 |
| `closed` | 修复、验证、报告、tracker、commit 全部完成 |

## 当前未关闭项

> REG-20260530-001（Web Workspace 真实交互闭环缺口）与 ROLE-CHAT-CORE-001 可见 agent 回复 deferred 项（重定级 REG-20260530-003）均已修复并移入「关闭记录」。当前仅余 P1 test-infra 项 REG-20260530-002。

### REG-20260530-002 — Web E2E 共享单用户并行 worker 数据污染（既有套件脆弱性）

| 字段 | 内容 |
| --- | --- |
| **类型** | test-infra fragility |
| **优先级** | P1 |
| **状态** | open |
| **影响功能面** | `e2e/tests/web/*`（尤其 `role-chat-core.spec.ts:35`、`p0-workspace-flow.spec.ts`）依赖在共享单一 P0 测试用户的 workspace 列表中查找“刚创建”项 |
| **发现方式** | WEB-WORKSPACE-UX-001 verify 阶段并行运行 web-desktop+web-tablet 时暴露 |
| **证据** | `fullyParallel:true` + 本地多 worker 下，多 spec 在同一用户累积 36+ workspace；`role-chat-core.spec.ts` line 35 `getByRole('button',{name:wsName}).click()` 在列表中找不到刚建 workspace。移除 WEB-WORKSPACE-UX 新 spec 后 ROLE-CHAT 仍 2/2 失败 → 与本次改动无关 |
| **为什么不在 UX-001 内修** | 属测试隔离/夹具设计问题，跨多个既有 spec，超出 WEB-WORKSPACE-UX-001（deep-link/拉消息行为）边界；CI 用 `workers:1` 可规避，本地多 worker 才触发 |
| **关闭条件** | 为共享 DB 状态的 web spec 提供按 spec 隔离的夹具（独立用户或 per-test 清理/重新 seed），或将 workspace-mutating web spec 配置为同 worker 串行；确保本地多 worker 与 CI 均稳定 |
| **下一步** | 单列 test-infra 任务处理；不阻塞 WEB-WORKSPACE-UX-001 关闭 |


## 关闭记录

### REG-20260530-003 — ROLE-CHAT-CORE-001 可见 agent 回复 + 角色 Badge deferred（重定级 P0 后关闭）

| 字段 | 内容 |
| --- | --- |
| **类型** | unfinished / UX gap |
| **优先级** | P0 blocker（自 ROLE-CHAT-CORE-001 deferred 项重定级——用户 @角色发送后无可见回复属主链路阻塞，非可选增强） |
| **状态** | `closed` |
| **关联 FR/PRD** | `FR-CHAT-001`, `FR-WEB-001`, `FR-RUNTIME-001`, `FR-UI-001` |
| **关联任务/合同** | 发现于 `ROLE-CHAT-CORE-001`（`research/project-tracker.md` 同名条目 + `research/execution-reports/role-chat-core-report.md#6`）；由 `ROLE-CHAT-UAT-REPLY-001` 修复关闭 |
| **影响功能面** | Web `/api/chat` 角色对话：@架构师发送后可见 agent 回复 + 角色上下文标识 + reload 持久化 |
| **发现方式** | 用户验真样本（2026-05-30，localhost:3000 @架构师发送后只见用户消息）+ ROLE-CHAT-CORE-001 报告 §6 显式登记的 deferred 切片 |
| **为什么重定级** | 原 deferred 理由是「P0 harness 无 Redis/worker」，但可见 agent 回复是角色对话主链路的核心交付，不是可选增强；归类为 P0 blocker 而非延后增强 |
| **证据** | `cd e2e && RUNTIME_E2E=1 npx playwright test --project=web-desktop web/role-chat-uat-reply.spec.ts web/web-workspace-ux.spec.ts web/role-chat-core.spec.ts` → 3 passed（真实 DB+Redis+worker，无 mock，DB 校验 messages 同含 user+agent 行）；verification.json PASS（5/5）；review.json PASS（0 critical/0 high）；`research/execution-reports/role-chat-uat-reply-001-report.md` |
| **关闭条件（已满足）** | `/api/chat` 在 `runtime_completed && reply` 非空时落 `sender_type=agent`（no-fake-success）；E2E 拉起 Redis+worker 断言可见回复文本 + role badge + reload 双向持久化；单测 AT-005/AT-006 覆盖正反两路 |
| **关闭时间** | 2026-05-30 |

### REG-20260530-001 — Web Workspace 真实交互闭环缺口（已关闭）

由 `WEB-WORKSPACE-UX-001`（URL workspace 选中 / Sidebar 不覆盖 / setActiveSession 拉消息 + deep-link E2E）与 `ROLE-CHAT-CORE-001`（`sendMessage→/api/chat`、新建会话 onClick）联合修复，并由 `ROLE-CHAT-UAT-REPLY-001` 在真实 DB+Redis+worker E2E 下端到端复验通过（`web-workspace-ux.spec.ts` 含 `GET /workspace/:id` → `/api/sessions` → `/api/messages` → `POST /api/chat 200` + 视觉 + reload 断言）。关闭时间：2026-05-30。
