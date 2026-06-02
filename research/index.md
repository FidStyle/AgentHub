# AgentHub Research 总索引

> 本文件是项目级研究文档、设计契约、模块调研和跟进入口的索引。它不是流水账；单个 bug、wave 报告和历史证据默认不进入本索引。

---

## 产品需求

| 文档 | 说明 |
|------|------|
| [prd.md](./prd.md) | 总体 PRD，FR-ID 注册表 |
| [product-design.md](./product-design.md) | 产品设计：页面、用户流、组件状态 |
| [prd-amendments/](./prd-amendments/) | PRD 增补修订（不直接改 prd.md） |
| [prd-amendments/2026-05-31-three-surface-workbench-permission-model.md](./prd-amendments/2026-05-31-three-surface-workbench-permission-model.md) | 三端会话工作台、权限模式、Desktop Host、Mobile 远程监督和参考组件迁移修订 |
| [prd-amendments/2026-06-02-complete-multi-agent-orchestration.md](./prd-amendments/2026-06-02-complete-multi-agent-orchestration.md) | 完整多 Agent 编排与交接修订：Orchestrator DAG、mailbox/handoff、角色 runtime 绑定和三端状态 |
| [contracts/](./contracts/) | **共享任务合同** — Trellis 与 Maestro/Ralph 的唯一协作接口 |
| [contracts/THREE-SURFACE-WORKBENCH-PERMISSION-001.md](./contracts/THREE-SURFACE-WORKBENCH-PERMISSION-001.md) | P0 三端会话工作台与权限模型统一合同：Web 工作台、Desktop Host、Mobile 远程监督、Run/Context/Changes/Artifacts |
| [contracts/P0-END-TO-END-PRODUCT-FLOW.md](./contracts/P0-END-TO-END-PRODUCT-FLOW.md) | P0 MVP 端到端产品主链路合同与验真样本 |
| [contracts/P1-RUNTIME-GATEWAY.md](./contracts/P1-RUNTIME-GATEWAY.md) | P1 Cloud Runtime Gateway 架构合同：必需云端 relay，统一 public_cloud 与 user_local runtime |
| [contracts/LOCAL-DESKTOP-OPERABILITY-001.md](./contracts/LOCAL-DESKTOP-OPERABILITY-001.md) | P0 本地 Desktop 工作区只读/可操作模式、Runtime doctor 和 Web/Desktop 连通性真实性合同 |
| [contracts/ACCEPTANCE-HARDENING-2026-06-01.md](./contracts/ACCEPTANCE-HARDENING-2026-06-01.md) | P0 验收前全功能硬化合同：质量门禁、真实环境、Web/Desktop/Mobile 主链路和最终 UAT 治理 |
| [contracts/ACCEPTANCE-REAL-FLOW-2026-06-01.md](./contracts/ACCEPTANCE-REAL-FLOW-2026-06-01.md) | P0 验收真实闭环合同：opencli 验真、真实 runtime worker、本地/远程核心 @ 流程、附件与 artifact 产出 |
| [contracts/COMPLETE-MULTI-AGENT-ORCHESTRATION-2026-06-02.md](./contracts/COMPLETE-MULTI-AGENT-ORCHESTRATION-2026-06-02.md) | P1 完整多 Agent 编排与交接合同：中文角色 runtime 配置、Orchestrator DAG、mailbox/handoff、plan retry/resume、Claude+Codex 真实 UAT |
| [contracts/ORCHESTRATOR-IM-MARKDOWN-GIT-DIFF-2026-06-03.md](./contracts/ORCHESTRATOR-IM-MARKDOWN-GIT-DIFF-2026-06-03.md) | P0 Orchestrator IM、Markdown 渲染、结构化权限确认与 Git Changes/Get Diff 合同：自定义角色确认、同工作区串行执行、AionUi Markdown 复用和 stage/unstage/discard/revert 安全闭环 |

## 技术设计

| 文档 | 说明 |
|------|------|
| [technical-design.md](./technical-design.md) | 技术路线、架构、数据模型、协议 |
| [ui-design-system.md](./ui-design-system.md) | 三端 UI 设计系统、组件契约、视觉 E2E 门禁 |
| [desktop-p0-ui-ux-contract.md](./desktop-p0-ui-ux-contract.md) | Desktop P0 UI/UX 契约 |
| [automation-reference-comparison.md](./automation-reference-comparison.md) | 自动化执行参考比较 |

## 模块调研

| 文档 | 覆盖 FR-ID |
|------|-----------|
| [modules/auth-workspace.md](./modules/auth-workspace.md) | FR-AUTH-001, FR-WS-001, FR-DEVICE-001, FR-PERM-001 |
| [modules/](./modules/) | 全部模块调研（runtime-adapters, orchestrator, desktop-connector 等） |

## 参考项目

