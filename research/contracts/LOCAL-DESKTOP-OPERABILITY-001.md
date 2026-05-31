# LOCAL-DESKTOP-OPERABILITY-001: 本地 Desktop 工作区可操作性与 Runtime 真实性合同

> 本合同是 Trellis 与 Maestro/Ralph 的共享事实接口。实现、测试、验收和执行报告都必须引用本文件。

---

## 1. 元信息

| 字段 | 内容 |
| --- | --- |
| TASK-ID | `LOCAL-DESKTOP-OPERABILITY-001` |
| 优先级 | `P0` |
| 绑定 FR-ID | `FR-AUTH-001`, `FR-WS-001`, `FR-DEVICE-001`, `FR-DESK-001`, `FR-RUNTIME-001`, `FR-WEB-001`, `FR-ORCH-001` |
| 来源 | `bytedance_init_prd.md`, `research/prd.md`, `research/product/product-design.md`, `research/modules/desktop-connector.md`, `research/modules/runtime-adapters.md` |
| 负责人角色 | Codex 控制流程；Trellis 管实现规范；Maestro/Ralph 管大范围执行 |
| 状态 | active |

---

## 2. 背景与目标

Local Desktop Workspace 的本地执行能力必须真实依赖用户电脑上的 AgentHub Desktop、Claude Code 和 Codex CLI。Web 服务运行在远端服务器，不能只靠网页直接连接用户本机 CLI。当前实现存在 `/api/plans` 查询失败、Web 工作区状态不充分、Desktop Runtime 状态 hardcode、用户文案把登录与“设备通道”混淆、以及只读/可操作模式缺失的问题。

目标是建立可执行的本地工作区可操作性模型：离线时允许只读查看历史；可操作时必须满足同一账号、Desktop 云端连通、CLI doctor 通过、native session 可恢复或可新建。

---

## 3. 用户链路合同

### 3.1 Web 查看历史

1. 用户登录 Web。
2. 用户进入“我的工作区”。
3. 对 Local Desktop Workspace，即使 Desktop 离线，也可以点击“查看历史”。
4. Web 展示 AgentHub DB 中的历史消息、计划、产物和失败状态。
5. 输入框、发送、Action、恢复 session 等执行入口禁用，并显示中文阻塞原因。

### 3.2 Web 连接并继续

1. 用户打开 Desktop，并绑定同一账号。
2. Desktop 建立云端实时连接。
3. Desktop doctor 检测 Claude Code / Codex 已安装、可启动、已认证。
4. Web 的 Local Desktop Workspace 显示“连接并继续”可用。
5. 用户进入可操作模式后，才允许发送消息、恢复 runtime session 或触发本地 Action。

### 3.3 Desktop Runtime 真实性

1. Desktop 启动后显示账号状态、云端连接状态、本地 Runtime 状态。
2. Codex / Claude Code 卡片不得默认 hardcode 为已接入。
3. 只有 doctor 通过的 Runtime 才能进入本地轻量会话。
4. doctor 失败时展示未安装、未登录、检测失败或不可启动原因，并提供重新检测。

### 3.4 Orchestrator 计划

1. 用户进入含 active session 的工作区。
2. 编排面板加载 `/api/plans`。
3. `/api/plans` 必须在本地 Postgres 适配器下正常返回 plan 和 plan_nodes。
4. 不得使用 Supabase-only 嵌套 select 语法导致 500。

---

## 4. 三端职责边界

| 端 | 职责 | 不做什么 |
| --- | --- | --- |
| Web | 主工作台、工作区列表、只读/可操作入口、历史消息、计划/Action 展示、发送前可操作性门禁 | 不直接连接用户本机 CLI；不在 Desktop 离线时假装可执行本地任务 |
| Desktop | 同一账号绑定、云端连接、CLI doctor、本地 Runtime/Action 执行、native session 恢复/创建、状态回传 | 不复制完整 Web 三栏工作台；不 hardcode Runtime 已接入；不保存 Claude/Codex API Key |
| Mobile/PWA | 可复用只读/可操作状态查看、轻量消息、审批和预览 | 不接入本地 Runtime，不直接访问用户本机 |

---

## 5. 数据与后端合同

- 数据库要求：
  - `workspaces.execution_domain` 区分 `cloud` 与 `local_desktop`。
  - `devices` 和 `device_runtime_channels` 表示 Desktop 是否可被云端触达。
  - `runtime_sessions.native_session_id` 表示可恢复的本地 CLI session identity；本轮可先返回不可恢复阻塞，不伪造成功。
- API 要求：
  - `/api/runtime/status` 返回 `readOnlyAvailable`, `operable`, `blockReason`, `desktop`, `runtime`。
  - `/api/plans` 不使用 Supabase-only 嵌套 select；应分两次查询并组装 `plan_nodes`。
  - `/api/chat` 对 Local Desktop Workspace 必须在执行前检查可操作性；不可操作时返回明确错误，不写入假成功 agent reply。
