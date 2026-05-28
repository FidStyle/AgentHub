# P0-END-TO-END-PRODUCT-FLOW 修复计划报告

> 日期：2026-05-28  
> 上游产物：`.workflow/scratch/20260528-analyze-p0-e2e-blind-verify/`  
> 合同：`research/contracts/P0-END-TO-END-PRODUCT-FLOW.md`  
> 计划路径：`.workflow/scratch/20260528-plan-p0-e2e-fix/plan.json`

---

## 1. 计划概要

基于 Ralph 盲验证发现的 5 个 critical blockers，生成 4-wave 修复计划，共 6 个 tasks。

| Wave | 目标 | Tasks | 消除 Blocker |
|------|------|-------|-------------|
| W1 | Web 前端接入真实 API | TASK-001 | BLK-1, BLK-5 |
| W2 | Desktop Device Login Intent + Mobile PWA 鉴权 | TASK-002, TASK-003 | BLK-2, BLK-4 |
| W3 | /api/chat 接入真实 Runtime 鉴权 | TASK-004 | BLK-3 |
| W4 | 真实 DB 集成测试 + E2E + Governance Gate | TASK-005, TASK-006 | 全部验证 |

---

## 2. Blocker → Task 映射

| Blocker | 问题 | 修复 Task | 修复方式 |
|---------|------|-----------|----------|
| BLK-1 | Web 消息不落库 | TASK-001 | session-store.sendMessage 改为 POST /api/messages |
| BLK-2 | Desktop 登录无身份回调 | TASK-002 | Device Login Intent：Desktop 创建 intent → Web 绑定 user → Desktop poll |
| BLK-3 | /api/chat 纯 mock 无鉴权 | TASK-004 | 重写 route.ts：requireAuth + session 归属 + 消息落库 + runtime_status 状态事件 |
| BLK-4 | Mobile PWA /m/* 无鉴权 | TASK-003 | middleware.ts matcher 新增 /m/:path* |
| BLK-5 | Web Session 列表 mock 数据 | TASK-001 | 删除 mock-data.ts，store 改为 fetch API |

---

## 3. 依赖关系

```
TASK-001 (W1) ─┬─→ TASK-004 (W3) ─→ TASK-005 (W4)
               │                    ─→ TASK-006 (W4)
TASK-002 (W2) ─┘
TASK-003 (W2) ─┘
```

- W1 和 W2 无互相依赖，但 W3 依赖 W1（/api/chat 需要 session-store 已接入真实 API）
- W4 依赖 W1-W3 全部完成

---

## 4. 验收合同覆盖

| 合同要求 | 计划覆盖 |
|----------|----------|
| 真实 DB 集成测试 | TASK-005：Workspace/Session/Message CRUD + 鉴权 |
| Web E2E 主链路 | TASK-006：登录→Workspace→Session→消息→持久化 |
| Desktop E2E | TASK-006：登录→login-intent→bind-status→身份展示 |
| Mobile E2E | TASK-006：鉴权重定向→登录后查看 Session |
| 视觉/布局断言 | TASK-006：scrollWidth ≤ clientWidth，容器不重叠 |
| Governance gate | TASK-006 + 每 wave 完成后运行 verify-governance-gate.sh |
| 产品运行时禁止 mock | TASK-001 删除 mock-data.ts + workspaces fallback |

---

## 5. 计划置信度

| 维度 | 分数 |
|------|------|
| 需求覆盖 | 95% |
| 任务质量 | 93% |
| 依赖正确性 | 88% |
| 估算准确性 | 78% |
| 碰撞安全 | 90% |
| **总体** | **91%** |

Pressure Pass（TASK-002）：PASS — device login intent 公开端点无 requireAuth 前置；落 DB 非内存 Map；behavioral_verification 包含 curl 验证。

---

## 6. Anti-Pattern 修正记录

### Rev 2 修正（2026-05-28）

| # | Anti-Pattern | 原方案问题 | 修正后方案 |
|---|-------------|-----------|-----------|
| 1 | TASK-002 requireAuth 前置 | bind-init 要求 requireAuth，但 Desktop 未登录无法调用 | 改为 device login intent：POST /api/devices/login-intent 为公开端点（无 requireAuth），Desktop 未登录即可创建 intent |
| 2 | TASK-002 内存 Map | 允许 "DB 或内存 Map" 存储 binding code | 禁止内存 Map，必须落 device_login_intents 表（真实 DB） |
| 3 | TASK-001 DoD 仅 grep | convergence 只有 grep/file-existence 检查 | 新增 behavioral_verification：创建 Session 后 GET 可读、POST message 后 GET 可读、reload 后仍在、无 DATABASE_URL 时 500 |
| 4 | TASK-004 伪 Agent 消息 | HostedRuntimeAdapter 输出 message:'Runtime Adapter 已连接（最小闭环）' | 禁止任何 message/text/content 字段；仅输出 {type:'runtime_status', status:'minimal_adapter', ready:true} |
| 5 | 全局 convergence 弱 | grep/file-existence 作为主要 DoD | 所有 TASK 新增 behavioral_verification 字段，每个 wave 必须有真实运行命令证明行为 |

### 关键设计决策

1. **Device Login Intent 流程**：Desktop（未登录）→ POST /api/devices/login-intent → 获取 code → 打开 Web 登录 URL（附 code）→ Web OAuth 完成后绑定 user_id 到 intent → Desktop poll bind-status 获取 user。全程 Desktop 无需预先持有 session。

2. **Runtime Adapter 输出约束**：SSE 流仅允许 `type:'runtime_status'` 和 `type:'done'` 两种事件类型。禁止 `type:'message'`、`type:'text'`、`content:` 等任何可能被前端渲染为 Agent 回复的字段。

3. **行为级验证优先级**：`behavioral_verification` > `criteria`（grep）。执行时必须先通过行为验证，grep 仅作为快速辅助检查。

---

## 7. 风险与注意事项

- Device Login Intent 需要 DB migration（新建 device_login_intents 表），执行前确认 migration 工具可用
- /api/chat Runtime adapter P0 最小闭环不包含完整 Agent 调用，只验证鉴权 + 消息落库 + 状态事件
- 集成测试需要 DATABASE_URL 指向测试 DB，CI 环境需配置
- Desktop E2E 需要 Electron + Playwright 环境，可能需要额外 setup

---

## 8. 下一步

1. 执行 W1 / TASK-001。
2. W1 完成后由 Codex 复核真实 DB/API/session 行为证据。
3. W1 通过后再进入 W2，不一次性 execute 全部 wave。
4. 每 wave 完成后更新 project-tracker + execution-report。
5. 全部完成后运行 `bash scripts/verify-governance-gate.sh P0-END-TO-END-PRODUCT-FLOW`。
6. 禁止以 status.json completed 代替产品验收。

---

## 9. Codex Rev 2 复核（2026-05-28）

结论：**已由 Codex 直接修订为 Rev 3，原 Rev 2 不再放行**。

Rev 2 已修正上一轮最严重的 5 个 anti-pattern：Desktop 登录不再假设外部浏览器 cookie 可被 Electron renderer 读取；Device Login Intent 改为公开端点并要求落 `device_login_intents` 表；TASK-001/TASK-004/TASK-005/TASK-006 都增加了行为级验收；`/api/chat` 不再允许输出伪 Agent 文本。

Codex 复核 Rev 2 时发现的剩余阻断如下；这些阻断已在 Rev 3 中直接修正：

1. **TASK-001 的 curl 验证缺少真实鉴权和 workspace setup。** `/api/sessions`、`/api/messages` 当前都要求 `requireAuth()` 且会校验 workspace/session 归属；验证命令直接 `POST /api/sessions {workspace_id:'test'}` 不足以证明真实链路。Rev 3 必须改成：先用明确 auth fixture/session cookie 或测试用户创建 workspace，再创建 session/message，并在 report 记录 cookie/user/workspace/session/message id。

2. **TASK-002 的 Auth.js 绑定落点需要实现级约束。** 当前计划写“auth.ts signIn callback 读取 URL query 并 redirect 到 `agenthub://...`”，但现有 `apps/web/auth.ts` 只有基础 `jwt/session` callbacks。Rev 3 必须明确使用 Auth.js v5 支持的回调/route 位置完成 `device_bind + code` 捕获，避免把不可访问的 request query 写进 `signIn` callback 后执行失败。

3. **TASK-006 的 E2E 登录 fixture 未定义。** `await 登录 fixture` 不能作为 P0 主链路证据。Rev 3 必须声明 E2E 登录策略：要么用真实 GitHub OAuth 手工/录制状态并记录限制；要么使用受控测试用户 + 真实 DB session/account seed，并明确该 fixture 只替代 OAuth 人机步骤，不替代 Workspace/Session/Message/Device 真实 API/DB 验证。

4. **TASK-006 Desktop E2E 只验证 `login-intent` 被调用还不够。** 必须断言 `bind-status` 从 `{bound:false}` 变为 `{bound:true,user}`，Electron renderer store/UI 显示同一 user id，并且打开 Web workspace 后不是 3000/5173 身份断裂状态。

5. **治理门禁和 dirty worktree 的关系需要写清。** `scripts/verify-governance-gate.sh` 要求 git 工作区干净。当前项目已有大量既有 dirty 文件，Rev 3 必须要求执行者记录 baseline、精确提交本 wave 相关文件，并说明 gate 在最终 wave 前必须处于干净工作区运行，不能用既有 dirty 状态跳过 gate。

Rev 3 修订动作：

- TASK-001：新增 `apps/web/scripts/verify-p0-api-crud.ts` 作为真实 API smoke 验证。验证必须带 `DATABASE_URL` + `TEST_AUTH_COOKIE` 或 `TEST_USER_ID`，先创建真实 Workspace，再创建 Session/Message，并重新 GET 验证持久化。
- TASK-002：新增 `/auth/device-bind?code=xxx` 受保护登录落点。禁止把 request query 读取逻辑塞进 Auth.js `signIn` callback；Desktop 最终身份只信任后端 `bind-status` 查询结果。
- TASK-006：新增 `e2e/helpers/auth-state.ts`，明确 E2E 登录 fixture 只能替代 OAuth 人机步骤，不能 mock Workspace/Session/Message/Device 主链路 API。
- TASK-006：Desktop E2E 必须验证 `bind-status` 从 `{bound:false}` 变为 `{bound:true,user}`，Electron UI/store 显示同一 user，并打开 Web workspace 后身份不断裂。
- 全局：governance gate 必须在干净工作区运行；执行者必须记录 dirty baseline、精确提交本 wave 相关文件并列出剩余非本任务 dirty 项。

Codex 复核结论：

- Plan anti-pattern review：**PASS FOR WAVE 1 EXECUTION**。
- 放行范围：只放行 **Wave 1 / TASK-001**。
- 未放行范围：W2-W4 不能一次性 execute；每个 wave 完成后必须回到 Codex 做行为证据复核。

PLAN_ANTI_PATTERN_REVIEW: PASS_FOR_WAVE_1_EXECUTION
