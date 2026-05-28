# P0-END-TO-END-PRODUCT-FLOW: MVP 端到端产品主链路共享合同

> 本合同是 Trellis 与 Maestro/Ralph 的共享事实接口。实现、测试、验收和执行报告都必须引用本文件。

---

## 1. 元信息

| 字段 | 内容 |
| --- | --- |
| TASK-ID | `P0-END-TO-END-PRODUCT-FLOW` |
| 优先级 | P0 |
| 绑定 FR-ID | `FR-AUTH-001`, `FR-WS-001`, `FR-DEVICE-001`, `FR-WEB-001`, `FR-DESK-001`, `FR-MOB-001`, `FR-CHAT-001`, `FR-UI-001`, `FR-RUNTIME-001`, `FR-PERM-001` |
| 来源 | `bytedance_init_prd.md`, `research/prd.md`, `research/product-design.md`, `research/technical-design.md`, `research/ui-design-system.md`, `research/ai-workflow-control.md` |
| 负责人角色 | Codex 控制流程；Trellis 管实现规范；Maestro/Ralph 管大范围执行 |
| 状态 | active |

---

## 2. 背景与目标

AgentHub MVP 的成功标准不是单页可见、单接口 200 或按钮点击有反馈，而是用户可以从真实入口完成一条可演示的多 Agent 协作链路。

本合同定义 P0 端到端产品主链路，用于验证当前工作流、测试体系和后续实现是否能自行发现主链路断点。

---

## 3. 用户链路合同

### 3.1 主链路

1. 用户在本地启动 AgentHub Web 与 Desktop。
2. 用户从 Web、Desktop 或 Mobile/PWA 进入登录入口。
3. 用户通过 GitHub OAuth 完成认证。
4. 系统创建或恢复同一个 AgentHub 用户身份。
5. 用户进入 Web 主工作台。
6. 用户创建或选择 Workspace，并明确执行域是 `cloud` 或 `local_desktop`。
7. 用户在 Workspace 内创建 Session。
8. 用户发送一条消息；未指定 Role Agent 时进入 Orchestrated Flow，指定 Role Agent 时进入 Direct Role Flow。
9. 系统把消息、Session 状态、Agent 状态和必要结果写入真实数据库。
10. Web 显示三栏 IM 工作台：Workspace/Session、消息流、Artifact/Context/Agents/Preview。
11. Desktop 显示同一账号的本地 Connector 状态、Runtime 检测结果、本地 Workspace 绑定状态、轻量会话入口和可执行/不可执行原因。
12. Mobile/PWA 显示同一账号的 Workspace/Session、消息摘要、审批和预览入口。
13. 刷新 Web、重启 Desktop 或重新打开 Mobile 后，用户仍能看到一致的 Workspace、Session 和消息状态。

### 3.2 完成条件

- 同一个用户身份能跨 Web、Desktop、Mobile/PWA 访问同一套 Workspace 和 Session 数据。
- Workspace、Session、Message、Account、User 等主链路数据必须落真实数据库。
- Desktop 不需要复制完整 Web 工作台，但必须清楚呈现本地 Connector 与 Runtime 状态，并能把用户带到有效的 Web Workspace/Session。
- 所有失败都必须显示可理解的中文错误和下一步，而不是空白页、无响应、假成功或未授权裸错误。

---

## 4. 三端职责边界

| 端 | 职责 | 不做什么 |
| --- | --- | --- |
| Web | 主力端；完整 IM、Workspace、Session、Agent、Artifact、预览和编辑体验 | 不直接访问用户本地文件或本地端口 |
| Desktop | 本地能力端；账号/设备绑定、本地 Workspace 文件夹绑定、Runtime 检测、本地 Action 执行、连接状态、轻量本地 Agent 会话 | 不复制完整 Web 三栏工作台；不保存本地 CLI API Key/Base URL；不绕过后端和 DeviceChannel 执行指令 |
| Mobile/PWA | 轻量端；查看 Workspace/Session、轻量消息、审批、任务进度和预览 | 不承担完整代码编辑、本地 Runtime Connector 或桌面级 Diff 合并 |

---

## 5. 数据与后端合同

- 数据库要求：使用真实 Postgres/Drizzle schema；主链路禁止内存 mock。
- migration/seed 要求：本地开发必须有可重复的 migration 和最小 seed/test fixture 路径。
- 认证/session 要求：Auth.js v5 + GitHub OAuth；同一用户身份跨端一致；未登录不得访问受保护 Workspace/Session。
- API 要求：
  - `/api/workspaces` 支持真实列表与创建。
  - `/api/sessions` 支持真实列表与创建。
  - `/api/sessions/:id/messages` 支持真实读取与发送。
  - Desktop 设备绑定与 DeviceChannel 状态必须可查询或可观察。
