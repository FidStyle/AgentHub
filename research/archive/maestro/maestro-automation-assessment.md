# AgentHub Maestro 全自动闭环评估

**日期：** 2026-05-23  
**状态：** Draft  
**输入来源：** `research/prd.md`, `research/product-design.md`, `research/technical-design.md`, `.workflow/state.json`, `.workflow/roadmap.md`, `.workflow/specs/*`, `refer_e2e_proj/maestro-flow`, `refer_e2e_proj/maestro-flow-one`, `refer_e2e_proj/maestro`, 用户提供的 Maestro-Flow 帖子材料  
**绑定 FR-ID：** `FR-ORCH-001`, `FR-RUNTIME-001`, `FR-CTX-001`, `FR-RESULT-001`, `FR-PERM-001`, `FR-NOTIFY-001`, `NFR-SEC-001`, `NFR-OBS-001`

---

## 1. 结论

AgentHub 可以做到 **长链自动推进 + 自动质量修复闭环 + 自动知识沉淀**，但不应承诺“无人工治理的无限自动开发”。

更准确的目标是：

> 在 PRD、产品设计、技术设计、spec 和 roadmap 已锁定的范围内，由 Maestro 自动推进 analyze -> plan -> execute -> verify -> review -> test -> harvest，并在失败时自动插入 debug/fix/retry；但计划确认、高风险权限、外部凭据、真实 CLI 登录、发布部署和产品范围变更必须保留人工闸门。

这个边界与 AgentHub 自身 PRD 一致：`FR-ORCH-001` 要求 Orchestrator 计划与分派，`FR-PERM-001` 要求权限策略与确认，`NFR-SEC-001` 要求本地控制边界安全，`NFR-OBS-001` 要求过程可检查。

---

## 2. 自动化等级定义

| 等级 | 名称 | 行为 | AgentHub 当前可达性 |
| --- | --- | --- | --- |
| L0 | Manual | 人手动读文档、手动拆任务、手动执行 | 已超过 |
| L1 | Assisted | Agent 按单步命令生成 plan 或代码 | 已具备 |
| L2 | Scripted Chain | 固定链路执行 analyze -> plan -> execute -> verify | 已具备 |
| L3 | Adaptive Loop | 质量门失败后自动 debug/fix/retry，状态可恢复 | Maestro Ralph 设计具备，AgentHub 可启用 |
| L4 | Governed Autonomy | 在 FR-ID、spec、权限策略、质量门约束下长链推进 | AgentHub 的合理目标 |
| L5 | Ungated Autonomy | 无确认、无权限闸门、无限自推进 | 不建议，也不符合 PRD 安全边界 |

AgentHub 应定位在 L4，而不是 L5。

---

## 3. Maestro-Flow 帖子与参考项目判断

### 3.1 `catlog22/maestro-flow`

可借鉴点：

- `maestro-ralph` 是 closed-loop decision engine：读取项目状态，推断 lifecycle position，构建动态 chain，并在 decision gate 后插入 debug/fix/retry。
- `maestro-ralph-execute` 是单步执行器：每次定位 session，执行下一步，写回 `status.json`，再自调用推进。
- `quality-loop.json` 把 verify、business-test、review、test、debug、gap plan、re-execute 做成循环，而不是一次性质量检查。
- `GraphWalker`/`ChainGraph` 的 `command`、`decision`、`gate`、`fork`、`join`、`terminal` 结构可转译为 AgentHub 的 Plan DAG 与 Orchestrator Run 状态机。
- 知识体系把 `.workflow/specs/` 作为约束层，把 `.workflow/knowhow/` 作为积累层；`tool: true` knowhow 可以成为可执行流程，被 `spec-load` 自动发现。

AgentHub 采用方式：

| Maestro-Flow 能力 | AgentHub 落点 | FR-ID |
| --- | --- | --- |
| Ralph 自适应链路 | Orchestrator run lifecycle 和 Maestro Phase 3 执行流 | `FR-ORCH-001`, `NFR-OBS-001` |
| decision gate + fix loop | verify/review/test 失败后的自动修复闭环 | `FR-ORCH-001`, `FR-RESULT-001` |
| `max_visits`/retry guard | 避免自动修复无限循环 | `FR-PERM-001`, `NFR-SEC-001` |
| `.workflow/specs` | 执行约束、编码规范、质量规则 | 全部 P0 FR-ID |
| `knowhow tool` | API/E2E/验收流程可执行化 | `FR-RUNTIME-001`, `FR-RESULT-001`, `NFR-OBS-001` |

不应照搬：

- 不把 AgentHub 产品形态变成 CLI command chain 工具。AgentHub 的用户表面仍是 IM + Web/Desktop/Mobile。
- 不把所有质量门都做成无人批准。计划确认、权限升级、真实本地执行、发布部署仍应走 approval。