- 权限和错误语义：
  - 未登录返回 401。
  - Desktop 离线、Runtime 不可用、native session 不可恢复是业务阻塞，不是成功态。
  - 产品运行时是否允许 mock 主链路数据：**否**。

---

## 6. UI/UX 合同

- “我的工作区”列表：
  - Cloud Workspace：显示云端状态和“进入工作区”。
  - Local Desktop Workspace：显示执行域、只读/可操作状态、阻塞原因、最近在线时间；提供“查看历史”和“连接并继续”。
- 工作区内部：
  - 只读模式顶部显示阻塞原因。
  - 输入框和发送按钮禁用。
  - 提供“刷新连接状态”。
  - 可返回“我的工作区”。
- Desktop：
  - 用户文案使用“账号”“云端连接”“本地 Runtime”“Session 恢复”，不使用“设备通道”作为主文案。
  - Runtime 卡片必须来自 doctor 结果。
  - 诊断/重新检测为 P0 可用能力。
  - 继续/重试/停止仅在有真实 running/recoverable runtime session 时显示或启用。

---

## 7. 功能清单、做法与理由

| 功能 | 做法 | 理由 |
| --- | --- | --- |
| 修 `/api/plans` 500 | `plans` 和 `plan_nodes` 两次查询后按 `plan_id` 合并 | 当前本地 adapter 只支持简单列选择，`*, plan_nodes(*)` 会变成 `"*"` |
| Workspace 可操作性 API | 在 `/api/runtime/status` 中返回只读/可操作、阻塞原因、Desktop 和 Runtime 状态 | UI 需要明确区分历史可看与本地可执行 |
| Web 工作区入口 | 本地工作区提供“查看历史”和“连接并继续”；离线时只读可进入，可操作入口置灰 | 防止用户误以为网页能直接连接本机 CLI |
| Web 输入区门禁 | local_desktop 不可操作时禁用输入和发送，展示原因与刷新入口 | 离线状态不能发送消息后才失败，更不能假成功 |
| Desktop doctor | 真实执行本机轻量检测：命令存在、版本、认证/可启动探测，返回标准状态 | Desktop 的首要职责是证明本地 CLI 可连接 |
| Desktop Runtime 卡片 | 从 doctor 结果派生 Codex/Claude Code 可进入状态，移除 hardcoded connected | 不能默认给“进入”入口 |
| Desktop 文案 | “设备通道”改为“云端连接/实时连接性” | 登录和云端 relay 是两个状态，用户需要可理解 |
| 控制按钮治理 | 诊断/重新检测可用；继续/重试/停止仅在真实运行态启用 | 避免没有语义的 disabled 按钮常驻 |
| native session 恢复状态 | 建立 `native_session_unavailable` 阻塞原因；不伪造 resume 成功 | provider resume 需要后续按 Claude/Codex CLI 适配 |

---

## 8. Trellis 派生要求

- `.trellis/tasks/<task>/prd.md`：引用本合同，并记录用户已确认的只读/可操作口径。
- `implement.jsonl`：frontend、backend、cross-layer 规范和本合同。
- `check.jsonl`：frontend quality、runtime credential boundary、本合同。
- 需要更新的 `.trellis/spec/*`：如果实现中形成新的可执行接口或状态枚举，更新 cross-layer/runtime 或 frontend quality 规范。

---

## 9. 测试与验收合同

自动化测试必须覆盖：

- type-check：`pnpm --filter @agenthub/web type-check`、`pnpm --filter @agenthub/desktop type-check`。
- API/integration：`/api/plans` 在本地 Postgres adapter 下不因 nested select 失败；runtime status 返回可操作性字段。
- Web E2E/组件测试：本地工作区离线只读入口、禁用发送、刷新状态；云端工作区不受 Desktop 状态影响。
- Desktop 测试：Runtime doctor 不 hardcode connected；未安装/未登录不可进入；重新检测可更新状态。

人工验收路径：

1. Desktop 未打开时，Web 本地工作区只能“查看历史”，不能发送。
2. Desktop 打开但 CLI doctor 失败时，Web 仍不可操作，Desktop 显示修复原因。
3. Desktop 在线且 doctor 通过时，Web 显示“连接并继续”可用。
4. 编排面板不再出现 `/api/plans` `column "*" does not exist`。

---

## 10. 完成门禁

- [ ] 真实代码不再 hardcode Codex / Claude Code connected。
- [ ] `pnpm --filter @agenthub/web type-check` 通过。
- [ ] `pnpm --filter @agenthub/desktop type-check` 通过。
- [ ] 相关单测/E2E 至少覆盖状态模型关键路径。
- [ ] 精确 commit，禁止 `git add .`。

---

## 11. 残留风险与后续

- Claude Code / Codex 的完整 resume/continue 命令需要按实际 CLI 能力独立适配；本合同本轮禁止假实现。
- Desktop 系统级 deep link 启动能力不在本轮范围。
