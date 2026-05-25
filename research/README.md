# AgentHub Research 文档入口

**状态：** Phase 1 / Phase 2 已完成，UI Phase 3 任务切片已生成
**主读者：** 产品评审、技术评审、后续实现 Agent

本目录存放 AgentHub 的项目级需求、产品设计、技术选型和架构文档。实现阶段的任务切片不放在这里，统一放入 `.trellis/tasks/*/`。

---

## 1. 推荐阅读顺序

| 顺序 | 文档 | 用途 | 是否主审 |
| --- | --- | --- | --- |
| 1 | `prd.md` | 定义产品定位、P0/P1/P2 范围、FR-ID、验收标准 | 是 |
| 2 | `product-design.md` | 定义 Web、Desktop、Mobile 的页面、用户流、组件状态 | 是 |
| 3 | `ui-design-system.md` | 定义三端 UI 设计系统、组件契约、状态视觉和视觉 E2E 门禁 | 是 |
| 4 | `technical-design.md` | 定义最终技术路线、架构、数据模型、协议、实现顺序 | 是 |
| 5 | `automation-reference-comparison.md` | 定义 Maestro-Flow 与 CodeStable 如何分别约束自动执行和需求反写 | 是 |
| 6 | `ui-phase3-task-plan.md` | 定义 UI Phase 3 的项目级任务规划、执行顺序和任务索引 | 是 |
| 7 | `modules/README.md` | 查看模块研究索引和最终选型摘要 | 否 |
| 8 | `modules/*.md` | 追溯具体模块为什么这样选型 | 按需 |
| 9 | `reference-repos/*.md` | 追溯参考项目、扫描方法和证据 | 按需 |

评审时优先看 PRD、产品设计、UI 设计系统、技术设计和对应 Phase 3 规划。模块研究和参考项目是证据层，用于解释技术设计中的取舍，不要求每次完整阅读。

---

## 2. 文档职责边界

| 文档 | 负责回答 | 不负责回答 |
| --- | --- | --- |
| `prd.md` | 产品要做什么、为什么做、验收标准是什么 | 技术框架、数据库表结构、页面布局细节 |
| `product-design.md` | 用户如何操作、页面如何组织、组件有哪些状态 | 具体技术栈、API 契约、Runtime 启动方式 |
| `technical-design.md` | 用什么技术实现、模块如何连接、数据和协议如何组织 | 重新定义需求范围、替代 PRD 验收标准 |
| `ui-design-system.md` | 三端 UI 如何组织、组件怎么复用、状态如何表达、视觉 E2E 如何验收 | 承载具体实现任务状态 |
| `automation-reference-comparison.md` | 自动化执行参考、参考项目注入规则、需求不清时的暂停和 PRD 反写策略 | 替代测试工具选型或直接定义单个实现任务 |
| `ui-phase3-task-plan.md` | UI Phase 3 的项目级任务树、执行顺序和统一 DoD | 替代 `.trellis/tasks/*/` 的任务细节 |
| `modules/*.md` | 每个复杂模块的备选方案、参考项目证据、推荐路线 | 作为实现时的唯一契约 |
| `.trellis/tasks/*/` | 具体实现任务、测试计划、验收步骤 | 改写 Master PRD 或总体架构 |

发生冲突时，优先级为：

1. `prd.md` 的 FR-ID 和验收标准。
2. `product-design.md` 的页面与交互契约。
3. `ui-design-system.md` 的 UI 契约。
4. `technical-design.md` 的最终技术路线。
5. `automation-reference-comparison.md` 的自动化执行和需求反写门禁。
6. `ui-phase3-task-plan.md` 的任务规划。
7. `modules/*.md` 的研究证据。
8. 会话中的临时讨论。

---

## 3. Phase 3 输入规则

进入实现阶段时，每个 Trellis 任务必须写清楚：

| 字段 | 来源 |
| --- | --- |
| `FR-ID` | `prd.md` Requirement Registry |
| 产品表面 | `product-design.md` 页面、用户流或组件 |
| UI 契约 | `ui-design-system.md` 与 `ui-phase3-task-plan.md` |
| 技术方案 | `technical-design.md` 对应章节 |
| 自动化执行与需求反写 | `automation-reference-comparison.md` |
| 模块依据 | 相关 `modules/*.md`，仅在技术取舍不清时引用 |
| 验收检查 | PRD Acceptance Criteria + 技术设计测试策略 |

如果某个实现行为无法映射到现有 `FR-ID`，先更新 PRD 或新增 `prd-amendments/` 修订记录，再拆任务。

项目级 Phase 3 规划应先进入 `research/`。`.trellis/tasks/*/` 只承载可执行任务切片，不能成为唯一的项目级规划来源。

---

## 4. 当前已确认结论

| 主题 | 结论 | 主文档 |
| --- | --- | --- |
| 三端定位 | Web 是主工作台，Desktop 是本地 Connector，Mobile 是轻量控制端 | `prd.md`, `product-design.md` |
| Workspace 执行域 | Cloud Workspace 与 Local Desktop Workspace 不可混用 Runtime | `prd.md`, `technical-design.md` |
| 身份 | GitHub OAuth，P0 使用 Supabase Auth | `technical-design.md`, `modules/auth-workspace.md` |
| Desktop 技术路线 | Electron + Desktop 主动 WebSocket DeviceChannel | `technical-design.md`, `modules/desktop-connector.md` |
| Mobile P0 | 响应式 Web/PWA；Android App 预留 Capacitor | `technical-design.md`, `modules/client-shells.md` |
| UI 基线 | `shadcn/ui + Tailwind CSS 4 + lucide-react`；codeg/shadcn 是三端统一视觉母版，AionUi/lobehub/cherry-studio 只作结构和密度参考 | `ui-design-system.md`, `ui-phase3-task-plan.md` |
| Runtime Adapter | Claude Code/Codex 均走 CLI 子进程 Adapter，保持 native session continuity | `technical-design.md`, `modules/runtime-adapters.md` |
| 自动化执行 | Maestro-Flow 作为 plan/execute/verify/review/test/fix-loop 参考，CodeStable 作为需求暂停和验收回写参考 | `automation-reference-comparison.md`, `technical-design.md` |
| Orchestrator | 后端 Run 状态机 + Plan DAG；LLM 生成候选计划，系统校验和调度 | `technical-design.md`, `modules/orchestrator-plan-dag.md` |
| 审批 | 审批绑定计划、权限、Action、重试或发布，不绑定 Diff 本身 | `prd.md`, `product-design.md` |

---

## 5. 交付前检查清单

- [ ] 新增或修改需求时，`prd.md` 有对应 `FR-ID` 和验收标准。
- [ ] 页面或交互变化已同步到 `product-design.md`。
- [ ] 技术路线变化已同步到 `technical-design.md`。
- [ ] UI 任务规划变化已同步到 `ui-phase3-task-plan.md`。
- [ ] 模块研究只作为证据层，不与最终技术设计冲突。
- [ ] Phase 3 任务拆分前，`.trellis/tasks/*/` 能明确引用 `FR-ID`、产品表面和技术章节。