### 3.2 `catlog22/maestro-flow-one`

可借鉴点：

- 单 skill 包装多命令，适合作为跨 Claude/Codex 的最小分发模型。
- Codex 侧强调 wave execution loop 和子 Agent 稳定挂起，适合 AgentHub 后续实现 Role Agent 调度经验。
- 模板化 decision gate/fix-loop 可用于 AgentHub 内部 Maestro command chain，而不是直接暴露给终端用户。

AgentHub 采用方式：

- 在工程实现阶段使用 Maestro skill/command 链推进。
- 产品内部的 Orchestrator 仍以数据库中的 Run、Plan DAG、Approval、RuntimeEvent 为真相源。

绑定需求：`FR-ORCH-001`, `FR-RUNTIME-001`, `FR-CTX-001`。

### 3.3 `mobile-dev-inc/maestro`

这个项目虽然也叫 Maestro，但定位不同：它更像 Mobile/Web flow E2E 的 YAML 测试框架。

可借鉴点：

- flow parser、tag include/exclude、执行顺序规划、fixture 测试。
- 适合 AgentHub Mobile/PWA 后期验收，不适合作为 Orchestrator 主实现。

绑定需求：`FR-MOB-001`, `FR-NOTIFY-001`, `FR-RESULT-001`。

---

## 4. AgentHub 当前状态

已具备：

- `research/prd.md` 有 Requirement Registry、FR-ID 和 Acceptance Criteria。
- `research/product-design.md` 将页面、用户流、状态和交互绑定到 FR-ID。
- `research/technical-design.md` 明确三端架构、Runtime Adapter、Plan DAG、权限、测试策略。
- `.workflow/state.json` 已存在，当前 `current_milestone = M1`，M0 已完成，M1 active。
- `.workflow/roadmap.md` 已把 M1-M8 拆成 milestone，并要求 implementation task 引用 FR-ID。
- `.workflow/specs/*` 已包含 coding、architecture、test、quality、review、debug、learning、ui 约束。

当前缺口：

| 缺口 | 影响 | 建议 |
| --- | --- | --- |
| M1 还没有 analyze/plan artifact | Ralph 可以推断 M1，但执行前缺少 M1 任务级收敛材料 | 先跑 `maestro-ralph -y` 或显式 `maestro-analyze M1` -> `maestro-plan M1` |
| `.workflow/knowhow/` 只有 wiki 连接记录，缺少业务 tool | test agent 不能自动发现 API/E2E 验证流程 | 为 M1 注册 Auth/Workspace API 验证 tool |
| FR-ID 到 plan/task 的自动校验仍需持续执行 | Agent 可能在执行时漂移到未授权范围 | M1 plan 必须声明 FR-ID、验收来源、测试锚点、out-of-scope |
| 高风险权限闸门需要固化 | 自动化可能误执行本地 shell、文件系统、外部服务动作 | 把 plan approval、action approval、permission escalation 做成必须 gate |
| 真实 external BaaS OAuth、Claude/Codex 登录、Desktop 本地目录无法完全模拟 | L4/L5 验证仍需要人工或受控凭据 | 用 fixture/in-process L3 作为常规门禁，真实 runtime 放 L4 manual/gated |

---

## 5. 哪些可以全自动

在 M1 这类清晰 milestone 中，可以自动化：

1. 从 `.workflow/state.json` 读取当前 milestone。
2. 从 `research/` 和 `.workflow/specs/` 加载需求、产品、技术和约束。
3. 生成 M1 analyze artifact。
4. 生成 M1 plan，并强制绑定 `FR-AUTH-001`, `FR-WS-001`, `FR-DEVICE-001`。
5. 在 execute 前声明测试锚点。
6. 先写 L0/L1/L2 测试，再实现。
7. 运行 verify/review/test。
8. 如果失败，自动进入 debug -> gap plan -> re-execute -> verify。
9. 通过 manage-harvest/learn/knowhow 把可复用决策沉淀回 `.workflow/specs/` 和 `.workflow/knowhow/`。

适用 FR-ID：

- M1：`FR-AUTH-001`, `FR-WS-001`, `FR-DEVICE-001`
- 后续编排：`FR-ORCH-001`, `FR-PERM-001`, `FR-NOTIFY-001`
- Runtime/上下文：`FR-RUNTIME-001`, `FR-CTX-001`, `FR-RESULT-001`

---

## 6. 哪些必须人工闸门

以下不应被 `-y` 完全跳过：

