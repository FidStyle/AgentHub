# 固定样本 OpenCLI 三端 UAT

## Goal

使用真实 AgentHub 入口和 OpenCLI 验收固定样本 `做一个加减乘除的简单网站，使用sqlite存储历史记录`。本任务只接受真实 Web / Mobile 浏览器或 PWA / Electron 用户链路、真实 DB/API/session/runtime 证据和可复现截图，不用 mock runtime、脚本假成功或局部单测替代产品验收。

## Background

前序任务已经分别修复 workspace cwd/context 隔离、架构师 durable dispatch、runtime permission broker。本任务负责把这些修复放回真实 UI/runtime 链路中验收，确认 Bytedance PRD/video 关心的 IM 多 Agent 协作、Orchestrator 派发、真实 runtime、权限审批、产物/预览证据没有被局部修复遗漏。

## Fixed Sample

- Workspace root: `/Users/joytion/.agenthub/cloud-workspaces/joytion/test2-e427fab2`
- Prompt: `做一个加减乘除的简单网站，使用sqlite存储历史记录`
- 目标角色：`@架构师` 或产品 UI 中等价的架构师角色
- 推荐合同端口：`http://127.0.0.1:3106`；如实际 acceptance 脚本使用其他端口，报告必须写明实际 URL 和原因

## Requirements

- Web 必须通过 OpenCLI browser 复用真实浏览器状态访问真实 AgentHub 页面。
- Mobile 浏览器/PWA 必须通过 OpenCLI browser 视口切换或等价移动会话验收同一主链路。
- Electron/Desktop 优先使用 OpenCLI app adapter；如当前 OpenCLI 没有 Electron adapter，允许使用 Playwright Electron 控制真实 Electron 入口，并在报告中明确 fallback 原因。
- 如遇 GitHub 登录、OAuth、2FA、CLI 登录、敏感权限或设备绑定边界，必须暂停让用户手工完成；不得收集凭证或伪造登录。
- 验收必须证明 URL、fixture auth、选中 workspace、cwd、context isolation、durable plan/mailbox/attempt、runtime sessions/jobs/logs、权限卡、拒绝/允许行为。
- 权限拒绝必须显示精确文案：`已拒绝，未执行该操作。`
- 权限允许后的动作必须仍限制在 workspace root 内，越界必须阻止。
- 不得用 `FakeExecutor`、`ScriptedRealExecutor`、hardcoded SSE、Playwright route mock、截图存在或单元测试冒充 UAT 通过。

## Acceptance Criteria

- [ ] Web OpenCLI UAT：真实页面进入固定 workspace，发送固定 prompt，产生可见架构师响应/派发/权限状态，并保存截图。
- [ ] Mobile/PWA OpenCLI UAT：移动视口下能查看或执行同一会话关键状态，权限卡/错误态不被隐藏，并保存截图。
- [ ] Electron/Desktop UAT：真实 Electron 窗口或可说明的 fallback 自动化覆盖本地/桌面相关状态，并保存截图。
- [ ] 数据证据：报告列出至少一个 `workspaceId`、`sessionId`、`messageId`、`runtimeSessionId` 或等价 runtime job/log/action id。
- [ ] Runtime 证据：确认 cloud/local runtime 模式、executor 模式、worker/job/log 状态；不可用时必须显示真实中文失败态，不得落伪成功 assistant 回复。
- [ ] Context 证据：角色上下文只来自 `test2-e427fab2`，不得注入宿主 AgentHub repo 的 `AGENTS.md`、`.trellis/*`、monorepo/package 技术栈。
- [ ] Dispatch 证据：架构师需求必须产生 durable plan/mailbox/attempt 或等价可审计派发记录，至少覆盖后端，页面交互需求覆盖前端或说明同一角色承担。
- [ ] Permission 证据：覆盖一次拒绝和一次允许；拒绝未执行，允许仍受 workspace root 约束。
- [ ] Bytedance 回归：报告反查 `bytedance_init_prd.md` / `bytedance_init_video_txt.txt` 中 IM 多角色协作、Orchestrator 派发、真实 runtime、artifact/preview 相关点。

## Evidence Paths

- OpenCLI screenshots/logs: `e2e/artifacts/opencli-uat/role-runtime-uat-2026-06-05/`
- Execution report: `research/execution-reports/opencli-role-runtime-uat-2026-06-05.md`
- Sequential ledger: `research/sequential-execution-progress.md`

## Blocked / Failure Policy

- 如果 OpenCLI、auth、CLI credential、Desktop device binding 或 acceptance infra 阻塞真实 UAT，报告必须写明精确阻塞命令、输出摘要、需要用户执行的动作，并把本任务标为 blocked；不得写 PASS。
- 如果真实 UAT 暴露产品缺陷，必须在同一功能点内创建/拆分后续修复任务，修复通过前不能跳过进入 P1/P2 队列。
- 如果 Electron 只能用 Playwright fallback，Web/Mobile OpenCLI 仍必须实际运行；Electron fallback 不得扩大成三端 OpenCLI 通过。

## References

- `research/sequential-execution-progress.md`
- `research/contracts/ROLE-RUNTIME-WORKSPACE-PERMISSIONS-2026-06-03.md`
- `research/contracts/ACCEPTANCE-REAL-FLOW-2026-06-01.md`
- `research/contracts/ORCHESTRATOR-IM-MARKDOWN-GIT-DIFF-2026-06-03.md`
- `.trellis/spec/backend/runtime-workspace-contract.md`
- `.trellis/spec/cross-layer/real-flow-acceptance.md`
- `.trellis/spec/cross-layer/runtime-gateway-contract.md`
- `.trellis/spec/guides/cross-layer-thinking-guide.md`
