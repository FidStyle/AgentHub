# fix: 单 prompt 权限续跑完整链路

## Goal

修复 AgentHub 在 Bytedance 固定样本主链路中的权限续跑问题：用户只发送一次 `做一个加减乘除的简单网站，使用sqlite存储历史记录` 后，系统应由 Orchestrator 编排角色、在权限策略允许时自动推进，或在手动审批后继续原始任务链路，直到完成、失败或被用户明确拒绝。

## Source of Truth

- `bytedance_init_prd.md`：最高产品事实源。
- `bytedance_init_video_txt.txt`：辅助解释源。
- `research/prd.md`：FR-ID 注册表，尤其 `FR-ORCH-001`, `FR-ACTION-001`, `FR-PERM-001`, `FR-MOB-001`, `FR-NOTIFY-001`, `FR-ARTIFACT-001`。
- `.trellis/spec/cross-layer/real-flow-acceptance.md`：Bytedance 固定样本产品门禁。
- `.trellis/spec/backend/runtime-workspace-contract.md`：runtime workspace 与 approved native tool continuation 契约。

## What I Already Know

- 用户报告 `{"error":"角色不存在或无权限"}` 不算通过。
- 用户报告点击“允许单次执行”后没有继续往下运行。
- 之前剩余 P1 收口验证只证明了部分 action 能完成，不能证明单 prompt 到完整需求完成。
- 当前验收口径必须从 Bytedance 原始原则出发：Orchestrator 首先回复、指定前端工程师，涉及 SQLite/storage 时也应分派后端能力；权限、Git、文件树、代码引用、审批机制都必须能在三端读回。

## Requirements

- 自动权限模式：
  - 低/中风险、策略允许的动作不得卡在人工审批。
  - 需要审批但策略已经授权的动作应自动 approve/dispatch，并继续原始 plan/mailbox/runtime 链路。
- 手动权限模式：
  - 点击“允许单次执行”必须执行被批准的动作，并继续原始 plan node / mailbox / runtime session，直到下一个权限边界或最终完成。
  - 点击“拒绝”必须停止对应动作，不得执行副作用；plan/node/session 应进入等待用户下一次输入或明确 blocked/rejected 状态。
- 编排链路：
  - 单次发送固定样本 prompt 后，Orchestrator 必须先回复并创建可读计划。
  - 计划必须至少包含架构/Orchestrator、前端工程师、后端/存储能力和最终汇总/验收节点。
  - 权限审批后不能只完成孤立 action；必须能推进原始任务链路。
- 三端：
  - Web、Mobile/PWA、Desktop/Electron 或明确 fallback 都必须能读回同一 session 的 plan/action/permission/result 状态。
- 治理：
  - 更新 `research/regression-ledger.md` 和 `research/project-tracker.md`，纠正之前 P1 通过口径。
  - 更新 execution report 或追加修订，说明旧结论是 partial，新的通过证据是什么。

## Acceptance Criteria

- [ ] 固定样本 prompt 在 Web 中单次发送后，首个 assistant-visible 响应为 Orchestrator/architect 回复，并能看到前端工程师分派。
- [ ] 自动权限模式下，符合策略的权限动作自动继续，最终不因 pending action 停住。
- [ ] 手动权限模式下，点击“允许单次执行”后，原始 plan node/mailbox/runtime 继续推进。
- [ ] 手动权限模式下，点击“拒绝”后，不执行该动作，并保持等待用户下一次输入或明确 blocked/rejected。
- [ ] `{"error":"角色不存在或无权限"}` 不再作为正常链路结果；若出现必须作为失败处理并在 UI/API 中给出可行动错误。
- [ ] Web OpenCLI 覆盖 prompt、审批允许、拒绝、文件树/代码引用/Git 状态/最终 summary。
- [ ] Mobile/PWA OpenCLI 覆盖同一 session 的 plan/action/permission/result readback。
- [ ] Desktop/Electron OpenCLI 或 Playwright Electron fallback 覆盖 runtime supervision/readback，并说明 adapter 状态。
- [ ] 相关单元/API/runtime worker 测试覆盖 approve continuation、auto permission、reject stop。
- [ ] lint、type-check、聚焦测试通过；能运行的三端 E2E 均有证据。

## Out of Scope

- Demo 视频和 3 分钟素材。
- 尚未开始的 P2 富文档/PPT 完整编辑能力。
- 放宽 workspace isolation 来强行让固定样本通过。

## Technical Notes

- 重点检查：
  - `apps/web/app/api/actions/[actionId]/approve/route.ts`
  - `apps/web/lib/orchestrator/action-dispatcher.ts`
  - `apps/web/server/runtime-worker.ts`
  - `apps/web/app/api/chat/route.ts`
  - `apps/web/components/workspace/MessageContent.tsx`
  - `apps/web/store/session-store.ts`
- 旧的 deploy action 闭环不是本任务的充分验收证据。
