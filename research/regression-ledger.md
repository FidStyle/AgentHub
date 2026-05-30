# 回归、缺陷与未完成项台账

> 文档注释：本文件不是执行报告，也不是临时 TODO。它是 AgentHub 已完成功能面暴露出的 bug、未完成项、不完善项和质量债的长期台账。每一条必须挂钩到 PRD/FR、已完成任务或合同、受影响功能面、验证方式和关闭条件。新功能推进前必须先检查本文件是否存在阻塞级未关闭项。

## 使用规则

1. 已声明完成的功能，如果用户或审计发现真实链路不可用、点击无效、数据未闭环、状态不一致、测试未覆盖，应先登记到本文件。
2. 每条记录必须至少包含：ID、类型、优先级、状态、关联 FR/PRD、关联任务/合同、影响面、发现方式、证据、关闭条件、下一步。
3. `P0 regression` 和 `P0 blocker` 默认阻塞继续扩大同一功能面；除非用户明确接受风险，否则应先修复。
4. 修复完成后，不能只改状态；必须补测试证据、execution report、tracker 记录和中文 commit。
5. Maestro/Ralph/Codex 完成功能后，应检查本文件并补登新发现问题；不得只写在聊天或 `.workflow/.maestro/*/status.json`。

## 状态定义

| 状态 | 含义 |
| --- | --- |
| `open` | 已确认存在，尚未进入修复 |
| `in_progress` | 已进入修复/验证 session |
| `blocked` | 需要外部条件或用户决策 |
| `fixed_pending_verify` | 已修复，等待真实链路验证 |
| `closed` | 修复、验证、报告、tracker、commit 全部完成 |

## 当前未关闭项

> REG-20260530-001（Web Workspace 真实交互闭环缺口）与 ROLE-CHAT-CORE-001 可见 agent 回复 deferred 项（重定级 REG-20260530-003）已在 `RUNTIME_E2E=1` + worker(FakeExecutor) 下复验并移入「关闭记录」。
>
> ⚠️ **更正（2026-05-30，PRODUCT-UAT-GAP-AUDIT-001）**：REG-20260530-003 的「关闭」仅在 `RUNTIME_E2E=1` + FakeExecutor 下成立；真实用户默认入口（`pnpm dev:web`/`dev:full`，无 worker）下 @架构师/Agent 对话仍 0 可见回复。该过早关闭的产品缺口由新登记的 **REG-20260530-006** 接管，REG-20260530-003 的「closed」仅代表「测试态 FakeExecutor 回环已建立」，不代表产品目标达成。当前未关闭项：P1 test-infra REG-20260530-002 + 本次审计新增 REG-20260530-006(P0，**Web GAP-001 已由 `ROLE-CHAT-RUNTIME-DELIVER-001`/commit `eed577f` 关闭；仅余 Mobile GAP-002 转 `MOBILE-CHAT-DELIVER-001` P0**)/007(P1)/008(P1)。

### REG-20260531-002 — workspace selector 下拉越界且无内部滚动（FLOATING-UI-UAT-AUDIT-001 GAP-001）

