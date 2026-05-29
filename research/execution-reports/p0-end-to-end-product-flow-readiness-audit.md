# P0-END-TO-END-PRODUCT-FLOW 准备审计报告

> 日期：2026-05-28  
> 执行者：Codex  
> 范围：Maestro/Ralph 盲验证前的合同与验收体系准备  
> 结论：当前项目已有大量页面级和入口级测试，但端到端产品主链路门禁不足，必须先用共享合同和验真样本约束后续 Maestro/Ralph 分析。

---

## 1. 审计目标

本次不修登录、不修 Workspace、不修 UI。目标是确认现有流程为什么会把主链路问题漏过去，并为后续 Maestro/Ralph 盲验证准备合同和审计口径。

---

## 2. 已检查输入

- `bytedance_init_prd.md`
- `research/prd.md`
- `research/architecture/technical-design.md`
- `research/workflow/ai-workflow-control.md`
- `research/project-tracker.md`
- `research/execution-reports/p0-acceptance-report.md`
- `e2e/tests/desktop/p0-entry-points.spec.ts`
- `e2e/tests/web/p0-workspace-flow.spec.ts`
- `e2e/tests/workspace.spec.ts`

---

## 3. 关键发现

### 3.1 现有 E2E 偏页面/入口级，不是产品链路级

`e2e/tests/desktop/p0-entry-points.spec.ts` 主要验证按钮点击后有 popup 或错误反馈，不能证明登录后身份在 Web/Desktop 间连续，也不能证明用户能进入 Workspace/Session/Message 主路径。

`e2e/tests/web/p0-workspace-flow.spec.ts` 主要验证首页按钮、Workspace 页面标题、对话框、三栏壳和发送按钮状态。它没有验证真实登录态、真实数据库创建、Session 创建、消息发送和刷新后持久化。

`e2e/tests/workspace.spec.ts` 通过 `page.route('**/api/workspaces')` mock API 响应。它适合组件/页面交互测试，但不能作为 P0 主链路完成证据。

### 3.2 报告完成口径过低

`research/execution-reports/p0-acceptance-report.md` 把 “19 tests listed” 和 “入口点击语义修复” 作为验收结果，但没有证明 19 个测试真实运行通过，也没有证明端到端用户链路通过。

`research/project-tracker.md` 中 `P0-ACCEPT-001` 当前标记为全部完成，但其验收方式是 type-check、convergence criteria、`playwright test --list` 和 review PASS。这不足以覆盖真实登录、DB、Workspace、Session、Message 和三端状态一致性。

### 3.3 主链路数据真实性没有被门禁强制

PRD 和技术设计都要求 Auth.js + GitHub OAuth + local Postgres，Workspace/Session/Message 必须落真实数据库。但现有测试允许 mock `/api/workspaces` 通过页面流程，无法发现产品运行时是否存在 mock 数据、未授权、DB adapter 错误或 schema 缺失。

### 3.4 三端职责和状态一致性没有形成一条验收链

PRD 明确 Web 是主工作台，Desktop 是本地能力端，Mobile 是轻量端。现有测试分别验证页面片段，但没有一条测试把三端放到同一用户、同一 Workspace、同一 Session 数据模型下验证。

---

## 4. 流程门禁缺口

| 缺口 | 影响 | 后续要求 |
| --- | --- | --- |
| E2E 从页面开始，不从真实用户入口开始 | 登录后状态断裂、跳转错误、设备绑定失败可能漏检 | 合同必须要求从启动/登录/Workspace/Session/Message 一条链覆盖 |
| 使用 API mock 证明 Workspace 创建 | 无法证明真实 DB、鉴权、schema 和 adapter 正常 | 主链路测试必须使用真实 DB 或测试 DB |
| 只 `--list` 测试 | 测试可发现但未执行，无法作为通过证据 | 报告必须写真实运行命令和结果 |
| Maestro status/report 与真实用户链路脱节 | 可能出现 `status.json completed` 但产品不可用 | Codex 验收必须回到共享合同逐项核对 |
| 用户已知 bug 直接变成修复 prompt | 执行系统可能被喂答案，无法验证流程发现能力 | 已知问题先登记为验真样本，盲验证不暴露根因 |

---

## 5. 准备产物

已新增共享合同：

- `research/contracts/P0-END-TO-END-PRODUCT-FLOW.md`

合同包含：

- MVP 主用户链路。
- Web/Desktop/Mobile 职责边界。
- 真实数据库和 API 要求。
- UI/UX 闭环要求。
- Maestro/Ralph 派生要求。
- 测试与人工验收路径。
- 验真样本池。

---

## 6. 给 Maestro/Ralph 前的建议

下一步应让 Maestro/Ralph 做盲验证，而不是实现：

1. 读取 `research/workflow/ai-workflow-control.md`。
2. 读取 `research/contracts/P0-END-TO-END-PRODUCT-FLOW.md`。
3. 读取 PRD、技术设计、测试约定和现有 E2E。
4. 自行分析当前代码、测试、报告是否满足合同。
5. 输出主链路缺口、证据、影响面和修复计划。

不要在 prompt 中预置登录端口、cookie、callback、renderer 状态或具体已知根因。

---

## 7. 当前状态

本审计只完成 Maestro/Ralph 前置准备，不代表主链路已通过。后续必须以盲验证结果判断框架是否能自行发现验真样本。

