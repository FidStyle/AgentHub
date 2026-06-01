# PRD 反查实现审计规范

> 用于从 `research/prd.md` 反推代码实现，系统性发现两类问题：PRD 要求已经进入 P0 但代码没有真实落实；PRD 或当前产品不再支持，但 UI、测试、文档、未挂载组件或静态数据仍保留，造成假完成或误导验收。

## 1. Scope / Trigger

触发本规范的场景：

- 用户要求“看还有什么没完成、假通过、TODO、未落实”。
- 某个功能已在 tracker/report 中标记完成，但用户发现真实入口不可用。
- 删除或质疑一个入口后，需要判断是否存在同类残留。
- 准备验收前，需要从 PRD 而不是从现有实现倒推完成度。

本规范不以 `.workflow/.maestro/*/status.json`、历史 execution report、测试通过数或组件存在为事实源。事实源优先级：

1. `research/prd.md` 的 P0 FR 验收标准。
2. 当前产品设计和 PRD amendments。
3. 实际代码入口、API、DB schema、runtime 路由、E2E 断言。
4. 最近一次可复现测试证据。

## 2. Signatures

审计每个 FR 时必须形成统一条目：

```text
FR-ID:
PRD expected:
Implementation evidence:
Runtime/data evidence:
User entry:
Tests:
Classification:
Decision:
```

`Classification` 只能取以下值：

- `implemented_verified`: 有真实入口、真实数据/API/runtime、可复现测试和刷新/重读证据。
- `implemented_unverified`: 代码看似实现，但缺少可复现主链路证据。
- `partial_shell`: 有 UI/API 壳，但没有核心业务执行或状态闭环。
- `missing_required`: P0 要求缺失。
- `stale_or_ghost`: PRD 不支持或当前不应展示，但仍残留 UI、测试、文档、组件、静态 seed 或假数据。
- `out_of_scope`: 明确属于 P1/P2/P3，不能作为 P0 通过或失败依据。

## 3. Contracts

### PRD 必做但未落实

如果 PRD P0 写明用户可以完成某动作，代码必须同时满足：

- 有用户可到达入口，不是只存在 API 或未挂载组件。
- 有真实后端或本地 runtime 行为，不是只改 local state。
- 有权限/执行域校验，不能只信前端。
- 有持久化或可重读证据，刷新后状态不丢。
- 有失败/离线/无权限中文错误态。

任一缺失时，不能在 tracker/report 写“完成”，只能写 `partial_shell` 或 `implemented_unverified`。

### PRD 不支持但还残留

以下都视为 `stale_or_ghost`：

- 未挂载组件、旧页面、旧测试仍包含可执行入口语义。
- 静态 seed 假装来自真实授权、通知、最近会话或执行记录。
- 文档仍要求一个已删除或不该存在的 P0 入口。
- E2E 仍断言已废弃 test id、旧文案或旧状态。
- UI 中展示 P1/P2 能力但没有 disabled、中文原因和真实边界。

处理原则：

- 能删就删：入口、页面、测试、文档一起删。
- 暂不能删就显式降级：加中文不可用原因、P1/P2 标签、不可点击状态，并登记到台账。
- 不能把静态样例、local activity、默认 seed 当作真实用户数据。

## 4. Validation & Error Matrix

| 审计发现 | 必须处理 | 禁止处理 |
| --- | --- | --- |
| PRD P0 功能只有 UI 壳 | 登记 `partial_shell`，补真实链路任务 | 把按钮可见写成完成 |
| API 没有 owner/workspace/session 校验 | 登记安全缺陷，阻塞验收 | 只靠前端隐藏入口 |
| 报告说已修但代码仍不满足 | 标记 report/code drift，优先修代码或修报告 | 继续引用旧报告证明通过 |
| 入口不该存在但还在 | 删除或显式 disabled + 说明 | 保留为“以后可能用” |
| 未挂载组件仍包含旧产品语义 | 删除或迁移到真实入口 | 让 grep/测试误判为已实现 |
| E2E skip/mock 被计入通过 | 报告中排除 passed 统计 | 合并成“全绿” |

## 5. Good/Base/Bad Cases

- Good：`FR-NOTIFY-001` 审计发现 Web/Mobile 有通知 API 和 Mobile 审批页，但 Desktop 只显示 local seed 授权记录，于是分类为 `partial_shell + stale_or_ghost`，要求接真实 `/api/notifications` 或删除假授权记录。
- Base：`FR-RUNTIME-201 OpenCode` 属 P2/P3，Desktop 显示“待接入”且不可进入会话，分类为 `out_of_scope`，不算缺陷。
- Bad：PRD 要求“多 Role Agent 群聊”，代码只有单选 `selectedRole`，报告仍写“@角色通过”，这是 `missing_required`，不能被单角色 E2E 覆盖。

## 6. Tests Required

PRD 反查审计输出至少包含：

- P0 FR 覆盖矩阵：每个 FR 至少一行。
- 代码证据：文件路径、函数/组件/API 名称。
- 测试证据：已有测试能证明什么，不能证明什么。
- 两类问题分开列：`missing_required` 与 `stale_or_ghost`。
- 修复优先级：安全/数据越权、主用户旅程、假入口、测试假绿。
- 明确未实测范围：本轮未运行的 E2E、外部登录、真实 CLI、模拟器、worker 必须写出。

## 7. Wrong vs Correct

### Wrong

```text
Desktop 最近会话有页面和测试，所以 FR-DESK-001 的 Session 入口完成。
```

问题：页面从本地 activity 拼数据，不是 PRD 的 Workspace/Session 真实会话恢复。

### Correct

```text
Desktop 最近会话分类为 stale_or_ghost：
- PRD 当前要求 Desktop 展示本地 Agent 轻量运行态，不承担跨 Workspace Session 管理。
- 代码证据：入口从 activity message 派生，不接 sessions API/native session。
- 决策：删除入口、页面、测试；真实会话恢复另起需求。
```