| 文档 | 说明 |
|------|------|
| [reference-repos/](./reference-repos/) | 参考仓库对比分析 |
| [reference-repos/three-surface-workbench-component-migration.md](./reference-repos/three-surface-workbench-component-migration.md) | 三端工作台权限、diff、artifact、移动监督和 Desktop 策略组件参考迁移清单 |
| [reference-repos/agent-ui-component-evolution-roadmap.md](./reference-repos/agent-ui-component-evolution-roadmap.md) | AI Chat、权限、Artifact 与 Workbench 组件长期演进路线：assistant-ui、Vercel AI Elements、Vercel Chatbot、OpenHands、bolt.new |

## 项目跟进与执行

| 文档 | 说明 |
|------|------|
| [ai-workflow-control.md](./ai-workflow-control.md) | **AI 工作流控制协议** — Codex/Trellis/Maestro 分工、共享合同和验收口径 |
| [project-tracker.md](./project-tracker.md) | **P0/P1/P2 项目跟进表** — 所有功能状态必须在此同步 |
| [regression-ledger.md](./regression-ledger.md) | **回归、缺陷与未完成项台账** — 已完成功能暴露的问题、质量债和关闭条件 |
| [decision-log.md](./decision-log.md) | 关键产品与技术决策日志 |
| [maestro-guidance-playbook.md](./maestro-guidance-playbook.md) | Codex 指导 Maestro 开发、路由命令和验收反馈的操作手册 |
| [execution-reports/](./execution-reports/) | 阶段/里程碑级执行报告目录；不要把每个 report 单独挂到本索引 |
| [../scripts/verify-governance-gate.sh](../scripts/verify-governance-gate.sh) | Maestro/Ralph 完成前治理门禁脚本 |

## Prompt 模板

| 文档 | 说明 |
|------|------|
| [prompts/maestro-desktop-navigation-agent-settings-prompt.md](./prompts/maestro-desktop-navigation-agent-settings-prompt.md) | Desktop 导航与 Agent 设置 prompt |
| [prompts/maestro-desktop-ui-refactor-prompt.md](./prompts/maestro-desktop-ui-refactor-prompt.md) | Desktop UI 重构 prompt |
| [prompts/maestro-execution-governance.md](./prompts/maestro-execution-governance.md) | Maestro/Ralph 执行治理门禁 prompt |
| [prompts/maestro-three-surface-ui-unification-prompt.md](./prompts/maestro-three-surface-ui-unification-prompt.md) | 三端 UI 统一 prompt |

## 归档（历史/过渡文档）

| 文档 | 说明 |
|------|------|
| [archive/maestro/maestro-transition-plan.md](./archive/maestro/maestro-transition-plan.md) | Maestro 过渡计划 |
| [archive/maestro/maestro-migration-handoff.md](./archive/maestro/maestro-migration-handoff.md) | Maestro 迁移交接 |
| [archive/maestro/maestro-phase3-roadmap.md](./archive/maestro/maestro-phase3-roadmap.md) | Phase 3 路线图 |
| [archive/maestro/maestro-spec-export.md](./archive/maestro/maestro-spec-export.md) | Spec 导出记录 |
| [archive/maestro/maestro-automation-assessment.md](./archive/maestro/maestro-automation-assessment.md) | 自动化评估 |
| [archive/maestro/maestro-tdd-quality-gates.md](./archive/maestro/maestro-tdd-quality-gates.md) | TDD 质量门禁 |
| [archive/maestro/phase4-entry-guide.md](./archive/maestro/phase4-entry-guide.md) | Phase 4 入口指南 |
| [archive/maestro/ui-phase3-task-plan.md](./archive/maestro/ui-phase3-task-plan.md) | UI Phase 3 任务规划 |

---

## 治理规则

1. **工作流入口**：新会话必须先按 `ai-workflow-control.md` 判断 Codex、Trellis、Maestro/Ralph 的职责边界。
2. **共享合同**：中大型任务必须创建或引用 `contracts/<TASK-ID>.md`；Trellis task、Maestro prompt、execution report 和 Codex 验收都必须指向同一份合同。
3. **跟进义务**：Maestro/Ralph 每完成一个用户可见阶段或里程碑，必须同步更新 `project-tracker.md` 和对应任务报告；bug/regression 进入 `regression-ledger.md`。没有公开跟进记录，不允许标记任务完成。
4. **PRD 修订**：如发现 PRD/技术设计与当前计划冲突，只能新增 `prd-amendments/*.md`，不允许直接改业务代码。
5. **索引维护**：只有长期入口、合同目录、关键当前报告需要同步本索引；碎片 report、单个 bug 记录、历史证据不得进入总索引。
6. **治理门禁**：milestone/session complete 前必须运行 `bash scripts/verify-governance-gate.sh <TASK-ID>` 并确认 exit 0。status.json completed 不等于项目完成。
