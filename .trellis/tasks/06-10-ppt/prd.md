# 修复权限状态与文档/PPT路由

## Goal

修复真实用户在 AgentHub Web 工作台中遇到的两个主链路问题：权限模式刷新/续跑状态不可靠，以及“生成文档和 PPT”被误路由到后端工程师而不是演示稿/PPT 角色。修复后必须能用真实 OpenCLI 浏览器路径、GitHub 登录和人工授权跑完整流程。

## What I already know

- 用户实测标准权限允许后，后台 runtime/actions 已经完成，但前台计划卡和过程视图不实时收敛，刷新后才读回 completed。
- `ChatPanel` 当前用本地 `useState('standard')` 保存权限模式，刷新后会丢失选择。
- 审批卡允许/拒绝后只轮询 `/api/messages`，而编排面板和过程视图依赖 actions/plans/timeline 读回和 `actions:changed` / `messages:changed` 事件。
- 默认“后端工程师”带有 `ppt_master`，而 `/api/chat` 的 presentation 目标匹配把 `ppt_master` 工具当成匹配条件，导致后端可能抢走 PPT 任务。
- 产品契约要求 PPT intent 路由到 `演示稿工程师`，`产物助手` 只负责登记、预览、下载、发布状态和回链。

## Requirements

- 权限模式在当前 session 内可持久读回；刷新后 composer 显示上次选择。
- 标准权限审批后，消息、权限卡、actions、plans、timeline 都能在不刷新页面的情况下逐步读回最新状态。
- 文档/PPT prompt 必须路由到演示稿/PPT 角色；纯文档/PPT任务不得出现后端工程师执行节点。
- 现有数据库中后端角色即便已有 `ppt_master`，也不能仅凭工具 ID 被误判为 presentation 角色。
- 默认角色配置中后端工程师不应默认带 `ppt_master`。

## Acceptance Criteria

- [ ] 发送 `帮我生成一个文档和一个PPT。内容简单介绍一下字节跳动` 时，计划节点为 `架构师规划 -> 演示稿工程师执行 -> 产物助手收口 -> 架构师汇总`，且不包含 `后端工程师执行`。
- [ ] 标准权限审批允许后，当前页面不用刷新也会更新权限卡、编排计划和过程 timeline。
- [ ] 刷新后权限模式仍显示当前 session 上次选择。
- [ ] 单元/API/组件测试覆盖权限刷新事件、权限模式持久化和 PPT 角色路由。
- [ ] OpenCLI UAT 前通知用户看屏；GitHub 登录/OAuth 和权限审批由用户手动完成。

## Definition of Done

- 相关测试通过。
- Web type-check 通过，或明确记录阻塞原因。
- 未执行 OpenCLI 前不得声称真实 UAT 已通过。

## Out of Scope

- 不实现完整 Office 级 PPT 编辑。
- 不做 workspace 全局 full-control 持久化；权限模式仅按当前 session 保存，避免高权限泄漏到其他会话。
- 不自动越过 GitHub 登录、OAuth、2FA 或敏感权限确认。

## Technical Notes

- 相关合同：`research/contracts/ARTIFACT-ASSISTANT-CLOSURE-2026-06-10.md`、`research/contracts/RICH-DOC-PPT-ARTIFACTS-2026-06-03.md`。
- 相关规范：`.trellis/spec/frontend/component-guidelines.md`、`.trellis/spec/backend/runtime-workspace-contract.md`、`.trellis/spec/cross-layer/im-conversation-artifact-contract.md`、`.trellis/spec/cross-layer/real-flow-acceptance.md`、`.trellis/spec/cross-layer/role-agent-tools-contract.md`。
- 主要代码：`apps/web/components/workspace/ChatPanel.tsx`、`apps/web/components/workspace/MessageContent.tsx`、`apps/web/store/session-store.ts`、`apps/web/app/api/chat/route.ts`、`apps/web/config/role-agents/defaults.json`、`apps/web/lib/orchestrator/dag-generator.ts`。
