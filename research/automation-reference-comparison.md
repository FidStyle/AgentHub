# AgentHub 自动化参考框架对比：Maestro-Flow 与 CodeStable

**日期：** 2026-05-25
**状态：** 已收敛
**输入来源：** `refer_proj/catlog22__maestro-flow`, `refer_proj/CodeStable`, `research/prd.md`, `research/technical-design.md`, `research/ui-design-system.md`, `research/maestro-automation-assessment.md`, `research/maestro-tdd-quality-gates.md`
**覆盖 FR-ID：** `FR-ORCH-001`, `FR-CTX-001`, `FR-RUNTIME-001`, `FR-ACTION-001`, `FR-PERM-001`, `FR-RESULT-001`, `FR-UI-001`, `NFR-OBS-001`, `NFR-SEC-001`

---

## 1. 调研问题

用户关心的不是单纯“哪个参考项目更好”，而是 AgentHub 后续实现能否解决三个问题：

1. 全流程自动化：能不能从需求、计划、实现、验证、失败修复到测试闭环持续推进。
2. E2E 与 UI 测试：能不能让三端功能和视觉门禁真实落地，而不是只写浅层 `toBeVisible`。
3. 需求不确定时反写 PRD：执行中发现 PRD、UI 契约或参考项目结论不清楚时，能不能停止硬写代码并回到需求文档。

结论是：**Maestro-Flow 更适合作为自动化执行闭环参考，CodeStable 更适合作为需求、设计、验收治理参考。AgentHub 不应该二选一，而应该采用“Maestro 跑闭环，CodeStable 管漂移”的融合路线。**

---

## 2. 对比矩阵

| 维度 | Maestro-Flow | CodeStable | AgentHub 采用方式 |
| --- | --- | --- | --- |
| 核心定位 | 多 Agent 工作流编排框架 | 软件生命周期要素建模 | 执行层参考 Maestro，治理层参考 CodeStable |
| 核心实体 | lifecycle、command chain、plan、task、wave、verify、issue、wiki | requirement、architecture、roadmap、feature、issue、decision | AgentHub 使用 `FR-ID`、Plan DAG、Trellis task、research 文档承接 |
| 自动化强项 | plan -> execute -> verify -> review -> test，失败后 debug/fix/retry | 需求、设计、实现、验收、回写文档的边界清晰 | 自动推进必须绑定 PRD 与测试门禁 |
| UI/E2E 价值 | quality pipeline 和 test-gen 思路强，适合作为流程编排 | accept 阶段要求前端真实验证、对照 design 核查 | 三端 E2E 工具仍按 `research/modules/ui-and-visual-testing.md` 使用 Playwright |
| 需求不清处理 | plan 阶段可进入 `NEEDS_CONTEXT`，但偏执行链路 | design/impl 阶段默认停下来回需求或方案 | 执行中触发 PRD amendment gate |
| 参考项目注入 | task 有 `read_first[]`，execute 预加载 specs/wiki | design 是实现和验收唯一输入 | Trellis task 必须声明 `reference_sources` 或等价 read-first 文档 |
| 人在环策略 | 支持 `-y`，但也有 decision gate | 明确人在环，不把人介入视为失败 | AgentHub 目标是 L4 Governed Autonomy，不是 L5 无闸门自动化 |
| 风险 | 过度自动化时可能绕过产品边界 | 不负责高吞吐执行编排 | 两者分层使用，避免互相替代 |

---

## 3. Maestro-Flow 可借鉴点

### 3.1 自动执行闭环

Maestro-Flow 的 `maestro-ralph` 会读取项目状态、推断生命周期位置，并动态构建链路。它覆盖 `brainstorm -> blueprint -> analyze -> roadmap -> plan -> execute -> verify -> review -> test`，并在失败后插入 debug/fix/retry。

AgentHub 应借鉴：

- Run lifecycle：把一次自动化执行拆成可观察状态，而不是一段聊天。
- Plan DAG / wave：用依赖和 wave 表达并行与阻塞，避免纯文本计划。
- decision gate：在 verify、review、test 后根据证据决定继续、修复或暂停。
- retry guard：失败修复必须有上限，防止无限循环。
- knowledge harvest：把重复出现的约束写回 `.trellis/spec/` 或 `research/`。

绑定需求：`FR-ORCH-001`, `FR-CTX-001`, `FR-RESULT-001`, `NFR-OBS-001`。

### 3.2 计划执行输入

Maestro plan 的成功标准要求每个 task 有 `read_first[]`、`convergence.criteria[]`，execute 前加载 codebase docs、coding specs、UI specs、wiki knowledge。

AgentHub 应借鉴为硬规则：

- 每个 `.trellis/tasks/*/` 实现任务必须声明 `FR-ID`、`read_first`、`reference_sources`、测试锚点和收敛标准。
- 涉及 UI 的任务必须读取 `research/ui-design-system.md`、`.trellis/spec/frontend/ui-style-guidelines.md` 和对应参考项目来源。
- 任务没有参考来源时，不允许进入实现阶段。

