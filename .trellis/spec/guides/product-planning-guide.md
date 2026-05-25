# 产品规划思考指南

> **目的**：确保 AgentHub 实现工作始终绑定已确认的产品文档、`FR-ID`、UI 契约和测试门禁。

---

## 实现 AgentHub 产品工作前

先读取这些文档：

- `research/prd.md`
- `research/product-design.md`
- `research/ui-design-system.md`
- `research/automation-reference-comparison.md`
- 涉及 UI Phase 3 时读取 `research/ui-phase3-task-plan.md`
- 当前活动的 `.trellis/tasks/*/prd.md` 切片

然后检查：

- [ ] 每个任务都写明它实现的 PRD `FR-ID`。
- [ ] 每个任务都写明 `read_first` 或等价必读文件，包含 PRD、产品设计、技术设计、相关模块研究和参考项目来源。
- [ ] 每个任务都写明 `reference_sources` 或等价参考来源；涉及参考项目的任务必须指出 `refer_proj/*` 的具体来源或对应 `research/` 调研文档。
- [ ] 自动化执行遵循 `research/automation-reference-comparison.md`：Maestro-Flow 负责执行闭环参考，CodeStable 负责需求暂停和验收回写参考。
- [ ] 项目级任务规划已经先写入 `research/`；`.trellis/tasks/*/` 只承载可执行切片。
- [ ] 涉及 UI 的任务必须额外引用 `FR-UI-001`、`research/ui-design-system.md` 和 `.trellis/spec/frontend/ui-style-guidelines.md`。
- [ ] 涉及 UI 的任务必须引用 `research/modules/ui-and-visual-testing.md`，并写明 AionUi、codeg、lobehub、cherry-studio 中采用或不采用的部分。
- [ ] 涉及 UI Phase 3 的任务必须能追溯到 `research/ui-phase3-task-plan.md` 中的模块、顺序和 Definition of Done。
- [ ] UI 行为匹配 `research/product-design.md` 中的页面、流程、组件和状态设计。
- [ ] UI 组件基线使用 `shadcn/ui + Tailwind CSS 4 + lucide-react`，不能交付无样式纯 HTML。
- [ ] UI E2E 同时包含功能断言、截图留存、布局断言和敏感信息断言。
- [ ] Workspace 执行域明确为 `Cloud Workspace` 或 `Local Desktop Workspace`。
- [ ] 同一个 Workspace 或 Session 内没有代码路径混用 Cloud Runtime 和 Local Desktop Runtime。
- [ ] Web/Mobile 被实现为 Cloud 与 Local Desktop Workspace 的控制端；Local Desktop Workspace 的本地文件写入、shell 命令和 Runtime 调用只落到 Desktop Connector。
- [ ] 用户可见聊天对象是 Role Agent，而不是 Claude Code/Codex 工具名。
- [ ] 涉及多个 Role Agent 的 Orchestrator 计划使用结构化 Plan DAG 契约：节点、依赖、ready/waiting/blocked 状态和 FR-ID 绑定校验。
- [ ] 确认 UX 绑定计划、下一步、权限、重试或发布/部署动作；Diff 仍然只是展示材料。
- [ ] Mobile 和 Desktop 没有被当成完整 Web 克隆。
- [ ] Web、Desktop、Mobile/PWA 的信息密度符合各端职责：Web 完整工作台，Desktop Connector Console，Mobile 轻量 IM/审批/预览。

Phase 2 技术选型还要检查：

- [ ] `research/modules/` 下的模块研究文档引用对应 `FR-ID`。
- [ ] 参考仓库证据记录在 `research/reference-repos/`，并汇总到 `research/modules/reference-projects.md`。
- [ ] 热度和相关性分开判断；低 star 但涉及 CLI、session、PTY、resume、runtime-adapter 的仓库不能未经人工复核就丢弃。
- [ ] 自动生成的分数只作为第一轮信号，不作为最终架构决策。
- [ ] 面向评审的技术设计文档优先使用中文表格和 Mermaid/PlantUML 图，避免长篇代码式接口；精确类型签名放到实现任务或代码规范中。
- [ ] UI 参考项目必须记录采用和不采用的部分；AionUi/codeg/lobehub/cherry-studio 只作为布局、密度和组件行为参考，不覆盖 PRD 中的执行域和凭证边界。