| 字段 | 内容 |
| --- | --- |
| **类型** | bug / UI 浮层定位 |
| **优先级** | high（核心导航入口，3 视口复现） |
| **状态** | `closed`（2026-05-31，FLOATING-UI-FIX-D1-001 修复并真实浏览器验证通过） |
| **关联 FR/PRD** | `FR-WEB-001`, `FR-UI-001`；`research/product/ui-design-system.md`（浮层定位） |
| **关联任务/合同** | `FLOATING-UI-UAT-AUDIT-001`（发现）→ `FLOATING-UI-FIX-D1-001`（修复闭环）；母版 `UI-TOOLTIP-POSITION-001`（packages/ui Tooltip portal+flip+max-width 正向对照） |
| **影响功能面** | `apps/web/components/workspace/Sidebar.tsx` 工作区切换下拉（裸 `absolute left-2 right-2 top-full`，无 portal/flip/max-height，`z-10`） |
| **发现方式** | FLOATING-UI-UAT-AUDIT-001 真实浏览器（Chromium）+ 真实 DB(`agenthub_p0_test`) + 真实 Auth.js session 几何审计（`e2e/tests/web/floating-ui-uat-audit.spec.ts`，非 `toBeVisible`） |
| **证据** | `research/execution-reports/floating-ui-uat-audit-001-findings.json` D1×3 视口：floating 263×4358/4394/4430，bottom 4418/4454/4490 远超 vh(900/800/900)，无内部滚动；截图 `e2e/artifacts/floating-ui-uat-audit/{1440x900,1280x800,768x900}-D1-workspace-dropdown.png` |
| **关闭条件** | FIX-D1：workspace 下拉 portal-to-body + flip/shift（参考 Tooltip `computePosition`）+ `max-h` 内部 `overflow-y-auto` 滚动 + z-index 提升至 popover 层；3 视口 floating bbox 完整落在视口内、超长列表内部滚动而非撑高页面、不引发横滚（几何断言，非 `toBeVisible`） |
| **关闭证据** | FLOATING-UI-FIX-D1-001（2026-05-31）：`Sidebar.tsx` 抽出 `WorkspaceDropdown` portal-to-body + `computeDropdown` flip/clamp + `maxHeight`(≤60%vh)+`overflow-y-auto` + `z-50` + pointerdown 外部关闭。真实浏览器三视口 **3 passed**，D1 floating 高 540/480/540（修复前 ~4400）、bottom 588/528/588 全在视口内、symptoms 空、severity=ok。findings.json `ok×13/medium×1`（剩 medium=O1/REG-003，范围外）。报告 `research/execution-reports/floating-ui-fix-d1-001-report.md` |
| **下一步** | 已关闭。预防项 FIX-D2（role picker，REG 暂未登记）/ FIX-O1（REG-20260531-003）按需另起 |

### REG-20260531-003 — 移动 artifact 抽屉无 backdrop / 无点击外部关闭（FLOATING-UI-UAT-AUDIT-001 GAP-002）

| 字段 | 内容 |
| --- | --- |
| **类型** | bug / 交互一致性 |
| **优先级** | medium |
| **状态** | `open` |
| **关联 FR/PRD** | `FR-WEB-001`, `FR-UI-001`；`research/product/ui-design-system.md`（抽屉/overlay 一致性） |
| **关联任务/合同** | `FLOATING-UI-UAT-AUDIT-001` |
| **影响功能面** | `apps/web/components/workspace/WorkspaceShell.tsx` artifact 移动抽屉（`fixed inset-y-0 right-0`，`z-30`，与 sidebar 抽屉同 z 且无 backdrop） |
| **发现方式** | FLOATING-UI-UAT-AUDIT-001 真实浏览器 + 真实 DB/auth 几何审计（768×900 视口） |
| **证据** | `research/execution-reports/floating-ui-uat-audit-001-findings.json` O1@768：fixed 320×900 无 backdrop（对照 sidebar 抽屉有 `sidebar-backdrop`），无点击外部关闭；截图 `e2e/artifacts/floating-ui-uat-audit/768x900-O1-artifact-overlay.png` |
| **关闭条件** | FIX-O1：artifact 移动抽屉补 `artifact-backdrop`（`fixed inset-0 z-20 lg:hidden`）+ 点击外部关闭 + 与 sidebar 抽屉 z 分层；移动态几何断言通过（存在覆盖全视口 backdrop、点击关闭、与 sidebar 不同 z） |
| **下一步** | `FIX-O1`（execute；本审计任务只读不修复） |

### REG-20260530-006 — Web/Mobile Agent 回复在真实用户态不可达（审计建议 003，与已关闭 003 区分）