- 权限和错误语义：
  - 未登录：`AUTH_REQUIRED` 或等价中文错误。
  - Desktop 离线：`DEVICE_OFFLINE` 或等价中文错误。
  - 执行域不匹配：`EXECUTION_DOMAIN_MISMATCH` 或等价中文错误。
  - Runtime 未登录：`RUNTIME_AUTH_REQUIRED` 或等价中文错误。

产品运行时是否允许 mock 主链路数据：**否**。

---

## 6. UI/UX 合同

- Web 首屏登录后必须进入可用主工作台或 Workspace 选择/创建入口，不能是营销页或粗糙占位页。
- Workspace 创建必须闭环：点击新建 -> 输入 -> 创建 -> 列表出现 -> 进入 Workspace -> 创建/进入 Session。
- 消息发送必须闭环：输入消息 -> 发送 -> 消息落库 -> 消息流显示状态。
- Desktop 登录/绑定后必须给出明确身份和连接状态；打开 Web 工作台必须指向有效 Workspace/Session 或给出中文下一步。
- Mobile/PWA 必须展示轻量主路径，不得只显示静态卡片。
- 所有空状态、加载态、失败态、未登录态、Desktop 离线态、Runtime 未安装/未登录态必须可见且文案明确。
- 三端使用统一视觉母版、中文文案、共享状态语义；只允许布局密度和导航方式差异化。

---

## 7. 参考项目输入

| 参考项目 | 读取范围 | 提炼内容 | 不采用内容 |
| --- | --- | --- | --- |
| `refer_proj/cherry-studio` | Desktop 主壳、设置密度、会话/Provider 管理结构 | 桌面端信息密度、设置分组、本地状态呈现 | 不复制 Provider API Key 表单到本地 Runtime 绑定 |
| `refer_proj/lobehub` | 移动会话布局、设置分组、消息/工具状态 | Mobile/PWA 轻量会话和状态组织 | 不引入重型模型供应商配置流程 |
| `refer_proj/*AionUi*` 或已登记 AionUi 分析 | 聊天工作台、Local Agents、Agent 卡片 | 高密度聊天、预览分栏、Local Agents 检测与卡片 | 不直接采用 Arco 默认视觉皮肤 |
| codeg/shadcn 参考 | 侧栏、会话壳、输入工具条、权限弹窗 | 三端统一视觉母版、shadcn 风格组件 | 不把产品变成 IDE 复制品 |

参考项目必须先产出 UX/结构规则，不得只复制视觉或提交参考项目文件。

---

## 8. Trellis 派生要求

- `.trellis/tasks/<task>/prd.md`：必须引用本合同，并声明验真样本不等于直接修复目标。
- `implement.jsonl`：必须包含本合同、`research/ai-workflow-control.md`、`research/prd.md`、`research/technical-design.md`、`research/ui-design-system.md`。
- `check.jsonl`：必须包含本合同、`research/prompts/maestro-execution-governance.md`、`.workflow/specs/test-conventions.md`、相关 `.trellis/spec/*`。
- 需要更新的 `.trellis/spec/*`：若审计发现 E2E 或实现规范可复用，应更新 frontend/backend/cross-layer spec。

---

## 9. Maestro/Ralph 派生要求

- 推荐命令：先 analyze/verify，不直接 execute。
- analyze 要求：从合同出发自行识别主链路断点、测试缺口、DB/API/权限假通、三端 UX 不一致。
- plan 要求：只在发现合同缺口后拆修复 wave；不得把用户已知样本根因作为 prompt 输入。
- plan anti-pattern review：执行前必须按 `.trellis/spec/guides/end-to-end-contract-planning.md` 自查；若出现 `playwright --list`、文件存在、grep-only、placeholder runtime、mock API/DB/auth、或外部浏览器 OAuth cookie 假设，必须 revise。
- execute 要求：修复必须围绕真实 DB/API/session 和完整用户链路。
- verify/review 要求：必须按本合同逐项核对，而不是只看 `status.json completed` 或 `toBeVisible`。
- execution report 路径：`research/execution-reports/p0-end-to-end-product-flow-*.md`。

---

## 10. 测试与验收合同

自动化测试必须覆盖：

