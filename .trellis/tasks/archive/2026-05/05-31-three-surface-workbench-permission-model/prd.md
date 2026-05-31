# 三端会话工作台与权限模型修订

## Goal

将本轮产品讨论沉淀为可执行的 PRD amendment 和共享合同，明确 AgentHub 三端会话工作台、权限模式、授权入口、Desktop 本机策略、Mobile 远程监督和参考项目迁移原则。

## What I Already Know

- 用户确认 Desktop 不应做审批中心，也不应在 Web/Mobile 授权后弹二次确认。
- 用户确认 Cloud Runtime 和 Desktop Runtime 应有各自策略，但事实源需要统一。
- 用户确认 Web/Mobile 是统一授权入口，Desktop 负责本机策略、Runtime、执行日志和越权授权记录。
- 用户确认 Mobile 应参考 OpenAI Codex，作为远程监督控制端，不只是审批页。
- 用户确认 Web/Desktop 可参考 codeg/AionUi 的桌面级 Agent 工作台风格。
- 用户确认参考项目优先，不从零设计；最终用 AgentHub 数据模型和统一视觉系统重写。

## Requirements

- 新增共享合同：`research/contracts/THREE-SURFACE-WORKBENCH-PERMISSION-001.md`。
- 新增 PRD amendment：`research/prd-amendments/2026-05-31-three-surface-workbench-permission-model.md`。
- 明确三端职责：
  - Web：完整 Session 工作台。
  - Desktop：本机 Host/策略/Runtime/日志。
  - Mobile/PWA：远程监督控制端。
  - 后端：策略事实源、授权记录、审计和状态同步。
- 明确权限预设：沙箱、标准、自动执行、完全控制。
- 明确权限状态：可执行、需要授权、已取消、安全阻断。
- 明确 `Context / Changes / Artifacts` 右侧面板与 Message/Run 双向关联。
- 明确参考项目迁移原则和组件迁移清单要求。

## Acceptance Criteria

- [ ] PRD amendment 状态为 `confirmed`，记录本轮用户确认。
- [ ] 共享合同覆盖三端职责、数据模型、权限语义、UI/UX、参考项目输入、测试验收和禁止项。
- [ ] `research/index.md` 和相关 README 能找到新合同/修订。
- [ ] 文档不再把 Desktop 审批中心作为后续正确方向。
- [ ] 后续实现可以直接引用合同拆分 Web/Desktop/Mobile 工作项。

## Out of Scope

- 本任务不实现 UI 和 API。
- 本任务不直接合并修改 `research/prd.md` 全文。
- 本任务不引入参考项目代码。
- 本任务不决定具体 diff/artifact 第三方库。

## Technical Notes

- 相关现有文档：
  - `research/prd.md`
  - `research/product/product-design.md`
  - `research/product/ui-design-system.md`
  - `research/product/desktop-p0-ui-ux-contract.md`
  - `research/architecture/technical-design.md`
- 当前 Desktop 存在静态审批 store 和 UI：
  - `apps/desktop/src/renderer/store/console-store.ts`
  - `apps/desktop/src/renderer/components/shell/DesktopApprovalsPage.tsx`
  - `apps/desktop/src/renderer/components/console/ApprovalPanel.tsx`
