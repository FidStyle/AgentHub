# WORKBENCH-STRICT-PRODUCT-LINE-2026-06-06: 严格工作台主链路闭环合同

> 本合同是本轮 Trellis 实现、验收和报告的共享事实接口。产品事实冲突时以 `bytedance_init_prd.md` 为最高优先级。

## 1. 元信息

| 字段 | 内容 |
| --- | --- |
| TASK-ID | `WORKBENCH-STRICT-PRODUCT-LINE-2026-06-06` |
| 优先级 | P0/P1 |
| 绑定 FR-ID | FR-CHAT-001, FR-ORCH-001, FR-RUNTIME-001, FR-PERM-001, FR-ACTION-001, FR-WEB-001, FR-MOB-001, FR-DESK-001, FR-ARTIFACT-001, FR-RESULT-001, FR-UI-001 |
| 来源 | `bytedance_init_prd.md`, `bytedance_init_video_txt.txt`, `research/prd.md`, `research/product/ui-design-system.md`, `research/reference-repos/agent-ui-component-evolution-roadmap.md` |
| 状态 | active |

## 2. 背景与目标

用户验收发现 P1 部署样本只展示了部署审批和部署完成，缺少真实开发过程、角色编排、权限状态迁移、Git/File/Artifact 的单职责工作台证据。目标是建立一条严格的用户可见主链路：同一 session 内必须能从真实 DB/API 读回 Orchestrator 首响、前后端角色执行、权限拒绝/允许、文件树、Git diff、产物推荐/确认、部署结果和三端状态。

2026-06-06 用户进一步明确：右侧 timeline 读回不能替代 IM 对话记录。验收必须以中央 IM transcript 为第一证据：用户发送固定 prompt 后，Orchestrator 先在 IM 中回复分工；真实角色会话回复/引用/交接进入 IM；完成后回到 Orchestrator 判断是否重派或验收；最终 Orchestrator 推荐/确认产物，再进入后续发布/部署。

## 3. 用户链路合同

1. 用户在 Web 工作台发送固定样本或部署请求。
2. Orchestrator/架构师必须先在 IM transcript 中产生可见首响，说明任务理解、分工和验收口径，并创建 durable plan。
3. 被分配的真实角色会话必须在 IM 中回复；回复必须绑定 `role_agent_id`，并能关联到 runtime/plan node/attempt/mailbox。仅由程序拼接的状态文案、隐藏 mailbox 或右侧 timeline 不算角色会话。
4. 角色之间的 reply/引用/handoff 必须进入 IM 或消息 metadata，用户刷新后仍能看出谁把什么交给了谁。
5. 每轮角色完成后必须回到 Orchestrator 状态：Orchestrator 决定重派、失败停止或验收通过，并在 IM 中可见。
6. 通过 Orchestrator 验收后，才进入产物部分：Orchestrator 推荐具体产物内容与交付方式；full-auto prompt 可自动确认，但推荐/确认必须持久化。
7. 手动拒绝部署不得创建 manifest 或 deployment artifact。
8. 手动允许部署必须在 selected workspace root 下生成 manifest 和 deployment artifact，并在 timeline、消息、产物面板、Mobile/PWA 读回。
9. full-control/auto 模式不出现手动审批按钮；standard/sandbox 模式允许后继续，拒绝后停止等待下一次输入。

## 4. 三端职责边界

| 端 | 职责 | 不做什么 |
| --- | --- | --- |
| Web | 完整 IM、过程 timeline、编排、权限、Git、文件、产物、部署操作 | 不用单个“变更”面板混合所有职责 |
| Mobile/PWA | 同 session 计划、授权记录、部署/产物结果轻量读回 | 不承担复杂代码编辑或 Git 操作 |
| Desktop/Electron | 本地运行态和监督读回；OpenCLI adapter 缺失时可用 Playwright fallback 记录 | 不作为 Web 审批中心的替代 |

## 5. 数据与后端合同

