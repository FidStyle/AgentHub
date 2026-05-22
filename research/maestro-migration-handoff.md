# AgentHub Maestro 迁移交接说明

**状态：** 迁移交付草案，等待确认后再初始化 `.workflow`
**范围：** 只规划 AgentHub Phase 3 从 Trellis 任务流迁移到 Maestro 执行流
**需求源：** `research/prd.md`

---

## 1. 交接结论

AgentHub 已完成 Phase 1 / Phase 2 研究与设计收敛，后续 Phase 3 可以由 Maestro 接管执行编排，但接管边界必须限制在实现任务管理、质量门禁、里程碑追踪和执行产物归档。Maestro 不重新定义产品范围，不替代 PRD，不改变 P0/P1/P2 优先级。

本次交付只新增迁移计划文档，不初始化 `.workflow`。`.workflow` 应在这些文件经用户确认后再由 Maestro 初始化。

---

## 2. 当前只读检查

| 检查项 | 当前结果 |
| --- | --- |
| `maestro --version` | `0.4.17` |
| `.workflow` | 当前不存在 |
| git dirty 状态 | 已存在 Maestro/agent 安装相关改动和子模块状态变更；本交付只新增 `research/maestro-*.md` 文件 |

---

## 3. 已读取输入

| 输入 | 用途 |
| --- | --- |
| `research/prd.md` | 唯一需求源、FR-ID Registry、P0/P1/P2 范围、验收标准 |
| `research/product-design.md` | Web、Desktop、Mobile 页面、用户流、组件状态、P0 Demo 主路径 |
| `research/technical-design.md` | 技术路线、monorepo 结构、架构、API、协议、实现顺序、测试策略 |
| `.trellis/spec/guides/product-planning-guide.md` | FR-ID 追踪规则和 AgentHub 常见实现误区 |
| `research/reference-repos/e2e/agenthub-phase3-e2e-findings.md` | 当前不存在，迁移计划不依赖该文件 |

---

## 4. 不变约束

| 约束 | 说明 |
| --- | --- |
| `FR-ID` 是唯一需求追踪键 | 每个 Maestro milestone、task、test gate、review artifact 都必须引用一个或多个 `FR-ID` |
| `research/prd.md` 是需求源 | 迁移文档只能引用和组织需求，不能新增、删除或改写需求范围 |
| P0 优先 | Phase 3 首先交付 P0 Demo 主路径，不把 P1/P2 能力提前做重 |
| 产品三端边界不变 | Web 是主工作台，Desktop 是 Connector，Mobile 是轻量 IM/审批/预览 |
| 执行域边界不变 | Cloud Workspace 与 Local Desktop Workspace 不能混用 Runtime 或 Action 执行域 |
| Trellis 文件不移动、不删除 | Trellis 在迁移期作为已确认知识源和回退机制保留 |
| `.workflow` 暂不初始化 | 等本组交付文件确认后再执行 Maestro 初始化 |

---

## 5. Maestro 接管边界

Maestro 可以接管：

- Phase 3 milestone 和 task 编排。
- 每个任务的 `FR-ID`、产品表面、技术章节、验收来源记录。
- TDD 执行顺序和 L0-L4 质量门禁。
- 任务产物、测试证据、review 证据和 release notes 草稿归档。
- 多 Agent 协作时的上下文打包、检查点、状态记录。

Maestro 不接管：

- PRD 范围定义。
- P0/P1/P2 优先级裁决。
- 技术路线重选，除非用户明确要求重开设计。
- Trellis 历史任务和 `.trellis/spec/` 的删除、移动或重写。
- `.workflow` 初始化前的任何执行状态写入。

---

## 6. Trellis 退出条件

Trellis 从主执行流退出的条件：

1. 用户确认本组 Maestro 迁移交付文件。
2. 迁移文件中的 Phase 3 roadmap、quality gates、spec export、transition plan 无未决阻塞项。
3. 初始化 `.workflow` 前明确保存 Trellis 作为只读参考和回退机制。
4. Maestro 初始化后能生成包含 `FR-ID`、验收来源和质量门禁的首个 Phase 3 试点 milestone。
5. 首个试点 `Monorepo + shared test harness` 能通过 L0-L2 门禁，且记录的证据可追溯到 `research/prd.md`。

退出后，Trellis 不再作为默认任务驱动器，但 `.trellis/spec/` 和 `.trellis/tasks/` 仍保留为历史和规范参考。

---

## 7. Trellis 回退接管条件

出现以下任一情况时，Trellis 回退接管 Phase 3：

| 触发条件 | 回退动作 |
| --- | --- |
| Maestro 初始化失败或 `.workflow` 状态不可恢复 | 停止 Maestro 执行，回到 Trellis task flow |
| Maestro 任务缺少 `FR-ID` 或验收来源 | 暂停实现，用 Trellis 规则重新切片 |
| Maestro 产物重定义 PRD 或绕过 P0/P1/P2 边界 | 退回 `research/prd.md` 和 Trellis planning guide 校正 |
| L0-L4 门禁无法记录证据 | 回到 Trellis check 流程，直到测试和 review 证据可追踪 |
| 首个试点未能产出可用 monorepo/test harness 基线 | 终止迁移试点，恢复 Trellis Phase 3 任务拆解 |
| 用户要求暂停 Maestro 迁移 | 保留新增 research 文档，继续用 Trellis |

回退不删除 Maestro 安装文件，不清理用户已有 dirty 状态，除非用户单独要求。

---

## 8. 后续交付文件

| 文件 | 作用 |
| --- | --- |
| `research/maestro-phase3-roadmap.md` | Phase 3 Maestro roadmap，从 `Monorepo + shared test harness` 试点开始 |
| `research/maestro-tdd-quality-gates.md` | TDD 流程和 L0-L4 测试质量门禁 |
| `research/maestro-spec-export.md` | 从 Trellis/research 导出 Maestro spec 的映射方案 |
| `research/maestro-transition-plan.md` | Trellis 到 Maestro 的迁移步骤、退出点和回退点 |

