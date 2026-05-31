# THREE-SURFACE-WORKBENCH-PERMISSION-001 UI/UX Polish Report

**日期**：2026-05-31  
**任务**：`THREE-SURFACE-WORKBENCH-PERMISSION-001`  
**提交范围**：第二轮参考项目 UI/UX 对齐

## 变更摘要

- Web `ActionCard` 改为授权卡样式，展示动作类型、执行目录、风险、状态、命令预览和授权/取消动作。
- Web `PlanCard` 改为高密度运行计划卡，展示步骤数量、执行/失败计数、进度条、节点状态和确认动作。
- Web `ArtifactPanel` 强化为 `上下文 / 变更 / 产物` 工作台面板：
  - Context 合并固定消息、结构化上下文和 Role Agents。
  - Changes 展示编排面板、变更记录、文件列表和 Git diff 预览。
  - Artifacts 使用产物卡展示来源消息、类型和结构化 artifact。
- Web `ChatPanel` Composer 改成更接近 codeg/AionUi 的工具条形态，包含角色、附件、权限预设、附件 chips、权限说明和发送区。
- Web `SessionList` 增加搜索图标、计数 badge、当前会话状态和更稳定的会话项边界。
- Desktop `DesktopPolicyPage` 改成策略控制台布局，补充概览指标、当前策略摘要、策略源/授权端/审计状态和授权记录卡。
- Desktop `PolicyPanel` 增加策略摘要网格和授权记录密度。

## 参考项目对齐

- codeg：shadcn 工作台密度、命令/权限卡、composer 工具条、diff 预览信息层级。
- AionUi：Desktop 本机控制台、Agent/策略卡片、状态摘要和可操作面板密度。
- OpenAI Codex mobile/permission model：授权入口在 Web/Mobile 会话中，Desktop 只做本机策略和执行记录。

## 验证

- `pnpm --filter @agenthub/web type-check`：PASS
- `pnpm --filter @agenthub/desktop type-check`：PASS
- `pnpm --filter @agenthub/desktop test -- --run`：PASS，5 files / 23 tests
- 旧审批语义扫描：
  - `rg -n "ApprovalPanel|DesktopApprovalsPage|desktop-nav-approvals|desktop-approvals-page|待审批|批准|拒绝" apps/desktop apps/web e2e/tests/desktop --glob '!node_modules'`
  - 结果：应用与 E2E 中无旧审批 UI 命中；仅安全脚本保留“拒绝本地 IP”语义。
- Web 服务启动：
  - `pnpm --filter @agenthub/web dev`
  - `http://localhost:3000` 可访问。
- 轻量截图：
  - `e2e/artifacts/three-surface-ui-polish-home.png`
  - 当前环境未登录，截图覆盖登录首屏，不覆盖工作台内部视觉。

## 残留风险

- 本轮没有引入完整登录测试账号/seed，因此未采集 Web 工作台内部的 Playwright 视觉截图。
- `DiffViewer`、`ArtifactViewer`、`AuthorizationCard`、`RunTimeline` 仍可继续从当前私有结构抽成复用组件。
- Mobile/PWA 授权页本轮只做语义调整，尚未按 codeg/AionUi 密度做完整卡片化视觉 polish。
