# 当前方向文档收敛报告

## 范围

本轮只更新产品、技术、合同、tracker 和验收规范文档，不修改业务代码。

目标是把 2026-06-10 用户确认的方向写入长期事实源：

- `产物助手` 作为产品交付收口角色。
- 对话式创建 Agent 回到聊天流或专门 `Agent 创建助手`，右侧面板只做查看/编辑。
- 标准/非完全权限必须显示权限卡；完全权限自动通过也必须显示审计卡。
- 产物、Git diff、iframe/web preview、publish status 必须进入 IM 内联结果卡并同步 durable artifacts。
- 后续 fresh fail marker 不能被历史 pass 覆盖。

## 当前状态更正

历史 pass 仍保留：

- `BYTEDANCE-CURRENT-FINAL-1781025161`：full-control pass，78/0/0。
- `BYTEDANCE-PERMISSION-FINAL-1781025780`：manual permission pass，38/0/0。

但后续本地工作区出现更新的 fresh fail 证据，因此 Bytedance P0/P1 gate 已重新打开：

| Marker | 状态 | 具体卡点 |
| --- | --- | --- |
| `STRICT-SPD-1781034360339-3a63e1` | FAIL，65/12 | `finalArtifactId=null`，plan 仍 `running`；生成项目 `npm test` 缺 `supertest`；SSE 最终 timeout。 |
| `PERMISSION-BRANCH-1781034038005-a684c9` | FAIL，1/2 | preflight 失败：需要 real runtime executor 和 live runtime worker。 |
| `PERMISSION-BRANCH-1781034095538-b05c35` | FAIL，8/4 | allow/reject prompt 被对话式 Agent 草稿路径截走，只生成 `agent_draft` result card，未进入权限审批链路。 |

## 文档改动

- 新增合同：`research/contracts/ARTIFACT-ASSISTANT-CLOSURE-2026-06-10.md`。
- 更新总账：`research/project-tracker.md`、`research/sequential-execution-progress.md`、`research/regression-ledger.md`。
- 更新产品/技术事实源：`research/prd.md`、`research/product/product-design.md`、`research/architecture/technical-design.md`。
- 更新验收规范：`research/contracts/BYTEDANCE-P0-P1-REAL-STEP-UAT.md`、`.trellis/spec/cross-layer/real-flow-bytedance-uat.md`、`.trellis/spec/cross-layer/real-flow-product-delivery.md`、`.trellis/spec/cross-layer/runtime-gateway-permission-wait.md`、`.trellis/spec/cross-layer/im-conversation-artifact-contract.md`。
- 更新索引：`research/index.md`。

## 下一步工程入口

1. 修复 generated product test dependency 或生成测试策略，确保 `npm test` 不因缺 `supertest` 失败。
2. 修复 runtime/plan 失败终态传播，禁止产物收口失败后 plan 持续 `running` 到 SSE timeout。
3. 修复 manual permission branch harness：preflight 必须有 real executor/live worker。
4. 修复聊天意图分类：权限验证/实现任务中出现“后端工程师”等角色名时不能误路由到 Agent 草稿创建。
5. 重跑 fresh full-control + manual allow/reject + Web/Mobile/Desktop readback。

## 未做

- 未修改业务代码。
- 未把未提交截图或 UAT 目录加入正式通过证据。
- 未声明 Bytedance P0/P1 完成。