- 新增或使用统一 session timeline 读模型，数据来自真实 `messages`、`plans`、`plan_nodes`、`plan_node_attempts`、`agent_mailbox_items`、`runtime_sessions`、`runtime_logs`、`actions`、`artifacts`。
- `/api/messages` 不得过滤用户可见 `role_acknowledgement`。
- `/api/messages` 是 IM-first 主验收入口：必须能读回 Orchestrator 分工、角色回复、handoff/引用、Orchestrator 验收和产物推荐/确认。`/api/sessions/:id/timeline` 只能补充验证同一 session 的结构化状态。
- 权限审批 API 必须返回审批状态和执行续跑状态，不得只更新 action row。
- 部署 action 允许后只能在 selected workspace root 内写 `.agenthub/deployments/<actionId>/manifest.json`。
- 产品运行时主链路禁止 mock。

## 6. UI/UX 合同

- 右栏必须是单职责信息架构：过程/编排、文件、Git、产物、部署。
- 右侧栏桌面宽度必须可拖动、限制 min/max、刷新后保留；移动端使用抽屉，不要求桌面式拖动。
- 中央 IM 是第一用户体验。不能让用户只在右侧栏看到过程，中间对话只剩 prompt、权限卡和最终结果。
- 权限卡主状态表达审批：`待确认`、`已允许`、`已拒绝`、`已审批`；执行进度使用独立过程/tool/action 卡。
- Git 面板先显示文件列表，点击文件后加载 diff。
- 文件面板必须暴露选区引用、patch 草案和 apply/reject。
- 产物必须有推荐/确认状态或明确非 runnable 状态；runnable artifact 必须有持久启动脚本/命令。
- 用户可见文案使用简体中文。

## 7. 参考项目输入

| 参考项目 | 读取范围 | 提炼内容 | 不采用内容 |
| --- | --- | --- | --- |
| `refer_proj/reference-repos-cache/siteboon__claudecodeui` | chat tool renderer、Git panel、file browser | tool 卡片配置化、Git staged/unstaged 渐进披露、文件列表优先 | GPL 代码、其 store/schema/runtime |
| `refer_proj/xintaofei__codeg` | ai-elements tool、merge workspace/diff | 状态 badge、diff preview、工作台文件列表密度 | Tauri API、其 i18n/store |
| `refer_proj/DeadWaveWave__opencove` | workspace agent status E2E | 状态迁移断言和 Electron fallback 模式 | Canvas 产品模型 |

## 8. 测试与验收合同

- Unit/API：timeline API owner check、消息 role acknowledgement 保留、权限状态响应、Git/File/Artifact 组件行为。
- Web OpenCLI：fresh session，从中央 IM 发送固定 prompt，一次输入后验证 Orchestrator 分工、真实角色回复/handoff、Orchestrator 验收、产物推荐/确认；再验证右栏过程、Git 文件先列表后 diff、文件引用、右栏拖拽宽度、产物启动、部署拒绝/允许。
- Mobile/PWA OpenCLI：同 session 读回 plan/action/deployment/artifact 状态。
- Desktop/Electron：优先 OpenCLI app adapter；缺失时 Playwright Electron fallback 并写明原因。
- 视觉：无横向滚动、长路径不溢出、关键区域不重叠。

## 9. 完成门禁

- [ ] `research/project-tracker.md` 更新。
- [ ] `research/regression-ledger.md` 更新。
- [ ] execution report 记录命令、session、截图/API 证据。
- [ ] `.trellis/spec` 写入可复用规则。
- [ ] type-check、相关测试、OpenCLI/Playwright 验收完成或明确 blocked。
- [ ] `node scripts/audit-acceptance-evidence.mjs WORKBENCH-STRICT-PRODUCT-LINE-2026-06-06 --root <repo>` 必须输出 `Classification: product-pass`；若仍输出 `failed/partial`，说明当前只能作为局部修复，不能声明 Bytedance 主链路完成。
- [ ] `bash scripts/verify-governance-gate.sh WORKBENCH-STRICT-PRODUCT-LINE-2026-06-06` exit 0。
- [ ] 中文 commit，禁止提交 `refer_proj/*`。

2026-06-06 规则更新：治理门禁已经接入严格证据审计。`REG-20260606-003` 已由 fresh strict run `STRICT-IMFIRST-1780728733` 关闭；后续如果 tracker/report 再出现 partial、open regression、缺 IM transcript、缺三端状态或缺产物推荐/确认，`verify-governance-gate.sh` 必须重新 exit 1。

## 10. 残留风险

- Electron OpenCLI adapter 若仍不存在，本轮可用 Playwright fallback，但必须记录为 adapter follow-up。
- 参考项目只迁移结构和验收方法，不复制许可证不兼容代码。
