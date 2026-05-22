# AgentHub Maestro Spec Export

**状态：** 迁移前 spec 映射草案
**目标：** 把现有 Trellis/research 知识转换为 Maestro 可加载的执行规范
**限制：** 当前不初始化 `.workflow`，不写入 Maestro state

---

## 1. Export 原则

Spec export 只搬运和结构化已确认知识，不改变产品范围。`research/prd.md` 继续是唯一需求源，`FR-ID` 继续是唯一需求追踪键。

Trellis 的 `.trellis/spec/` 和 `.trellis/tasks/` 在迁移期保留。Maestro spec 是执行视图，不是 Trellis 文件的替代品。

---

## 2. Source of Truth

| 来源 | Maestro 中的用途 |
| --- | --- |
| `research/prd.md` | 需求 registry、P0/P1/P2 范围、验收标准 |
| `research/product-design.md` | 产品表面、用户流、组件状态、P0 Demo 主路径 |
| `research/technical-design.md` | 技术路线、monorepo、数据模型、协议、实现顺序、测试策略 |
| `.trellis/spec/guides/product-planning-guide.md` | FR-ID 追踪规则和常见误区 |
| `research/modules/*.md` | 技术细节争议时的证据层 |
| `research/reference-repos/*.md` | 参考项目证据层，不直接决定架构 |

---

## 3. Maestro Spec 分类建议

| Maestro category | 导出内容 | 来源 |
| --- | --- | --- |
| `arch` | 三端架构、执行域模型、Runtime/Action 边界、Plan DAG 原则 | `technical-design.md` 第 2-5、10-13 章 |
| `coding` | monorepo 包边界、`packages/shared` 约束、Electron renderer/main 边界 | `technical-design.md` 第 3、15 章 |
| `test` | TDD 流程、L0-L4 gate、fixture 策略、P0 Demo smoke | `technical-design.md` 第 18 章和 `maestro-tdd-quality-gates.md` |
| `review` | FR-ID traceability、P0/P1/P2 防漂移、常见误区 | `product-planning-guide.md` |
| `debug` | Runtime schema 变化、DeviceChannel ack、Desktop offline、Realtime 延迟等风险 | `technical-design.md` 第 16、19 章 |
| `learning` | 模块研究和参考项目结论索引 | `research/modules/*.md`、`reference-repos/*.md` |

---

## 4. 必导出规则

### FR-ID Traceability Rule

每个实现任务必须包含：

- `FR-ID`：来自 `research/prd.md`。
- Product surface：Web、Desktop、Mobile、Backend、Runtime Adapter、shared domain model。
- Acceptance source：PRD 验收标准或 product-design 用户流。
- Technical source：technical-design 章节。

如果行为不能映射到现有 `FR-ID`，暂停实现并更新 PRD。

### Product Boundary Rule

- Web 是完整三栏 IM 工作台。
- Desktop 是 Connector Console，不复制 Web 工作台。
- Mobile 是轻量 IM、审批和预览，不做复杂代码编辑器。
- 用户面对 Role Agent，不面对 Claude Code/Codex 工具名。

绑定需求：

- `FR-WEB-001`
- `FR-DESK-001`
- `FR-MOB-001`
- `FR-AGENT-001`
- `FR-RUNTIME-001`

### Execution Domain Rule

- Workspace 创建后执行域不可混用。
- Cloud Workspace 只能使用云端 Runtime 和云端 Action。
- Local Desktop Workspace 只能通过已认证且在线的 Desktop Connector 执行本地 Runtime 和 Action。
- Web/Mobile 是控制端，不承载本地文件读写或本地命令执行。

绑定需求：

- `FR-WS-001`
- `FR-DEVICE-001`
- `FR-DESK-001`
- `FR-RUNTIME-001`
- `FR-ACTION-001`
- `NFR-SEC-001`

### Orchestrator Rule

- Orchestrator 只在未指定角色、显式 @ Orchestrator、@ 多个 Role Agent、或 Direct Role Flow 升级时介入。
- Plan DAG 必须结构化，包含节点、依赖、ready/waiting/blocked 状态。
- LLM 生成候选计划，系统负责 DAG 校验和调度。
- 默认执行前请求用户确认，高风险动作始终需要确认。

绑定需求：

- `FR-ORCH-001`
- `FR-CTX-001`
- `FR-PERM-001`
- `FR-NOTIFY-001`
- `FR-RESULT-001`

### Quality Gate Rule

- M0 从 `Monorepo + shared test harness` 开始。
- L0 traceability 对所有任务必过。
- L1-L2 先覆盖 shared policy、状态机、adapter parser、API/DeviceChannel。
- L3-L4 用于产品主路径和真实 Runtime 验证。

绑定需求：

- 全部 P0 `FR-ID`
- `NFR-SEC-001`
- `NFR-OBS-001`

---

## 5. 初始化 `.workflow` 后的建议导出顺序

当前不要执行这些动作。以下顺序只在用户确认后使用：

1. 初始化 Maestro `.workflow`。
2. 先导出 `review` 类：FR-ID traceability、P0/P1/P2 防漂移。
3. 再导出 `arch` 类：三端架构、执行域、Runtime/Action、Orchestrator。
4. 再导出 `test` 类：TDD 和 L0-L4 gate。
5. 最后导出 `coding`、`debug`、`learning` 类。
6. 创建 M0 milestone：`Monorepo + shared test harness`。

---

## 6. Export 验收清单

- [ ] Maestro spec 能回答每个 Phase 3 task 的 `FR-ID` 来源。
- [ ] Maestro spec 不包含 PRD 外的新需求。
- [ ] Maestro spec 没有把 P1/P2 写成 P0。
- [ ] Maestro spec 保留 Trellis 作为只读参考和回退来源。
- [ ] Maestro spec 能驱动 L0-L4 gate。
- [ ] `.workflow` 只在交付文件确认后初始化。

