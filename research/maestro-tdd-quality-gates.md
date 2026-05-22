# AgentHub Maestro TDD 与质量门禁

**状态：** Phase 3 质量策略草案
**需求源：** `research/prd.md`
**适用范围：** Maestro 接管后的 Phase 3 implementation、review、verification

---

## 1. 总原则

AgentHub Phase 3 采用 FR-ID 驱动的 TDD。每个任务先声明要覆盖的 `FR-ID`、验收来源、技术章节和测试层级，再进入实现。

测试不替代需求定义。若发现行为无法映射到 `FR-ID`，必须暂停实现并回到 `research/prd.md` 修正需求，而不是在测试中隐式新增范围。

---

## 2. TDD 执行循环

| 步骤 | 要求 | 证据 |
| --- | --- | --- |
| 1. Trace | 记录任务绑定的 `FR-ID`、产品表面、验收来源 | task metadata 或 milestone artifact |
| 2. Red | 先写能表达验收失败的测试、fixture 或人工 gate checklist | failing test、pending gate、review checklist |
| 3. Green | 实现最小能力让 gate 通过 | test output、diff summary、artifact |
| 4. Refactor | 清理重复和边界问题，不扩大需求范围 | review note、lint/typecheck |
| 5. Verify | 运行对应 L0-L4 gate | verification artifact |
| 6. Record | 归档 FR-ID 覆盖和未覆盖项 | milestone summary |

M0 `Monorepo + shared test harness` 允许以 harness 自测和 fixture 测试为主，但仍必须保留 `FR-ID` 追踪。

---

## 3. L0-L4 测试锚点

| Level | 名称 | 主要目的 | 适用范围 | 必须绑定 |
| --- | --- | --- | --- | --- |
| L0 | Traceability + static gate | 确认任务、代码、测试、产物都有 `FR-ID` 和验收来源 | 全部任务 | `research/prd.md`、product surface、technical source |
| L1 | Unit gate | 验证纯函数、状态机、policy、parser 的最小行为 | `packages/shared`、adapter parser、permission policy | 相关 `FR-ID` 和 NFR |
| L2 | Integration gate | 验证 API、数据库、DeviceChannel、Action/Runtime 边界协作 | Backend、Desktop main、Runtime Adapter | 执行域和权限相关 `FR-ID` |
| L3 | Product flow gate | 验证 Web/Desktop/Mobile 的用户流和组件状态 | Web、Desktop renderer、Mobile PWA | 产品设计章节和 PRD 验收标准 |
| L4 | Gated real runtime / demo gate | 验证真实 CLI、OAuth、Desktop 本地环境、P0 Demo 主路径 | 真 Claude/Codex、GitHub OAuth、Desktop 本地执行 | P0 Demo 主路径和人工验证记录 |

---

## 4. 各模块最低门禁

| 模块 | 最低 gate | 必测点 | 绑定需求 |
| --- | --- | --- | --- |
| Monorepo + shared harness | L0-L2 | workspace 包边界、FR-ID 常量、policy fixture、test command 可运行 | `FR-WS-001`, `FR-DEVICE-001`, `FR-RUNTIME-001`, `FR-PERM-001` |
| Auth + Workspace | L1-L3 | GitHub OAuth mock、Workspace CRUD、执行域不可变 | `FR-AUTH-001`, `FR-WS-001` |
| Web IM | L1-L3 | Session 创建、消息状态、Markdown、Artifact/Result card | `FR-WEB-001`, `FR-CHAT-001`, `FR-ARTIFACT-001`, `FR-RESULT-001` |
| Desktop Connector | L1-L4 | path containment、request scope、DeviceChannel ack、Runtime 检测 | `FR-DESK-001`, `FR-RUNTIME-001`, `FR-ACTION-001`, `NFR-SEC-001` |
| Runtime Adapter | L1-L4 | Claude/Codex parser fixture、resume fallback、error mapping、real CLI gated check | `FR-RUNTIME-001`, `FR-CTX-001`, `NFR-OBS-001` |
| Orchestrator | L1-L3 | Run 状态机、Plan DAG 无环、ready/waiting/blocked、失败节点影响范围 | `FR-ORCH-001`, `FR-CTX-001`, `FR-PERM-001` |
| Action + Approval | L1-L3 | ActionRequest 风险策略、审批状态、执行输出归档 | `FR-ACTION-001`, `FR-PERM-001`, `FR-NOTIFY-001`, `FR-RESULT-001` |
| Mobile PWA | L2-L3 | 轻量消息、审批、结果摘要、预览 | `FR-MOB-001`, `FR-NOTIFY-001`, `FR-RESULT-001` |
| P0 Demo | L3-L4 | Web 登录、Local Desktop Workspace、Runtime 执行、结果卡、Mobile 审批 | 全部 P0 `FR-ID` |

---

## 5. 质量门禁定义

### L0: Traceability + Static

通过条件：

- 每个 Maestro task 明确 `FR-ID`。
- 每个 task 指向产品设计章节或 PRD 验收标准。
- 每个 task 指向技术设计章节。
- 没有 task 引入 PRD 外范围。
- lint、format、typecheck 命令存在或明确标记为待建立。

失败处理：

- 缺 `FR-ID` 时暂停任务。
- 需求不明时更新 PRD 后再继续。

### L1: Unit

通过条件：

- shared policy、状态机、parser、纯 domain 逻辑有自动化单测。
- execution domain mismatch、runtime binding allowed、action risk policy 必须自动化测试。
- Adapter parser 使用 fixture，不依赖每次真实 CLI。

失败处理：

- 不进入集成任务。
- 如果失败暴露设计冲突，回到技术设计修订。

### L2: Integration

通过条件：

- API 或 server action 与 shared policy 集成可测。
- DeviceChannel 的 requestId、seq、ack、timeout、replay 策略有集成测试或 fixture。
- Workspace、Session、Message、Approval CRUD 与鉴权路径可验证。

失败处理：

- 不进入 UI flow gate。
- 权限绕过风险必须先修复。

### L3: Product Flow

通过条件：

- Web、Desktop、Mobile 对应 P0 用户流可跑通 smoke。
- 计划卡、审批卡、结果卡、Artifact 卡至少有主状态和失败状态验证。
- Mobile 不被实现成完整 IDE，Desktop 不复制 Web 三栏工作台。

失败处理：

- 不进入 P0 Demo hardening。
- UI 行为若偏离产品设计，先修正产品设计或实现。

### L4: Gated Real Runtime / Demo

通过条件：

- 真 Claude Code/Codex CLI 验证作为 gated integration 或手工验证记录。
- GitHub OAuth、Desktop 本地文件夹、Local Runtime 执行等外部依赖可用时有验证证据。
- 外部依赖不可用时必须记录阻塞原因和 mock 覆盖范围。

失败处理：

- 不声明 P0 Demo 完成。
- 如果失败来自 Maestro 编排或上下文追踪，触发 Trellis 回退评估。

---

## 6. Release / Milestone Gate

每个 Maestro milestone 完成前必须有：

- [ ] `FR-ID` 覆盖表。
- [ ] L0 必过证据。
- [ ] 与该 milestone 相关的最低 L1-L4 gate 结果。
- [ ] 未覆盖验收标准清单。
- [ ] P1/P2 被排除项说明。
- [ ] 用户可复查的 artifact 或测试输出摘要。

M0 额外要求：

- [ ] `Monorepo + shared test harness` 可运行。
- [ ] FR-ID 常量或等价 registry 已进入 shared 层。
- [ ] 至少一个 execution domain policy 测试可证明安全边界。
- [ ] Maestro 记录能追溯到 `research/prd.md`。