| 字段 | 内容 |
| --- | --- |
| **类型** | bug / unfinished / P0 regression |
| **优先级** | P0 blocker（阻塞继续扩大对话功能面） |
| **状态** | `partially_closed`（Web GAP-001 已由 `ROLE-CHAT-RUNTIME-DELIVER-001` 关闭，commit `eed577f`；Mobile GAP-002 仍 `open`，转 `MOBILE-CHAT-DELIVER-001` P0 后续） |
| **关联 FR/PRD** | `FR-CHAT-001`, `FR-WEB-001`, `FR-MOB-001`, `FR-RUNTIME-001`, `FR-UI-001`；`research/prd.md` 多 Agent 协作主链路 |
| **关联任务/合同** | `P0-END-TO-END-PRODUCT-FLOW`；`ROLE-CHAT-CORE-001`；`ROLE-CHAT-UAT-REPLY-001`（其 REG-20260530-003「关闭」仅测试态成立）；`research/contracts/P0-END-TO-END-PRODUCT-FLOW.md` §3.1.8/§6 |
| **影响功能面** | Web `/api/chat` runtime 链路；Mobile `/m/sessions/:id` 发送；公共云端 Runtime worker 部署；唯一可见回复断言 |
| **发现方式** | PRODUCT-UAT-GAP-AUDIT-001 真实浏览器 + 真实 DB(`agenthub_p0_test`) + 真实 Auth.js session 审计（非只看代码/测试） |
| **证据** | `research/execution-reports/product-uat-gap-audit-001-browser-findings.json`（两 regime `saw_real_agent_reply:false`）；regime2 `POST /api/chat 200 in 8469ms`（idle 超时空等）；P0 DB `runtime_endpoints=0`/`runtime_sessions=0`/`messages` user41:agent13；`apps/web/lib/runtime/gateway.ts:117` 仅以 `REDIS_URL` gating，`resolveEndpoint` 的 `unconfigured` 状态(line52)从不 gating；`apps/web/server/runtime-worker.ts:11` 默认 `FakeExecutor`；`apps/web/app/m/sessions/[sessionId]/page.tsx` 发送走 `/api/messages` 不走 `/api/chat`；`e2e/tests/web/role-chat-uat-reply.spec.ts:26` `test.skip(!RUNTIME_E2E)` |
| **为什么此前漏掉** | 唯一断言「可见 agent 回复」的 E2E 默认 `skip`，执行时也只验 FakeExecutor 回显；verify/review/goal-audit 以 HTTP 200 / 落库 / `toBeVisible` 收口，未对照合同「用户目标达成」 |
| **关闭条件** | 默认运行入口（无 `RUNTIME_E2E`）下：有真实 worker(非 FakeExecutor) → 用户看到非空带角色回复并落 `messages`；无 worker/endpoint `unconfigured` → gateway **立即**短路明确中文错误态（不空等 60s）；Mobile 发送走同一 runtime 链路或明确闭环文案；可见回复断言改为不可默认跳过的常驻门禁 |
| **Web GAP-001 关闭证据** | `ROLE-CHAT-RUNTIME-DELIVER-001`（commit `eed577f`）：gateway public_cloud 分支改用 `resolveEndpoint` status/id + 活跃 worker 在线键门控（不再仅凭 `REDIS_URL`）；无 worker/unconfigured 立即短路明确中文错误态（实测 <2s，消除 60s idle 空等）；非回显 `ScriptedRealExecutor` 真实交付验证；两条默认不可跳过 E2E（无 worker→立即错误态 / 真实 worker→可见回复+reload）。verify passed=true（6 truths VERIFIED）、review PASS、UAT 2/2、milestone-audit PASS（0 gaps）。归档 `.workflow/milestones/adhoc-role-chat-runtime-deliver/` |
| **下一步** | Web GAP-001 ✅ 已关闭（`ROLE-CHAT-RUNTIME-DELIVER-001`）；Mobile GAP-002 仍 open，由 `MOBILE-CHAT-DELIVER-001`(P0) 跟进；详见 `research/project-tracker.md` |

### REG-20260530-007 — Artifact 面板恒静态空态、从不接真实数据（审计建议 004）

