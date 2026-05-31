# ACCEPTANCE-HARDENING-2026-06-01: 验收前全功能硬化共享合同

> 本合同是 Trellis 与后续 Maestro/Ralph 执行的共享事实接口。实现、测试、验收和报告都必须引用本文件。

---

## 1. 元信息

| 字段 | 内容 |
| --- | --- |
| TASK-ID | `ACCEPTANCE-HARDENING-2026-06-01` |
| 优先级 | P0 |
| 绑定 FR-ID | FR-AUTH-001, FR-WS-001, FR-WEB-001, FR-DESK-001, FR-MOB-001, FR-CHAT-001, FR-RUNTIME-001, FR-DEVICE-001, FR-ARTIFACT-001, FR-ORCH-001, FR-UI-001 |
| 来源 | `bytedance_init_prd.md`, `research/prd.md`, `research/project-tracker.md`, `research/regression-ledger.md`, `research/contracts/P0-END-TO-END-PRODUCT-FLOW.md`, `research/contracts/LOCAL-DESKTOP-OPERABILITY-001.md`, `research/contracts/THREE-SURFACE-WORKBENCH-PERMISSION-001.md` |
| 负责人角色 | Codex 控制流程与最终验收；Trellis 管实现任务与规范；Maestro/Ralph 可用于大范围执行但不得绕过本合同 |
| 状态 | active |

---

## 2. 背景与目标

项目进入验收前硬化阶段，不再以 MVP 降级口径接受“页面可见、HTTP 200、测试脚本部分通过、mock/echo 回复、环境手工拼装”作为完成。目标是在真实本地验收环境中，让 Web、Desktop、Mobile/PWA/RN 的核心用户链路全部可运行、失败态明确、刷新可恢复、门禁命令真实全绿，并留下可复现的自动化与人工 UAT 证据。

---

## 3. 用户链路合同

1. 从干净仓库启动验收环境：Postgres、Redis、seed、Auth session、Web server、runtime worker。
2. 用户从 Web 首页登录或使用测试认证进入 workspace 列表。
3. 用户创建/打开 workspace，新建 session，选择或提及 Agent，发送消息。
4. 系统调用真实 API、真实 DB、真实 runtime gateway；有 worker 时显示 agent 回复并落库，无 worker/未配置时立即显示中文错误态，不空等、不假成功。
5. 用户刷新页面后 workspace、session、用户消息、agent 回复、role badge、artifact/context/orchestrator 数据仍从 DB 恢复。
6. Desktop 可诊断本地 runtime、执行本地一次性指令、显示 stdout/stderr/失败原因，device channel 不暴露底层 no-handler。
7. Mobile/PWA 与原生 RN 不得用本地 echo 冒充回复；配置缺失必须显示中文引导，配置存在时走统一 `/api/chat` 链路。
8. 最终验收输出必须包含命令、结果、截图/报告路径、残留风险和治理门禁结果。

---

## 4. 三端职责边界

| 端 | 职责 | 不做什么 |
| --- | --- | --- |
| Web | 主工作台、Auth、Workspace/Session/Message、Role Agent、Artifact、Orchestrator、Runtime Gateway 可见闭环 | 不用 mock API 或占位空态宣称完成；不把 worker 缺失当成功 |
| Desktop | 本地 runtime 诊断、IPC bridge、CLI execute/cancel/error state、device channel、local workspace operability | 不硬编码 success echo；不展示可点无效按钮；不吞底层 IPC 错误 |
| Mobile/PWA/RN | 轻量会话、审批/预览、移动发送、错误态、配置态 | 不使用 setTimeout/local state echo；不绕过统一 API/runtime 语义 |

---

## 5. 数据与后端合同

- 数据库要求：Workspace、Session、Message、User、Account、RoleAgent、RuntimeEndpoint、RuntimeSession、RuntimeLog、Device 相关数据必须使用真实 Postgres 测试库。
- migration/seed 要求：必须有一键命令准备本地验收 DB、测试用户、Auth session、默认 workspace/agent/runtime endpoint。
- 认证/session 要求：E2E 可使用测试 auth fixture，但必须验证同一套 API、schema、权限模型；不得 mock 主链路 API。
- API 要求：Web API 单测、集成测试、smoke 测试必须被根门禁或验收脚本收集；错误文案与实现一致。
- 权限和错误语义：未登录 401、无权限 403、DB 未配置明确中文错误、runtime 未配置/无 worker 明确中文错误。

产品运行时是否允许 mock 主链路数据：**否**。

---

## 6. UI/UX 合同

- 信息架构：Web 仍为主工作台；Desktop 为本地能力端；Mobile/PWA/RN 为轻量监督和消息端。
- 核心页面/组件：Home/Auth、Workspace list、Workspace shell、Session list、Chat composer、Role picker、Artifact panel、Orchestrator panel、Desktop runtime console、Mobile chat。
- 空状态：必须区分“真实无数据”“未选择 workspace/session”“环境未配置”“运行时离线”。
- 加载状态：不能无限 pending；超时或不可用必须进入明确终态。
- 错误状态：中文、可操作、不泄露 secret。
- 中文文案要求：核心用户操作中文优先；技术词可保留但不能替代用户解释。
- 三端一致性要求：同一 runtime terminal event 在三端语义一致。