| 闸门 | 原因 | 绑定 FR-ID / NFR |
| --- | --- | --- |
| 产品范围变更 | PRD 是 SSOT，Agent 不应自行扩 P0 | 全部 FR-ID |
| plan approval | 用户必须知道 Orchestrator 要做什么 | `FR-ORCH-001`, `FR-PERM-001` |
| 权限升级 | 本地 shell、文件写入、外部网络、凭据读取都有风险 | `FR-PERM-001`, `NFR-SEC-001` |
| 真实 OAuth/external BaaS 项目配置 | 涉及外部账号和密钥 | `FR-AUTH-001`, `NFR-SEC-001` |
| Claude Code/Codex 真 CLI 登录和 session resume | 登录态与计费/权限不可由 Agent 假设 | `FR-RUNTIME-001`, `FR-CTX-001` |
| Desktop 本地目录授权 | 本地文件系统边界必须由用户授权 | `FR-DESK-001`, `NFR-SEC-001` |
| 发布部署 | P0 已推迟完整发布平台，不能隐式上线 | `FR-PUBLISH-201` deferred |

---

## 7. 推荐自动推进模式

### 7.1 M1 自动推进命令意图

建议使用 Ralph，但意图必须把 SSOT、FR-ID、TDD 和权限边界写死：

```text
maestro-ralph -y "以 research/prd.md、research/product-design.md、research/technical-design.md、.workflow/roadmap.md 和 .workflow/specs/ 为唯一执行依据，自动推进当前 M1 Auth + Workspace Foundation。所有 analyze、plan、execute、verify、review、test 产物必须绑定 FR-AUTH-001、FR-WS-001、FR-DEVICE-001；进入 execute 前必须声明首个测试锚点；不得修改产品边界；遇到权限升级、外部凭据、真实本地 runtime 或发布部署必须暂停请求确认。"
```

### 7.2 M1 首个测试锚点

M1 的首个测试锚点应是：

```text
L2 Auth/Workspace contract test:
GitHub OAuth mock -> authenticated profile -> create cloud/local workspace -> list workspace -> reject execution_domain mutation -> derive session/runtime/action policy from workspace domain.
```

绑定需求：`FR-AUTH-001`, `FR-WS-001`, `FR-DEVICE-001`, `FR-PERM-001`。

### 7.3 需要补的 knowhow tool

应把以下流程注册成 `.workflow/knowhow/` 下的 `tool: true` recipe：

| Tool | category | 用途 | FR-ID |
| --- | --- | --- | --- |
| Auth Workspace API Contract Verification | test | M1 API/contract 验证 | `FR-AUTH-001`, `FR-WS-001` |
| Execution Domain Policy Matrix | test | cloud/local runtime/action 兼容矩阵 | `FR-DEVICE-001`, `FR-PERM-001` |
| Plan DAG Validator Checklist | test | M5 Orchestrator DAG 验证 | `FR-ORCH-001`, `FR-PERM-001` |
| Runtime Follow-Up Delivery Verification | test | queue/inject/cancel 投递语义验证 | `FR-RUNTIME-001`, `FR-CTX-001` |

---

## 8. 对 AgentHub 产品自身的启发

Maestro-Flow 的价值不仅是帮助开发 AgentHub，也能反推 AgentHub 的产品设计：

1. AgentHub 的 Orchestrator 需要结构化 Plan DAG，不能只保存一段 LLM plan 文本。绑定 `FR-ORCH-001`。
2. 自动推进必须有 approval 和 risk policy。绑定 `FR-PERM-001`, `NFR-SEC-001`。
3. 每个 Agent run 必须有 durable events、result card 和 diagnostic。绑定 `FR-RESULT-001`, `NFR-OBS-001`。
4. Runtime follow-up 要显式建模为 `queue_after_current`、`inject_if_supported`、`cancel_and_restart`，不能让聊天消息语义漂移。绑定 `FR-RUNTIME-001`, `FR-CTX-001`。
5. 可执行知识 `tool: true` 本质上就是 AgentHub 未来的“项目内工作流资产”，可以作为 Role Agent 能力和团队知识库的早期雏形。绑定 `FR-AGENT-001`, `FR-CTX-001`。

---

## 9. 决策

AgentHub Phase 3 应采用 **Governed Autonomy**：

- 默认允许 Maestro 自动推进低风险 analyze/plan/execute/verify/review/test。
- 默认要求每个 plan 和 execute step 绑定 FR-ID。
- 默认要求 execute 前先声明测试锚点。
- 默认允许失败后自动 debug/fix/retry，但必须有 retry 上限。
- 默认把验证流程沉淀为 `.workflow/knowhow/` 的 `tool: true` 文档。
- 默认禁止 Agent 自行扩大 PRD、绕过权限、读取未授权凭据、执行真实发布。

这可以满足“尽量全自动”，同时不破坏 AgentHub 的产品安全边界。

---

## 10. Commit Discipline

本文件更新后应执行：

```bash
git add research/maestro-automation-assessment.md
git commit -m "docs: 评估 maestro 全自动闭环边界"
```