| 字段 | 内容 |
| --- | --- |
| **类型** | unfinished / UX |
| **优先级** | P1 |
| **状态** | `open` |
| **关联 FR/PRD** | `FR-WEB-001`, `FR-UI-001`；`P0-END-TO-END-PRODUCT-FLOW.md` §3.1.10（三栏含 Artifact/Context/Agents） |
| **关联任务/合同** | `PRODUCT-UAT-GAP-AUDIT-001`；`P0-END-TO-END-PRODUCT-FLOW` |
| **影响功能面** | Web workspace 右栏「产物 / 上下文 / Agents」三 Tab |
| **发现方式** | PRODUCT-UAT-GAP-AUDIT-001 真实浏览器 + 代码核对 |
| **证据** | `apps/web/components/workspace/ArtifactPanel.tsx` 三 Tab 全硬编码 `StateCard variant="empty"`、无任何 fetch；同 workspace `/api/role-agents` 返回非空（含「架构师」），但「Agents」Tab 恒显「暂无 Agent」 |
| **关闭条件** | Agents Tab 呈现真实 `role_agents`；产物/上下文接对应数据源或显式标注 P1 未实现范围；补面板数据一致性断言（非仅 `toBeVisible`） |
| **下一步** | `ARTIFACT-PANEL-DATA-001`(P1) |

### REG-20260530-008 — 默认 `apps/web/.env.local` 指向 Supabase 占位符、真实用户跑不通主链路（审计建议 005）

| 字段 | 内容 |
| --- | --- |
| **类型** | env / dev-setup |
| **优先级** | P1 |
| **状态** | `open` |
| **关联 FR/PRD** | `FR-WEB-001`；`P0-END-TO-END-PRODUCT-FLOW.md` §5（migration/seed/dev setup 可执行） |
| **关联任务/合同** | `PRODUCT-UAT-GAP-AUDIT-001` |
| **影响功能面** | 默认开发入口 `pnpm dev:web` 的 DB/Runtime 连接；新环境可复现性与可演示性 |
| **发现方式** | PRODUCT-UAT-GAP-AUDIT-001（须切换 P0 harness env 才能跑通登录与主链路） |
| **证据** | `apps/web/.env.local` 实际值为 `NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co` 占位符，无可用 DB/`REDIS_URL`；审计须改用 `docker/.p0-test.env`（真实 `agenthub_p0_test` Postgres + 真实 auth cookie）才能跑通 |
| **关闭条件** | 提供可复现的本地真实 DB/Redis env（或 `dev:full` 自动指向 p0/dev DB）；补「默认入口启动 → 登录 → 主链路可用」冒烟 |
| **下一步** | `DEV-ENV-BOOTSTRAP-001`(P1) |


### REG-20260530-002 — Web E2E 共享单用户并行 worker 数据污染（既有套件脆弱性）

| 字段 | 内容 |
| --- | --- |
| **类型** | test-infra fragility |
| **优先级** | P1 |
| **状态** | open |
| **影响功能面** | `e2e/tests/web/*`（尤其 `role-chat-core.spec.ts:35`、`p0-workspace-flow.spec.ts`）依赖在共享单一 P0 测试用户的 workspace 列表中查找“刚创建”项 |
| **发现方式** | WEB-WORKSPACE-UX-001 verify 阶段并行运行 web-desktop+web-tablet 时暴露 |
| **证据** | `fullyParallel:true` + 本地多 worker 下，多 spec 在同一用户累积 36+ workspace；`role-chat-core.spec.ts` line 35 `getByRole('button',{name:wsName}).click()` 在列表中找不到刚建 workspace。移除 WEB-WORKSPACE-UX 新 spec 后 ROLE-CHAT 仍 2/2 失败 → 与本次改动无关 |
| **为什么不在 UX-001 内修** | 属测试隔离/夹具设计问题，跨多个既有 spec，超出 WEB-WORKSPACE-UX-001（deep-link/拉消息行为）边界；CI 用 `workers:1` 可规避，本地多 worker 才触发 |
| **关闭条件** | 为共享 DB 状态的 web spec 提供按 spec 隔离的夹具（独立用户或 per-test 清理/重新 seed），或将 workspace-mutating web spec 配置为同 worker 串行；确保本地多 worker 与 CI 均稳定 |
| **下一步** | 单列 test-infra 任务处理；不阻塞 WEB-WORKSPACE-UX-001 关闭 |