---

## 7. Trellis 派生要求

- 父任务：`.trellis/tasks/06-01-acceptance-hardening-program/`
- 子任务：
  1. `.trellis/tasks/06-01-acceptance-quality-gates/`
  2. `.trellis/tasks/06-01-acceptance-env-bootstrap/`
  3. `.trellis/tasks/06-01-acceptance-web-core-flow/`
  4. `.trellis/tasks/06-01-acceptance-desktop-runtime/`
  5. `.trellis/tasks/06-01-acceptance-mobile-surfaces/`
  6. `.trellis/tasks/06-01-acceptance-final-uat-governance/`
- `implement.jsonl` / `check.jsonl` 必须引用本合同、相关 research 合同、backend/frontend/cross-layer spec 与 end-to-end planning guide。
- 每个子任务完成前必须更新 tracker/ledger/report 证据。

---

## 8. 推荐执行顺序

1. 质量门禁与测试覆盖修复：修 lint、Web Vitest、根 test 收集、Mobile type/build fake pass。
2. 真实环境一键启动与配置：建立可复现验收命令和 smoke。
3. Web 主链路真实回归：登录、workspace、session、chat、artifact、orchestrator、reload。
4. Desktop 本地能力验收：runtime doctor、IPC execute/cancel/error、device channel。
5. Mobile PWA 与 RN 真实闭环：PWA/RN 发送、配置态、错误态、reload/可见回复。
6. 最终 UAT 与治理证据：全量命令、截图/报告、tracker/ledger、governance gate、Codex 独立验收。

---

## 9. 测试与验收合同

自动化测试必须覆盖：

- type-check：根 `pnpm type-check` 不得包含 echo skip 伪通过；Mobile 如无法完整 build，也必须有可执行 TS/RN 检查。
- lint：根 `pnpm lint` exit 0。
- build：Web、Desktop、shared 必须真实 build；Mobile 若不能产生产物，必须有明确替代验收命令且不能叫 build pass。
- API/integration：Web Vitest 必须纳入根门禁或验收脚本，失败为阻塞。
- Web E2E：workspace/session/chat/artifact/orchestrator/reload，从真实入口和真实 API 开始。
- Desktop E2E/测试：IPC、runtime execute、cancel/error、no-handler fallback。
- Mobile/PWA/RN：PWA E2E + RN client/config tests，必要时补设备/Metro 手工 UAT。
- 视觉/布局断言：无横向滚动、无重叠、关键浮层不越界、文本不溢出。
- 数据库验证：消息和 agent 回复必须落库；reload 从 DB 读回。

人工验收路径：

1. 按一键脚本启动验收环境。
2. 按 Web、Desktop、Mobile/PWA/RN checklist 完成用户操作。
3. 保存截图/录屏或 Playwright artifacts。
4. Codex 按本合同核对所有门禁，不允许用 deferred 核心链路签收。

---

## 10. 计划阶段禁止项

- 用 `playwright test --list`、grep-only、文件存在作为主验收。
- 用 mock API、mock auth、内存数据或 hardcoded sample 证明真实 DB/API/session 主链路。
- 用 `FakeExecutor` 或 prompt echo 冒充产品态 Agent 成功。
- 用 echo script 当作 type-check/build/test pass。
- 核心 E2E 默认 skip/deferred 后仍宣称验收通过。
- 只写 TODO 或“后续补真实实现”覆盖 P0 主链路行为。
- 将 `status.json completed` 或局部 report PASS 当作产品完成。

---

## 11. 完成门禁

- [ ] `pnpm lint` exit 0。
- [ ] `pnpm type-check` exit 0，且无核心 workspace echo skip 假通过。
- [ ] `pnpm build` 或分端真实 build/check 全部达到合同定义。
- [ ] 根测试或验收脚本纳入 Web Vitest，Web/API/integration 无失败。
- [ ] 真实环境一键启动与 smoke 通过。
- [ ] Web 主链路 E2E 通过。
- [ ] Desktop runtime/IPC 验收通过。
- [ ] Mobile/PWA/RN 验收通过。
- [ ] tracker、ledger、execution report 更新。
- [ ] `bash scripts/verify-governance-gate.sh ACCEPTANCE-HARDENING-2026-06-01` exit 0。
- [ ] Codex 完成最终独立验收。

---

## 12. 残留风险与后续

- 真实付费 LLM/CLI executor 与测试 `ScriptedRealExecutor` 必须明确区分；若真实 CLI 凭证不可用，验收只能标为环境阻塞，不能改写为通过。
- 原生 RN 设备级 GUI 可能需要人工设备/模拟器环境；如验收范围包含 RN，必须单列证据。
- 现有历史活跃任务较多，本合同优先级高于继续扩大新功能面。