---

## FR-ID 追踪规则

每个实现任务都应包含：

- `FR-ID`：来自 `research/prd.md` 的一个或多个需求 ID。
- `产品端面`：Web、Desktop、Mobile、Backend、Runtime Adapter 或共享领域模型。
- `验收来源`：正在实现的 PRD 验收标准或产品设计流程。
- `UI 契约`：如果任务涉及界面，必须写 `FR-UI-001`、参考组件、断点和视觉 E2E 断言。
- `项目级规划`：如果任务属于某个阶段性规划，必须能追溯到 `research/` 下的对应规划文档。
- `自动化约束`：必须写明执行闭环、参考项目注入和需求反写规则，来源是 `research/automation-reference-comparison.md`。
- `参考来源`：必须列出实现前要读的 `research/*`、`.trellis/spec/*`、`refer_proj/*` 或任务级研究文档。

如果某个行为无法映射到现有 `FR-ID`，先暂停实现并更新 PRD 或新增 `research/prd-amendments/*.md` 修订记录。

---

## 自动化执行与需求反写规则

AgentHub 实现阶段采用两层参考：

- Maestro-Flow：作为 plan -> execute -> verify -> review -> test -> gap plan/fix-loop 的执行闭环参考。
- CodeStable：作为需求不清暂停、设计回退、验收后回写 PRD/技术设计/任务状态的治理参考。

实现中命中以下任一条件，必须停止继续写代码：

- [ ] 新行为无法绑定到 `research/prd.md` 中的 `FR-ID`。
- [ ] PRD Acceptance Criteria 不足以写出自动化断言。
- [ ] UI 任务缺少 `FR-UI-001`、UI 设计系统、视觉 E2E 或参考项目来源。
- [ ] 参考项目建议与 PRD、产品设计、UI 契约或技术设计冲突。
- [ ] 代码需要引入 PRD 未定义的权限、凭证、本地执行能力或发布动作。
- [ ] 实现步骤出现任务切片没有覆盖的方案外文件、方案外行为或方案外 UI 状态。
- [ ] Playwright 截图或布局断言暴露新的视觉契约缺口。

停止后按这个顺序处理：

1. 在当前任务记录触发原因和受影响 `FR-ID`。
2. 小修订直接更新 `research/prd.md`、`research/technical-design.md` 或 `research/ui-design-system.md`。
3. 影响范围较大或需要用户确认时，新建 `research/prd-amendments/YYYY-MM-DD-{slug}.md`，写明触发任务、冲突点、建议改动、测试影响和待确认问题。
4. 回填 `.trellis/tasks/*/prd.md`、`implement.jsonl`、`check.jsonl`，补齐测试与视觉门禁。
5. 用户确认或文档提交后再恢复实现。

禁止把这些决策藏在代码里：

- 替用户决定新需求边界。
- 让参考项目覆盖 AgentHub 已确认的执行域、凭证或 UI 契约。
- 因为测试难写而降低 PRD Acceptance Criteria。
- 因为页面能显示就跳过截图、布局和敏感信息断言。

---

## 项目级规划与执行切片边界

复杂阶段规划必须先沉淀到 `research/`：

- UI Phase 3 规划：`research/ui-phase3-task-plan.md`
- 技术选型：`research/technical-design.md`
- UI 设计系统：`research/ui-design-system.md`
- 自动化执行与需求反写：`research/automation-reference-comparison.md`
- 模块调研：`research/modules/*.md`

`.trellis/tasks/*/` 只放可执行切片，包括任务级 `prd.md`、`info.md`、`implement.jsonl`、`check.jsonl` 和 `task.json`。

### 错误：只在 Trellis 任务里保存阶段规划

**症状**：阶段路线、模块边界和执行顺序只存在于 `.trellis/tasks/*/`，`research/` 下没有项目级索引。

**修正**：先补 `research/<phase>-task-plan.md` 或等价项目级规划，再让 `.trellis/tasks/*/` 引用它。

---

## 常见错误

