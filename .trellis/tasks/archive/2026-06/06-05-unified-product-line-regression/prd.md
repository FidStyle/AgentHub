# 统一全功能主链路回归测试

## Goal

按最新 `.trellis/spec/cross-layer/real-flow-acceptance.md` 规则，把之前已完成的 P0/P1 功能尽量归并到几条大的真实用户测试线中统一验收。若测试线全部通过，证明当前功能体系可行；若暴露问题，必须在本任务内修复并回归到同一批测试线。

## Source of Truth

- `bytedance_init_prd.md`：最高产品事实源。
- `bytedance_init_video_txt.txt`：辅助产品事实源。
- `.trellis/spec/cross-layer/real-flow-acceptance.md`：真实主链路与全自动前端产物交付测试方法。
- `.trellis/spec/backend/runtime-workspace-contract.md`：权限模式、runtime continuation、workspace 隔离和 durable 状态契约。
- `research/sequential-execution-progress.md`：单分支顺序执行和三端验收规则。
- `research/project-tracker.md` / `research/regression-ledger.md`：公开项目状态和回归账本。

## Unified Test Lines

### A. Full-Auto Product Delivery Line

目标：完整权限状态下，用户单句 prompt 能自动跑到最终前端可见产物交付或明确真实失败。

覆盖：

- Orchestrator/架构师首响和 plan 创建。
- 后端/存储节点 completed。
- 前端工程师节点 dispatched + completed。
- 权限动作自动续跑或明确失败。
- 文件树、Git/Changes、代码引用或 workspace 文件证据。
- 生成 UI 真实可操作。
- SQLite/history 或对应核心持久化真实可用。
- Mobile/PWA 和 Desktop/Electron/fallback 读回同一 session 状态。

### B. Permission Lifecycle Line

目标：同一权限系统覆盖 full-auto、manual allow、reject、failure/interrupted。

覆盖：

- full-auto 权限动作自动 approve/dispatch。
- 手动 `允许单次执行` 继续原始 plan/mailbox/runtime。
- 手动 `拒绝` 不执行副作用，停在 waiting，等待下一次输入。
- 原始 inline permission card、durable actions、Mobile/PWA readback 状态一致。

### C. Workbench / Deploy / Artifact Line

目标：已完成的 P1 workbench 能统一验证。

覆盖：

- 自建 Agent 创建/编辑/读回。
- 聊天式部署拒绝/允许闭环。
- deployment manifest、artifact、result card 持久化。
- 富文档 artifact 创建/编辑/二次编辑请求/DOCX 下载。
- 文件树、文件预览、artifact panel 可刷新读回。

### D. Tri-Surface State Line

目标：Web、Mobile/PWA、Desktop/Electron 或明确 fallback 对同一功能状态读回一致。

覆盖：

- Web OpenCLI 主入口和工作台状态。
- Mobile/PWA `/m/sessions/:sessionId` plan/action/permission/artifact readback。
- Desktop/Electron OpenCLI app adapter；若缺 adapter，按项目规则使用 Playwright Electron fallback 并记录。
- 每条线必须标记 `pass` / `partial` / `failed` / `blocked` / `not-run`。

## Requirements

- 必须优先使用真实 acceptance 环境、真实 DB/API/session/runtime worker/CLI，不得用 mock 主链路。
- 能合并到同一个 workspace/session 的测试尽量合并，避免碎片截图。
- 历史报告只能作为参考，不作为新通过证据；本任务必须重新执行必要命令/OpenCLI/Electron fallback。
- 若任一大线失败，登记问题、修复、重跑对应线。
- 完成后更新 execution report、project tracker、regression ledger（如有新缺陷）和 Trellis 任务状态。

## Acceptance Criteria

- [ ] 任务 context JSONL 有真实 spec/research 引用。
- [ ] 启动/验证 acceptance 环境。
- [ ] A-D 四条统一测试线均有结果和证据路径。
- [ ] 暴露的问题已修复或明确登记为 blocked/not-run，不得误报 pass。
- [ ] Web/shared type-check、focused/full relevant tests、lint、Desktop build/test/Electron fallback 按需通过。
- [ ] `git diff --check`、Trellis validate、治理记录通过。
- [ ] 自动提交、归档、记录 journal。

## Out of Scope

- 最终 Demo 包和 3 分钟素材。
- 未开始的纯 P2 功能。
- 绕过 workspace isolation 或权限策略来强行通过。
