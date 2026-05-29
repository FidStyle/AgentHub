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

### REG-20260530-001 — Web Workspace 真实交互闭环缺口

| 字段 | 内容 |
| --- | --- |
| **类型** | bug / unfinished / UX regression |
| **优先级** | P0 regression |
| **状态** | open |
| **关联 FR/PRD** | `FR-WEB-001`, `FR-WS-001`, `FR-CHAT-001`, `FR-UI-001`; `research/prd.md` 的 Web 工作台、Workspace/Session/Message、Agent 协作主链路 |
| **关联任务/合同** | `P0-END-TO-END-PRODUCT-FLOW`; `UI-ALIGN-001`; `research/contracts/P0-END-TO-END-PRODUCT-FLOW.md`; tracker 任务 `WEB-WORKSPACE-UX-001` |
| **影响功能面** | Web 登录后工作台；Workspace 详情页；Session 创建/选择；Message 拉取/发送；`/api/chat` runtime/agent 链路 |
| **发现方式** | 用户验真样本 + 代码审查 |
| **证据** | `apps/web/app/(workspace)/workspace/[id]/page.tsx` 未读取 URL workspace id；`apps/web/components/workspace/Sidebar.tsx` 默认选第一个 workspace 且“新建会话”无 `onClick`；`apps/web/store/session-store.ts` 的 `setActiveSession` 不拉消息，`sendMessage` 只写 `/api/messages` 而不走 `/api/chat` |
| **为什么此前漏掉** | 旧 E2E/验收口径允许“按钮可见/页面存在/布局无横向滚动”通过，没有强制断言真实点击后 API/DB/session/message/runtime 状态变化 |
| **关闭条件** | 使用 Auth.js 测试登录态打开 `/workspace/:id`，断言 URL workspace 被选中；点击“新建会话”真实 `POST /api/sessions` 并选中新 session；点击 session 真实拉取 `/api/messages`；发送消息走 `/api/chat` 并展示 runtime/agent 状态或明确错误态；reload 后 session/message 持久化；补 Playwright E2E 和必要 store/component 测试 |
| **下一步** | 启动 `WEB-WORKSPACE-UX-001` 修复 session；修复前不继续扩大 Web Workspace 新功能 |

## 关闭记录

暂无。
