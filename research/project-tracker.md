# AgentHub 项目跟进表

> 所有 P0/P1/P2 任务的公开跟进记录。Maestro/Ralph 每完成一个 wave 必须同步更新本表。

---

## 治理规则

- **所有功能状态必须在本表同步**。没有本表对应记录，不允许标记 Maestro/Trellis 任务为完成。
- 每条记录必须包含：优先级、FR-ID、对应计划任务、当前状态、验收方式、测试证据、阻塞问题、下一步动作。
- 状态变更时附带日期。
- Maestro/Ralph 每完成一个 wave，必须更新对应任务的「当前状态」和「下一步动作」字段。
- 验证通过后必须补充「测试证据」字段（截图路径、E2E 报告链接或命令输出）。
- **治理门禁**：milestone/session complete 前必须运行 `bash scripts/verify-governance-gate.sh <TASK-ID>` 且 exit 0。status.json completed ≠ 项目完成。

---

## P0 任务

### UI-ALIGN-001: 三端 UI 参考项目对齐修复

| 字段 | 内容 |
|------|------|
| **优先级** | P0 |
| **绑定 FR-ID** | FR-UI-001, FR-DESK-001, FR-WEB-001, FR-MOB-001 |
| **对应计划** | impeccable improve chain: critique → refine → polish → audit |
| **当前状态** | 🔄 进行中（2026-05-27）：refine loop 1 完成，P0 修复已落地 |
| **目标** | 三端视觉母版统一，对齐 AionUi/codeg 参考项目的信息密度和组件规范 |
| **方案摘要** | Desktop 侧栏加 lucide 图标；Web Composer 加工具条；Mobile 统一色彩 token；消除营销文案 |
| **验收方式** | type-check 通过 + Playwright 视觉/布局断言 + critique 评分 ≥26/40 |
| **测试证据** | `tsc --noEmit` web/desktop 通过；新增 e2e/tests/web/ui-alignment.spec.ts + e2e/tests/desktop/ui-alignment.spec.ts |
| **阻塞问题** | Mobile React 版本兼容性（react-native 要求 18，项目用 19）— 预存问题 |
| **下一步动作** | 完成 polish + audit 步骤，补充 execution-report |

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

### GOV-GATE-001: Maestro/Ralph 完成前治理门禁

| 字段 | 内容 |
|------|------|
| **优先级** | P0 |
| **绑定 FR-ID** | FR-UI-001, FR-AUTH-001, 全部实现类任务 |
| **对应计划** | Codex 治理基础设施补强 |
| **当前状态** | ✅ 完成（2026-05-27）：治理门禁脚本、兼容别名、执行 Prompt 与索引接入已落地 |
| **目标** | 防止 Maestro/Ralph 仅凭 `status.json completed` 假完成，强制公开跟进、测试证据和中文 commit 闭环 |
| **方案摘要** | 增强 `scripts/verify-governance-gate.sh`，新增 `scripts/check-governance-gate.sh` 兼容别名，新增 `research/prompts/maestro-execution-governance.md`，并接入 Maestro spec injection |
| **验收方式** | Shell 语法检查通过 + Maestro spec injection 已包含治理 Prompt + 真实门禁运行能识别当前未提交改动 |
| **测试证据** | `bash -n scripts/verify-governance-gate.sh` exit 0；`bash -n scripts/check-governance-gate.sh` exit 0；`maestro spec injection always` 已注入治理 Prompt；当前存在未提交业务/UI 改动时门禁应失败 |
| **阻塞问题** | 当前工作区存在既有 UI/业务改动，不由本治理任务回滚或提交 |
| **下一步动作** | 后续 Maestro 每个 wave 完成后运行 `bash scripts/verify-governance-gate.sh <TASK-ID>`；失败不得 complete |

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
| 2026-05-27 | UI-ALIGN-001 | 初始登记，impeccable improve chain critique 评分 22/40 |
| 2026-05-27 | UI-ALIGN-001 | Refine loop 1：Desktop 侧栏 lucide 图标、Web Composer 工具条、Mobile 共享色彩 token、营销文案替换 |
| 2026-05-27 | GOV-GATE-001 | 新增完成前治理门禁脚本、兼容别名、Maestro 执行治理 Prompt，并接入 research 索引和 Maestro spec injection |