绑定需求：`FR-UI-001`, `FR-ORCH-001`, `NFR-OBS-001`。

### 3.3 质量门禁

Maestro verify 的思路是从目标反推：Truths -> Artifacts -> Wiring，并扫描反模式和测试覆盖缺口。这适合 AgentHub 的 Phase 4。

AgentHub 应采用：

- Goal-backward verification：先确认 PRD 验收标准，再看文件、路由、组件和测试是否真实连上。
- Business-test：用 PRD Acceptance Criteria 反推 E2E 场景。
- Gap plan：测试或视觉门禁失败时，先生成 gap plan，再修复，不直接胡乱改。

绑定需求：`FR-RESULT-001`, `FR-PERM-001`, `NFR-OBS-001`。

### 3.4 不应照搬点

- 不把 AgentHub 产品做成命令行 workflow 工具；用户表面仍是 Web/Desktop/Mobile 的 IM + 工作台。
- 不用 Maestro 代替 PRD、产品设计和 UI 设计系统。
- 不把 `-y` 自动模式用于产品范围变更、权限升级、真实本地 CLI 登录、真实 OAuth、发布部署。
- 不把 mobile-dev-inc 的 Maestro 移动测试框架当成 P0 三端测试总方案。P0 Web/Mobile PWA/Electron 仍以 Playwright 为主。

---

## 4. CodeStable 可借鉴点

### 4.1 软件要素治理

CodeStable 的核心价值不是“让更多 Agent 并行”，而是把软件生命周期拆成 requirement、architecture、roadmap、feature、issue、decision。它非常适合解决用户指出的执行中问题：Agent 遇到需求不确定时不能硬做，必须回到需求或设计层。

AgentHub 应借鉴：

- PRD 是能力契约，不是实现时可随意解释的背景材料。
- roadmap/Phase 3 规划是实现前约束，不应在任务里临时重写。
- design/任务切片是实现和验收的唯一输入；没有写清楚就不能进入代码。
- acceptance 阶段要回写 PRD、技术设计、UI 契约或任务状态。

绑定需求：全部 P0 `FR-ID`，尤其是 `FR-ORCH-001`, `FR-UI-001`, `NFR-OBS-001`。

### 4.2 需求不确定时的暂停规则

CodeStable 的 `cs-feat-design` 和 `cs-feat-impl` 都强调：用户没说清的角落不能自选；实现中发现 design 没覆盖，默认停下来回 design 谈。

AgentHub 应定义以下暂停条件：

| 触发条件 | 处理方式 |
| --- | --- |
| 行为无法映射到现有 `FR-ID` | 暂停实现，更新 `research/prd.md` 或新增 PRD amendment |
| PRD 验收标准无法自动化验证 | 暂停实现，补 Acceptance Criteria 和测试锚点 |
| UI 任务未引用 `FR-UI-001` 或 UI 设计系统 | 暂停实现，补任务切片和 UI E2E 规划 |
| 参考项目建议与 PRD 冲突 | 暂停实现，记录取舍，用户确认后再继续 |
| 运行中出现方案外文件或方案外行为 | 暂停实现，更新任务 design/implement 计划 |
| E2E/截图发现布局失败但任务没有视觉验收项 | 暂停实现，补视觉门禁后再修 UI |

绑定需求：`FR-UI-001`, `FR-PERM-001`, `NFR-OBS-001`。

### 4.3 验收回写

CodeStable 的 acceptance 会对照 design 核对实现，并回写 architecture、requirement、roadmap。AgentHub 应把这个思想映射到现有目录：

| CodeStable 概念 | AgentHub 落点 |
| --- | --- |
| requirement update/backfill | `research/prd.md` 或 `research/prd-amendments/*.md` |
| architecture update | `research/technical-design.md` 或 `research/modules/*.md` |
| feature design | `.trellis/tasks/*/prd.md`、`implement.jsonl` |
| feature acceptance | `.trellis/tasks/*/check.jsonl`、Phase 4 验收记录 |
| decision/learning | `.trellis/spec/guides/*.md` 或相关 layer spec |

---

## 5. 推荐融合方案

### 5.1 执行层：采用 Maestro 风格自动闭环

AgentHub Phase 3/Phase 4 的执行顺序应是：

1. 读取 PRD、产品设计、UI 设计系统、技术设计、模块研究和 Trellis spec。
2. 生成任务计划，所有任务绑定 `FR-ID`、`read_first`、`reference_sources`、测试锚点。
3. TDD：先写单测、集成或 E2E/视觉断言，再实现。
4. 执行任务，保留每步摘要和测试证据。
5. 运行 verify/review/test。
6. 失败时生成 gap plan，再进入修复，不允许无依据乱改。
7. 通过后沉淀可复用规则到 `.trellis/spec/`。

### 5.2 治理层：采用 CodeStable 风格暂停与回写

执行中出现以下情况时，自动化链路必须从 execute 切回 planning：