- type-check：`pnpm --filter @agenthub/web type-check`, `pnpm --filter @agenthub/desktop type-check`。
- API/integration：真实 DB 下的 Workspace、Session、Message CRUD 与鉴权。
- Web E2E：登录态、Workspace 创建、Session 创建、消息发送、三栏工作台、错误态。
- Desktop E2E：启动主壳、登录/绑定入口、身份/设备状态、打开 Web 工作台、Runtime 检测、本地 Runtime 凭证边界。
- Mobile/PWA E2E：Workspace/Session 列表、轻量消息、审批、预览、未登录/错误态。
- 视觉/布局断言：无横向滚动、关键容器不重叠、文本不溢出、三端同状态截图。
- 数据库验证：创建后的 User/Account/Workspace/Session/Message 可查询，刷新后状态仍存在。

人工验收路径：

1. 从根目录按正式启动方式启动 Web + Desktop。
2. 从 Desktop 或 Web 发起登录。
3. 登录完成后进入 Web 主工作台。
4. 创建 Workspace，进入 Workspace。
5. 创建或进入 Session，发送一条消息。
6. 打开 Desktop，确认同一账号/设备/Runtime/Workspace 状态可理解。
7. 打开 Mobile/PWA，确认同一 Workspace/Session 可查看。
8. 刷新 Web 或重启 Desktop 后，状态保持一致。

---

## 11. 计划阶段禁止项

任何修复计划出现以下情况必须先修订，不得 execute：

- TASK DoD 只要求文件存在、grep 字符串、类型检查或 `playwright test --list`。
- 使用 `page.route`、`vi.mock`、mock auth 或内存数据作为真实 DB/API/session 主链路通过证据。
- `/api/chat` 或 Runtime 任务返回 placeholder/hardcoded assistant 文本并宣称 Agent 链路成功。
- Desktop 登录方案假设 Electron renderer 可以读取外部浏览器 OAuth cookie，而没有一次性 device binding token/code、deep link token 或 main-process session bridge。
- local_desktop runtime 不可用时仍返回成功聊天内容，而不是 `DEVICE_OFFLINE` 或等价错误。
- 把 `status.json completed`、`DONE_WITH_CONCERNS`、`verification.passed=false` 的阶段当作产品完成。

计划必须在报告中写明已通过 `.trellis/spec/guides/end-to-end-contract-planning.md` 的 anti-pattern review。

---

## 12. 验真样本

| 样本 | 只给执行者的合同描述 | 不应预置的答案 | 通过标准 |
| --- | --- | --- | --- |
| 身份连续性样本 | Desktop 发起登录后，用户应能明确进入已登录工作状态，Desktop/Web/Mobile 对同一账号、Workspace 和 Session 的状态一致。 | 不预置具体端口、cookie、callback 或 renderer 状态断点。 | 执行系统通过合同/E2E/代码审计自行发现身份连续性或登录后落点问题，并给出证据、影响面和修复计划。 |
| Workspace 创建闭环样本 | 用户应能在真实数据库下创建 Workspace，并继续进入 Session/Message 主路径。 | 不预置当前 API 是否 mock、是否未授权或是否缺 DB。 | 执行系统自行发现 Workspace/Session/Message 主链路是否真实落库且可刷新恢复。 |
| 三端 UX 一致性样本 | Web/Desktop/Mobile 必须服务同一产品模型，端侧职责不同但状态、文案、视觉母版一致。 | 不预置具体哪个页面丑或哪个组件不一致。 | 执行系统自行产出三端差距报告和可执行验收项。 |

验真样本不是直接修复目标。若执行系统不能自行发现样本问题，先修测试合同和工作流门禁。

---

## 13. 完成门禁

完成前必须满足：

- [ ] `research/project-tracker.md` 已更新。
- [ ] `research/execution-reports/*.md` 已补齐。
- [ ] 真实验证命令和结果已写入报告。
- [ ] 精确 commit，禁止 `git add .`。
- [ ] 最近 commit 不包含 `refer_proj/*`、缓存、临时日志、`.workflow/.maestro/*/status.json`。
- [ ] `bash scripts/verify-governance-gate.sh P0-END-TO-END-PRODUCT-FLOW` exit 0。
- [ ] Codex 按本合同完成独立验收。
- [ ] 验真样本已被执行系统自行发现，或已记录为流程门禁缺陷并补强合同/测试。
- [ ] 修复计划和 execution report 已通过 plan anti-pattern review。

---

## 14. 残留风险与后续

- 当前合同先用于流程验真和盲验证准备，不代表登录、Workspace 或 UI 已修复。
- 若盲验证不能自行发现验真样本，下一步应补强合同、E2E 和治理门禁，而不是直接修单点 bug。