## 关闭记录

### REG-20260531-001 — 全局 Tooltip 边缘/overflow 容器/移动端错位裁切变形（由 UI-TOOLTIP-POSITION-001 修复关闭）

| 字段 | 内容 |
| --- | --- |
| **类型** | UI layout / a11y regression |
| **优先级** | P1 |
| **状态** | `closed` |
| **关联 FR/PRD** | `FR-UI-001` |
| **关联任务/合同** | `UI-TOOLTIP-POSITION-001`（`research/project-tracker.md` 同名条目 + `research/execution-reports/ui-tooltip-position-001-report.md`）；Ralph session `ralph-20260531-000642` |
| **影响功能面** | workspace 全部 IconButton（新建会话 / @角色 / 发送 / 打开侧栏 / 切换面板）的 Tooltip 在桌面 1440/1280 + 移动 768 的定位/换行/裁切 |
| **发现方式** | packages/ui Tooltip 代码核对 + 真实浏览器 E2E（旧 `absolute bottom-full left-1/2 -translate-x-1/2 + whitespace-nowrap` 被 overflow 容器裁切、边缘越界、长文案横向拉伸变形） |
| **证据** | 修复前：`tooltip.tsx` 绝对定位 + `whitespace-nowrap` → 被祖先 overflow 裁切 + viewport 边缘越界 + 变形/可能横滚。修复后：`createPortal` 到 body + `computePosition`（fits/flip/clamp）+ `max-w-[16rem] break-words`；`e2e/tests/web/ui-tooltip-position.spec.ts` 真实浏览器 6/6 passed（1440/1280/768 × web-desktop+web-tablet），boundingBox 在 viewport 内 + 无横滚 + 未遮挡断言；verification.json passed=true gaps=[]、review.json PASS（0 critical/blocking）、test-results.json 6/6 |
| **关闭条件（已满足）** | Tooltip portal 不被 overflow 裁切、自动 flip/shift 不越界、max-width 换行不变形、不遮挡触发按钮、无横向滚动；hover+focus 双触发保留 role=tooltip/aria-describedby；shared UI 层统一修复无逐按钮补丁；E2E boundingBox 几何断言（非仅 `toBeVisible`） |
| **关闭时间** | 2026-05-31 |
| **结转 concern（不阻塞）** | 768 `toggle-artifact-btn` 被 artifact 空态面板层叠覆盖（响应式三栏布局问题，超出 tooltip 范围，右边缘断言条件跳过，左边缘 open-sidebar 已覆盖 flip/shift）；apps/web full build 受 pre-existing dual @types/react 冲突（E2E dev 模式未受阻） |

### REG-20260530-009 — Web workspace 三栏布局移动失稳 + 按钮位置/交互几何断言缺失（由 WEB-WORKSPACE-LAYOUT-UAT-001 修复关闭）

| 字段 | 内容 |
| --- | --- |
| **类型** | UI layout / UX regression + test-gap |
| **优先级** | P0（RC1 三栏移动失稳）+ P1（RC2-RC6 按钮几何/行为断言缺失） |
| **状态** | `closed` |
| **关联 FR/PRD** | `FR-WEB-001`, `FR-UI-001`；`P0-END-TO-END-PRODUCT-FLOW.md`（Web workspace 三栏可用性） |
| **关联任务/合同** | 由 `WEB-WORKSPACE-LAYOUT-UAT-001` 修复关闭（`research/project-tracker.md` 同名条目 + `research/execution-reports/web-workspace-layout-uat-001-report.md`） |
| **影响功能面** | Web `/workspace/:id` 三栏布局（桌面 1440×900/1280×800 + 移动 768）、新建会话/workspace 切换/@角色/发送/Artifact 面板入口位置与点击行为 |
| **发现方式** | WEB-WORKSPACE-LAYOUT-UAT-001 analyze 阶段真实浏览器 + 代码核对（ANL-web-workspace-layout-uat-2026-05-30，RC1-RC6） |
| **证据** | 修复前：`WorkspaceShell.tsx:14` 固定 `grid-cols-[280px_1fr_320px]` 无断点 → 移动横向溢出 + 三栏挤压不可用；按钮位置正确但无 boundingBox 几何 + 点击真实结果联合断言。修复后：响应式 `lg:grid-cols-[280px_minmax(480px,1fr)_320px]` + `overflow-x-hidden` + 移动抽屉/overlay；`e2e/tests/web/web-workspace-layout-uat.spec.ts` 3 视口真实浏览器 3 passed (6.5s)，boundingBox 几何 + 点击行为断言；verification.json PASS、review.json PASS（0 high）、uat.md 3/3 |
| **关闭条件（已满足）** | 三栏桌面 + 移动稳定（无横滚 + 中栏 ≥480 + 三栏不重叠）；6 类按钮 boundingBox 几何 + onClick 真实结果断言（非仅 `toBeVisible`、非 baseline 截图对比）；错误布局测试必失败 |
| **关闭时间** | 2026-05-30 |