- 新行为无法绑定到 `FR-ID`。
- 验收标准缺少可观察断言。
- UI 参考项目、组件库或视觉契约没有写入任务。
- 实现需要引入 PRD 未定义的权限、凭证、本地能力或发布动作。
- 技术设计与模块研究冲突。
- Playwright 截图或布局断言暴露 UI 契约缺口。

推荐产物：

```text
research/prd-amendments/
  YYYY-MM-DD-{slug}.md        # 待合并 PRD 修订，包含触发任务、影响 FR-ID、建议改动、用户确认状态

.trellis/tasks/{task}/
  prd.md                      # 回填修订后的需求与验收
  implement.jsonl             # 更新实现步骤和 read_first
  check.jsonl                 # 更新测试与视觉门禁
```

PRD amendment 合并后，再更新 `research/prd.md`。小范围明确修订可以直接更新 PRD，但必须在提交说明中写明影响的 `FR-ID`。

### 5.3 参考项目注入规则

后续实现不能只靠记忆说“参考过 refer_proj”。任务必须显式声明参考来源：

| 任务类型 | 必读参考 |
| --- | --- |
| UI 基础与组件 | `research/ui-design-system.md`, `.trellis/spec/frontend/ui-style-guidelines.md`, AionUi/codeg/cherry-studio/lobehub 对应参考说明 |
| Web 工作台 | AionUi 聊天/预览分栏、codeg 侧栏/输入框、`research/modules/ui-and-visual-testing.md` |
| Desktop Connector | AionUi LocalAgents/AgentCard/ChatLayout、cherry-studio 桌面密度、Runtime 配置边界、`research/modules/desktop-connector.md` |
| Mobile/PWA | lobehub 移动会话布局、`research/modules/client-shells.md` |
| Orchestrator/自动化 | Maestro-Flow plan/execute/verify 思路、`research/automation-reference-comparison.md` |
| 需求漂移治理 | CodeStable design/impl/accept 暂停与回写思路、`research/automation-reference-comparison.md` |

---

## 6. 对 E2E/UI 测试的结论

“Maestro”这个名字需要区分两类项目：

1. `catlog22__maestro-flow`：多 Agent 自动化编排框架，适合参考自动执行闭环。
2. mobile-dev-inc Maestro：移动端 Flow 测试框架，适合未来原生移动壳或 Capacitor 包装壳测试。

AgentHub P0 的三端形态是 Web、Electron Desktop、Mobile/PWA。因此测试路线保持既定结论：

- Web 桌面：Playwright Chromium。
- Mobile/PWA：Playwright mobile viewport/device profile。
- Desktop Electron：Playwright Electron。
- 未来 Capacitor/原生移动壳：再评估 mobile-dev-inc Maestro 或 Appium。

E2E 必须包含：

- 深度交互：点击、输入、审批、状态流转、错误恢复。
- 视觉截图：关键页面和关键状态都要留存。
- 布局断言：无横向滚动、bounding box 不重叠、长文本不溢出。
- 安全断言：截图和 DOM 中不出现 API Key、完整环境变量、未授权本地路径。

---

## 7. 对现有 Phase 3 的调整

已有无 UI 的 Phase 3 任务不能直接视为完整执行依据。进入实现前需要补齐：

1. 每个任务绑定 `FR-UI-001` 或明确说明不涉及 UI。
2. 每个 UI 任务声明参考项目来源和组件复用要求。
3. 每个任务写入 Playwright 功能断言、截图断言和布局断言。
4. 每个任务写入需求漂移处理：无法映射 `FR-ID` 时暂停并更新 PRD。
5. 每个任务的 `check.jsonl` 包含视觉门禁和敏感信息门禁。

如果任务切片里没有这些字段，不能进入 Phase 4 自动执行。

---

## 8. 最终决策

AgentHub 的全流程自动化参考路线如下：

| 层级 | 采用参考 | 决策 |
| --- | --- | --- |
| 自动化执行编排 | Maestro-Flow | 作为 plan/execute/verify/review/test/fix-loop 的主参考 |
| 需求、设计、验收治理 | CodeStable | 作为需求不清暂停、PRD 反写、验收回写的主参考 |
| 三端 E2E/UI 测试工具 | Playwright 分端方案 | Web/Mobile PWA 用 browser projects，Desktop 用 Playwright Electron |
| 未来原生移动测试 | mobile-dev-inc Maestro 或 Appium | 进入 Capacitor/原生移动壳后再评估 |

一句话结论：

> **Maestro-Flow 负责让自动化跑起来，CodeStable 负责让自动化不跑偏。AgentHub 需要两者融合，但 P0 的三端 E2E/UI 测试工具仍然是 Playwright 分端方案。**

---

## 9. 提交纪律

本文件更新后应与以下文件一同提交：

- `research/technical-design.md`
- `research/README.md`
- `research/modules/README.md`
- `.trellis/spec/guides/product-planning-guide.md`

建议提交信息：

```bash
git commit -m "补充自动化参考框架对比"
```
