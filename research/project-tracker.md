# AgentHub 项目跟进表

> 所有 P0/P1/P2 任务的公开跟进记录。Maestro/Ralph 每完成一个 wave 必须同步更新本表。

---

## 治理规则

- **所有功能状态必须在本表同步**。没有本表对应记录，不允许标记 Maestro/Trellis 任务为完成。
- 每条记录必须包含：优先级、FR-ID、对应计划任务、当前状态、验收方式、测试证据、阻塞问题、下一步动作。
- 状态变更时附带日期。
- Maestro/Ralph 每完成一个 wave，必须更新对应任务的「当前状态」和「下一步动作」字段。
- 验证通过后必须补充「测试证据」字段（截图路径、E2E 报告链接或命令输出）。

---

## P0 任务

### AUTH-MIG-001: 认证路线迁移 Supabase Auth → Auth.js v5

| 字段 | 内容 |
|------|------|
| **优先级** | P0 |
| **绑定 FR-ID** | FR-AUTH-001 |
| **对应计划** | Maestro plan: `PLN-auth-migration`（7 tasks, 3 waves） |
| **Plan 路径** | `.workflow/scratch/20260527-plan-auth-migration/plan.json` |
| **Ralph Session** | `ralph-20260527-100000`（status: completed） |
| **当前状态** | ✅ 全部完成（2026-05-27）：Wave 1-3 执行完毕，verify PASS，review PASS |
| **目标** | 消除本地开发/E2E/Demo 对 Supabase Auth 控制台的强依赖 |
| **方案摘要** | Auth.js v5 + GitHub OAuth Provider + Drizzle adapter + Database session；DB 层暂保留 Supabase Postgres |
| **Wave 分解** | W1: 文档修订 + Auth.js 基础设施 → W2: 认证层替换 → W3: 设备绑定迁移 + E2E 验证 |
| **验收方式** | `npm run dev` 无需 Supabase Auth 环境变量 + E2E auth 测试通过 + Demo 路径不退化 |
| **测试证据** | `tsc --noEmit` exit 0；`vitest run __tests__/` 85 tests pass；`rg 'supabase\.auth\|@supabase/ssr' apps/web/` 无匹配；verification.json verdict=PASS (20/20) |
| **阻塞问题** | 无 |
| **下一步动作** | 迁移闭环，无后续动作 |

---

## P1 任务

（暂无登记）

---

## P2 任务

（暂无登记）

---

## 变更历史

| 日期 | 任务 | 变更 |
|------|------|------|
| 2026-05-27 | AUTH-MIG-001 | 初始登记，计划已确认待执行 |
| 2026-05-27 | AUTH-MIG-001 | Wave 1 完成：TASK-001 文档修订 + TASK-002 Auth.js 基础设施搭建，type-check 通过 |
| 2026-05-27 | AUTH-MIG-001 | Wave 2 完成：TASK-003 middleware + TASK-004 API auth guard + TASK-005 Login 替换，type-check 通过 |
| 2026-05-27 | AUTH-MIG-001 | Wave 3 完成：TASK-006 Desktop 设备绑定 + TASK-007 测试适配，全量验收通过，session completed |
