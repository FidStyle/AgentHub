# AgentHub Maestro Phase 3 Roadmap

**状态：** 迁移后 Phase 3 执行路线草案
**首个试点：** `Monorepo + shared test harness`
**需求源：** `research/prd.md`

---

## 1. Roadmap 原则

Phase 3 只实现已由 `research/prd.md`、`research/product-design.md`、`research/technical-design.md` 收敛的范围。Maestro 负责把这些输入拆成可执行 milestone，并要求每个任务保留 `FR-ID`。

Roadmap 不重新定义 PRD，不把 P1/P2 提前做成 P0，不绕过产品设计中的三端边界。

---

## 2. Phase 3 总入口

Phase 3 的第一步不是完整产品开发，而是建立可承载后续任务的工程和测试底座：

**M0: Monorepo + shared test harness 试点**

目标：

- 建立 `apps/web`、`apps/desktop`、`packages/shared` 的最小 monorepo 骨架。
- 在 `packages/shared` 中落地 FR-ID 常量、共享 domain 类型、execution domain policy 的测试入口。
- 建立共享 test harness，让后续 Web、Desktop、Runtime、Orchestrator 测试能复用同一套 fixture 和断言风格。
- 验证 Maestro 的 task、quality gate、artifact 记录能以 `FR-ID` 追踪。

绑定需求：

- `FR-AUTH-001`
- `FR-WS-001`
- `FR-DEVICE-001`
- `FR-RUNTIME-001`
- `FR-PERM-001`
- `NFR-SEC-001`
- `NFR-OBS-001`

验收来源：

- `research/technical-design.md` 第 3、5、17.1、18 章。
- `.trellis/spec/guides/product-planning-guide.md` 的 FR-ID Traceability Rule。

---

## 3. Milestone 顺序

| Milestone | 名称 | 目标 | 主要 FR-ID | 退出标准 |
| --- | --- | --- | --- | --- |
| M0 | Monorepo + shared test harness | 建立工程骨架、共享类型、FR-ID 常量、policy 测试入口 | `FR-AUTH-001`, `FR-WS-001`, `FR-DEVICE-001`, `FR-RUNTIME-001`, `FR-PERM-001` | L0-L2 通过，能生成可追踪 Maestro artifact |
| M1 | Auth + Workspace foundation | GitHub OAuth 接入、Workspace 创建、执行域不可变 | `FR-AUTH-001`, `FR-WS-001`, `FR-DEVICE-001` | 用户身份、Workspace、执行域策略可被 API 和测试验证 |
| M2 | Web IM shell | Web 三栏工作台、Session、消息流、基础 artifact | `FR-WEB-001`, `FR-CHAT-001`, `FR-ARTIFACT-001`, `FR-RESULT-001` | Web 主路径可创建 Session 并展示消息/结果卡片占位 |
| M3 | Desktop Connector foundation | Electron Connector、设备绑定、WebSocket DeviceChannel、文件夹绑定、Runtime 检测 | `FR-DESK-001`, `FR-RUNTIME-001`, `FR-ACTION-001`, `NFR-SEC-001` | Desktop 可证明本地执行边界和连接状态 |
| M4 | Runtime Adapter baseline | Hosted Runtime、Claude Code CLI Adapter、Codex CLI Adapter、native session identity | `FR-RUNTIME-001`, `FR-AGENT-001`, `FR-CTX-001`, `NFR-OBS-001` | Adapter fixture tests 和 gated real CLI 验证路径存在 |
| M5 | Orchestrator + approvals | Run 状态机、Plan DAG、计划卡、审批队列、权限策略 | `FR-ORCH-001`, `FR-CTX-001`, `FR-PERM-001`, `FR-NOTIFY-001` | Plan DAG 校验、ready 节点调度、审批状态可测 |
| M6 | Action + result cards | ActionRequest preview/test/build/shell、Task Result Card、Diff/Preview artifact | `FR-ACTION-001`, `FR-RESULT-001`, `FR-ARTIFACT-001`, `FR-PERM-001` | P0 Demo 中可展示执行输出、文件变更、预览链接 |
| M7 | Mobile PWA control surface | Mobile Workspace/Session、轻量消息、审批、预览 | `FR-MOB-001`, `FR-CHAT-001`, `FR-NOTIFY-001`, `FR-RESULT-001` | Mobile 可查看同一 Session 并完成一个待确认动作 |
| M8 | P0 Demo hardening | 串联 Web + Desktop + Runtime + Mobile 主路径 | 全部 P0 `FR-ID` | L0-L4 按 P0 Demo 主路径通过或明确记录人工验证缺口 |

---

## 4. 每个 Maestro 任务必须包含

| 字段 | 来源 |
| --- | --- |
| `FR-ID` | `research/prd.md` Requirement Registry |
| Product surface | Web、Desktop、Mobile、Backend、Runtime Adapter、shared domain model |
| Acceptance source | PRD 验收标准或产品设计用户流 |
| Technical source | `research/technical-design.md` 对应章节 |
| Test level | L0-L4 中至少一个自动化或人工 gate |
| Out of scope | 明确不做的 P1/P2 项 |

如果任务无法填写 `FR-ID`，Maestro 必须暂停并要求先更新 PRD，不能直接实现。

---

## 5. P1/P2 处理规则

P1 可以作为 extension backlog 记录，但不能阻塞 P0 Demo：

- `FR-IM-101`
- `FR-AGENT-101`
- `FR-WORKSPACE-101`
- `FR-NOTIFY-101`

P2/P3 只保留扩展点，不进入 P0 实现：

- `FR-COLLAB-201`
- `FR-MARKET-201`
- `FR-VERSION-201`
- `FR-RUNTIME-201`
- `FR-DOCS-201`
- `FR-PUBLISH-201`

---

## 6. Roadmap 进入执行前检查

在初始化 `.workflow` 前必须确认：

- [ ] 本 roadmap 已被用户确认。
- [ ] `research/prd.md` 仍是唯一需求源。
- [ ] `Monorepo + shared test harness` 被确认作为首个试点。
- [ ] L0-L4 质量门禁已确认。
- [ ] Trellis 退出和回退条件已确认。
- [ ] 不迁移或删除 `.trellis/` 历史文件。

