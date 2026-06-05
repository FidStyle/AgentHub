# 完成剩余 P1 功能

## Goal

按 Bytedance 原始产品要求和用户最新决策，完成剩余 P1 功能：IM/联系人/自建 Agent 体验补全、聊天式部署发布闭环、Mini IDE / 富文档 / Artifact workbench 的 P1 可交付部分。最终 Demo 包和 3 分钟 Demo 视频素材不在本任务范围内。

## Source Of Truth

- `bytedance_init_prd.md` 是最高事实源。
- `bytedance_init_video_txt.txt` 用于解释 IM 协作、产物预览/编辑、多端职责。
- `research/contracts/REMAINING-P1-FEATURES-2026-06-05.md` 是本任务共享合同。
- `research/sequential-execution-progress.md` 是当前顺序队列。

## What I Already Know

- P0 固定样本 product gate 已 closed，当前无 active task，工作区 clean。
- 现有 Web 已有 WorkspaceShell、ChatPanel、ArtifactPanel、role agents API、artifacts API、workspace files/git/patch API、Mobile/PWA 监督和 Desktop Electron fallback 测试基础。
- 现有 rich artifact 合同已覆盖 document/presentation 基础创建、预览、编辑、导出，但需要按 P1 队列与 IM/部署/workbench 一起收口验收。
- `e2e/artifacts/opencli-uat/deploy-v1/` 已存在历史部署相关证据，但本任务必须重新按当前产品链路验证，不直接拿旧证据假绿。

## Requirements

### R1. IM / 联系人 / 自建 Agent

- 角色 Agent 必须作为联系人式对象展示，包含名称、类型、能力标签、Runtime、是否可被编排。
- 用户可以创建和编辑自建 Agent，保存到真实 `role_agents` 数据，刷新可读回。
- 聊天输入框继续支持 `@` 一个或多个 Role Agent。
- 回复/引用消息必须进入后续上下文。
- 不可用的重试/重新生成入口不得是假按钮。

### R2. 聊天式部署发布闭环

- 用户在聊天里表达部署意图时，系统必须进入受控部署链路。
- 部署必须有审批/拒绝/允许记录。
- 允许后必须产生 durable 部署结果：状态、预览 URL 或本地预览路径、manifest/source path、执行摘要。
- 部署结果必须可在聊天流和 Artifact/Preview 区刷新读回。
- 不要求真实外网发布；允许本地 workspace 静态预览/manifest 闭环。

### R3. Mini IDE / 富文档 / Artifact Workbench

- Artifact workbench 必须支持查看网页、Markdown/文档、代码、Diff、目录、部署结果等基础产物。
- 用户可以创建/导入基础 artifact，编辑标题和内容，保存后刷新读回。
- 用户可以发起二次交互编辑请求，系统持久化“针对哪个产物/文件、希望怎么改”的请求。
- Mini IDE P1 只要求基础预览、编辑、patch 草案、应用 patch、下载/导出。
- 不实现完整版本历史、多人协同编辑、Office 级 PPT、完整选区 Agent 编辑。

### R4. 三端验收

- Web：OpenCLI browser 优先覆盖 P1 主链路。
- Mobile/PWA：OpenCLI browser 或移动视口覆盖查看、审批、部署/Artifact 结果。
- Desktop/Electron：若无 OpenCLI app adapter，使用 Playwright Electron fallback。

## Acceptance Criteria

- [ ] Agent 联系人/自建 Agent 创建编辑通过真实 API/DB/session 验证。
- [ ] 聊天式部署包含拒绝不执行、允许后产出 durable 结果、刷新读回。
- [ ] Artifact workbench 基础预览/编辑/保存/二次编辑请求/下载或导出通过。
- [ ] Web/Mobile/Desktop 三端验收有证据。
- [ ] `pnpm --filter @agenthub/web test -- <focused suites> --run` 通过。
- [ ] Web/shared type-check、Web lint、`git diff --check` 通过。
- [ ] tracker、sequential progress、execution report、治理门禁同步。

## Out Of Scope

- 最终 Demo 包。
- 3 分钟 Demo 视频素材。
- 未开始的纯 P2：完整版本历史、多人协同编辑、完整局部选区 Agent 编辑、第三方云发布/小程序/飞书发布。

## Technical Notes

- Contract: `research/contracts/REMAINING-P1-FEATURES-2026-06-05.md`
- Related completed contract: `research/contracts/COMPLETE-MULTI-AGENT-ORCHESTRATION-2026-06-02.md`
- Related artifact contract: `research/contracts/RICH-DOC-PPT-ARTIFACTS-2026-06-03.md`
- Likely Web files: `apps/web/components/workspace/ChatPanel.tsx`, `apps/web/components/workspace/ArtifactPanel.tsx`, `apps/web/app/api/role-agents/route.ts`, `apps/web/app/api/artifacts/route.ts`