### REG-20260530-003 — ROLE-CHAT-CORE-001 可见 agent 回复 + 角色 Badge deferred（重定级 P0 后关闭）

| 字段 | 内容 |
| --- | --- |
| **类型** | unfinished / UX gap |
| **优先级** | P0 blocker（自 ROLE-CHAT-CORE-001 deferred 项重定级——用户 @角色发送后无可见回复属主链路阻塞，非可选增强） |
| **状态** | `closed` |
| **关联 FR/PRD** | `FR-CHAT-001`, `FR-WEB-001`, `FR-RUNTIME-001`, `FR-UI-001` |
| **关联任务/合同** | 发现于 `ROLE-CHAT-CORE-001`（`research/project-tracker.md` 同名条目 + `research/execution-reports/role-chat-core-report.md#6`）；由 `ROLE-CHAT-UAT-REPLY-001` 修复关闭 |
| **影响功能面** | Web `/api/chat` 角色对话：@架构师发送后可见 agent 回复 + 角色上下文标识 + reload 持久化 |
| **发现方式** | 用户验真样本（2026-05-30，localhost:3000 @架构师发送后只见用户消息）+ ROLE-CHAT-CORE-001 报告 §6 显式登记的 deferred 切片 |
| **为什么重定级** | 原 deferred 理由是「P0 harness 无 Redis/worker」，但可见 agent 回复是角色对话主链路的核心交付，不是可选增强；归类为 P0 blocker 而非延后增强 |
| **证据** | `cd e2e && RUNTIME_E2E=1 npx playwright test --project=web-desktop web/role-chat-uat-reply.spec.ts web/web-workspace-ux.spec.ts web/role-chat-core.spec.ts` → 3 passed（真实 DB+Redis+worker，无 mock，DB 校验 messages 同含 user+agent 行）；verification.json PASS（5/5）；review.json PASS（0 critical/0 high）；`research/execution-reports/role-chat-uat-reply-001-report.md` |
| **关闭条件（已满足）** | `/api/chat` 在 `runtime_completed && reply` 非空时落 `sender_type=agent`（no-fake-success）；E2E 拉起 Redis+worker 断言可见回复文本 + role badge + reload 双向持久化；单测 AT-005/AT-006 覆盖正反两路 |
| **关闭时间** | 2026-05-30 |

### REG-20260530-001 — Web Workspace 真实交互闭环缺口（已关闭）

由 `WEB-WORKSPACE-UX-001`（URL workspace 选中 / Sidebar 不覆盖 / setActiveSession 拉消息 + deep-link E2E）与 `ROLE-CHAT-CORE-001`（`sendMessage→/api/chat`、新建会话 onClick）联合修复，并由 `ROLE-CHAT-UAT-REPLY-001` 在真实 DB+Redis+worker E2E 下端到端复验通过（`web-workspace-ux.spec.ts` 含 `GET /workspace/:id` → `/api/sessions` → `/api/messages` → `POST /api/chat 200` + 视觉 + reload 断言）。关闭时间：2026-05-30。