### 错误：把 Runtime 名称当成聊天参与者

**症状**：UI 写成“发送给 Claude Code”或“分派给 Codex”。

**修正**：UI 应写成“发送给前端工程师”“分派给代码审查”或其他 Role Agent。Runtime 名称只出现在配置和诊断中。

### 错误：把 Mobile 做成小号 Web IDE

**症状**：Mobile 包含复杂代码编辑或 Runtime 绑定。

**修正**：Mobile P0 是轻量 IM、审批、进度和预览。

### 错误：认为 Web/Mobile 不能控制本地工作区

**症状**：文案或代码把“Web/Mobile 不直接写本地文件”理解成“Web/Mobile 不能控制用户的 Local Desktop Workspace”。

**修正**：Web/Mobile 可以为 Local Desktop Workspace 发送任务消息、审批和 Action 请求。边界是执行位置：本地文件写入、shell 命令和 Claude/Codex 调用必须经过已认证的 Desktop Connector。

### 错误：审批 Diff 而不是审批 Action

**症状**：Git diff 卡片本身要求审批。

**修正**：审批属于任务计划、权限升级、下一步、重试或发布/部署动作。Diff 是辅助上下文。

### 错误：把 Orchestrator 计划只当成 Markdown

**症状**：Orchestrator 产出一段好看的计划消息，但没有用于分派、阻塞、重试或结果汇总的结构化节点/依赖模型。

**修正**：多 Role Agent 的 Orchestrator 计划必须有 Plan DAG 数据契约。计划卡只是 `PlanNode`、`dependsOn` 和计算后的 ready/waiting/blocked 状态的渲染，不是真相源。

### 错误：让参考仓库热度决定架构

**症状**：高 star 的通用聊天或客户端项目直接成为 Runtime Adapter、Desktop Connector 或 Device Gateway 决策的默认参考。

**修正**：结合 `research/reference-repos/repo-catalog.json` 和 `research/modules/reference-projects.md` 使用。优先参考能直接覆盖模块风险的仓库，例如 CLI 子进程控制、原生 session resume、PTY 处理、WebSocket 网关行为、审批事件和产物持久化。

### 错误：技术设计写得像源码

**症状**：`research/technical-design.md` 包含大量只有实现者才能读懂的 TypeScript interface。

**修正**：面向评审的技术文档尽量使用中文。用 Mermaid/PlantUML 图、实体表、状态表和 API 表表达架构；精确类型签名在 Phase 3 进入任务文档或代码规范。

### 错误：功能完成但 UI 还是毛坯

**症状**：页面只有默认 HTML、英文按钮、临时内联样式，没有响应式断点和截图测试。

**修正**：涉及 UI 的任务必须先引用 `FR-UI-001` 和 `research/ui-design-system.md`，并在任务切片中写清功能断言、截图断言、布局断言和敏感信息断言。

### 错误：执行时没有实际参考 refer_proj

**症状**：任务描述写了“参考现有项目”，但 `implement.jsonl` 或任务 PRD 没有列出具体参考项目、参考页面、采用点和不采用点。

**修正**：任务必须写入 `reference_sources` 或等价段落。UI 任务至少追溯到 `research/ui-design-system.md`、`research/modules/ui-and-visual-testing.md` 和对应 AionUi/codeg/lobehub/cherry-studio 参考结论；自动化任务至少追溯到 `research/automation-reference-comparison.md`。

### 错误：需求不清还继续实现

**症状**：实现中发现 PRD 没写、验收标准不够、参考项目和现有契约冲突，但 Agent 自行选择一个做法继续写代码。

**修正**：停止实现，更新 PRD 或新增 `research/prd-amendments/*.md`，再回填任务切片和测试门禁。没有 `FR-ID` 和可验证验收标准的行为不能进入实现。

### 错误：照搬参考项目的 Provider/API Key 配置

**症状**：Agent 或 Runtime 配置页出现本地 Claude Code / Codex API Key、Base URL 或环境变量保存表单。

**修正**：本地 Runtime P0 只做检测、绑定、诊断和本机登录/安装引导。平台托管模型 Provider 凭证是未来独立能力，不能混入本地 CLI Role Agent 绑定流程。
