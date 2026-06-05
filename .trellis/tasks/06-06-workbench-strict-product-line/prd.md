# 严格工作台主链路闭环

## Goal

修复用户复核指出的工作台主链路假闭环：同一条真实 session 必须可见 Orchestrator/架构师首响、前后端角色执行过程、权限拒绝/允许状态、Git/File/Artifact/部署结果，并能通过 Web/Mobile/Desktop 验收读回。

## Source Of Truth

- `bytedance_init_prd.md`
- `bytedance_init_video_txt.txt`
- `research/contracts/WORKBENCH-STRICT-PRODUCT-LINE-2026-06-06.md`
- `research/product/ui-design-system.md`
- `.trellis/spec/cross-layer/real-flow-acceptance.md`
- `.trellis/spec/frontend/component-guidelines.md`

## Requirements

- `/api/messages` 必须保留用户可见 `role_acknowledgement` 和过程消息。
- 新增统一 session timeline API，从真实 DB 聚合 message/plan/node/attempt/mailbox/runtime/action/artifact/deploy。
- Web 工作台右栏新增或调整为用户可见的过程链路，不能只显示部署审批和完成。
- 权限状态区分审批状态和执行状态；full-control/auto 不显示手动审批按钮，standard/sandbox 保留手动允许/拒绝。
- Git 面板遵守渐进式披露：文件列表优先，点击后 diff。
- 文件面板保留选区引用和 patch 草案入口。
- 产物/部署必须可刷新读回，runnable artifact 提供持久启动脚本或命令。
- 更新 tracker、ledger、report、spec，补严格测试。

## Acceptance Criteria

- [ ] Web/API 测试证明 `role_acknowledgement` 不被过滤。
- [ ] `GET /api/sessions/[id]/timeline` 返回 typed timeline，并通过 owner check。
- [ ] Web 过程面板能显示同 session 的消息、计划节点、attempt/mailbox/runtime、权限和产物/部署记录。
- [ ] 部署 reject 路径不生成 deployment artifact；approve 路径生成 manifest/artifact 并在 timeline 可见。
- [ ] Git/File/Artifact 组件测试覆盖关键交互。
- [ ] Web type-check 通过，相关测试通过。
- [ ] 三端 OpenCLI/Playwright 验收有报告；未能运行的端必须写 blocked 原因，不能计入 pass。

## Out Of Scope

- 最终 Demo 包和 3 分钟素材。
- 未开始的纯 P2 富文档/演示稿扩展。
- 直接复制 GPL 参考项目代码。

## Technical Notes

- 参考项目研究摘要：`research/reference-repos/workbench-strict-product-line-2026-06-06.md`。
- 当前已发现 `/api/messages` 仍过滤 `role_acknowledgement`，需要本轮修复。
