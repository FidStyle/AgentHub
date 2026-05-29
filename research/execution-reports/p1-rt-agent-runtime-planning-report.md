# P1-RT Agent Runtime 完整部署 — 规划执行报告

> ralph session `ralph-20260529-150000` — analyze → scope-gate → roadmap → plan，**止步于 plan/recommendation**

## 概要

| 字段 | 值 |
|------|-----|
| 任务 ID | P1-RT |
| 优先级 | P1 |
| Ralph session | ralph-20260529-150000 |
| 执行链 | maestro-analyze → ◆post-analyze-scope → maestro-roadmap → maestro-plan |
| scope_verdict | **large**（跨三子系统，估 3-5 工作日） |
| 最终状态 | 🔄 规划完成，止步 plan（按用户约束不 execute） |
| Steps | 4/4 completion_confirmed |
| Sub-goals | G1 + G2 confirmed；task_decomposition_all_done=true |

## 止步决策

用户约束：「如判断范围超过一个工作日或跨越 runtime 服务部署、Desktop 本地进程管理、云端 adapter 三个子系统，先停在 plan/recommendation，不要 execute」。

macro analyze 判定 scope_verdict=**large**（三子系统 + 3-5 工作日）→ 触发止步条件。session 在 plan 完成后正常结束，不进入 execute。

## 执行链路

### Step 0: maestro-analyze（macro）

产出 `scratch/20260529-analyze-p1-runtime/`：
- `conclusions.json` — scope_verdict=large、6 维评分、3 子系统现状/目标/估时、gaps、recommendation
- `discussion.md` — 现状图、Decision Recording（D-001~D-004）、Intent Coverage、Go/No-Go

**关键现状发现**：
- Desktop 本地运行时**已功能完整**（RuntimeHost + StreamAdapter + RuntimeDetector + ConfigStore + IPC + DeviceChannel 全链路）
- HostedRuntimeAdapter 是 **minimal stub**（只 yield 'minimal_adapter'）
- CloudRuntimeAdapter **不存在**
- 缺 runtime_sessions/logs DB 表；错误码 Desktop/Web 不统一

### Step 1: ◆ post-analyze-scope（decision）

ralph A_SCOPE_EVALUATE：读 scope_verdict=large → A_APPLY_SCOPE_VERDICT 路径 A（保留 roadmap + plan，注入 `--from analyze:ANL-20260529-p1-runtime`）。decision log 记 DEC scope-gate。

### Step 2: maestro-roadmap

追加 `.workflow/roadmap.md` → Milestone **P1-RT** 含 3 phase（HostedRuntimeAdapter / Desktop 增强 / Cloud Adapter），各含 Success Criteria + 依赖关系。

### Step 3: maestro-plan（standalone, --from analyze）

产出 `scratch/20260529-plan-p1-runtime/`：
- `plan.json` — 7 tasks / 3 waves / open_decisions(D-003/D-005) / risk_notes
- `.task/TASK-001~007.json` — 各任务定义含 files/acceptance/depends_on/estimate

**Wave 划分**：
- Wave 1（Phase 1，独立）：TASK-001 DB schema + TASK-002 HostedAdapter + TASK-003 /api/chat
- Wave 2（Phase 2，依赖 W1）：TASK-004 错误码枚举 + TASK-005 Desktop 持久化
- Wave 3（Phase 3，blocked by D-003）：TASK-006 CloudAdapter + TASK-007 测试

## Open Decisions（execute 前需解决）

| ID | 问题 | 阻塞 |
|----|------|------|
| D-003 | Cloud runtime 服务选型（Modal/Fly/自建） | Wave 3 |
| D-005 | Phase 执行顺序（是否先做 Phase 1 验收） | execute 启动 |

## 不回改保证

boundary_contract.out_of_scope 明确排除并全程未触及：
- P0-END-TO-END-PRODUCT-FLOW 已闭环代码
- UI-ALIGN-001 已闭环代码
- mobile-pwa fixture 修复

本 session 仅写 `.workflow/`（roadmap/scratch/state/status）+ `research/`，无产品代码改动。

## Artifacts 登记（state.json）

| ID | type | path |
|----|------|------|
| ANL-20260529-p1-runtime | analyze (macro) | scratch/20260529-analyze-p1-runtime |
| RDM-20260529-p1-runtime | roadmap | .workflow/roadmap.md |
| PLN-20260529-p1-runtime | plan (standalone) | scratch/20260529-plan-p1-runtime |

## 下一步

1. 用户决策 D-003（Cloud 选型）+ D-005（Phase 优先级）
2. 建议先 `/maestro-plan` 细化 Phase 1（独立可验收）→ 进入 execute
3. Phase 2/3 待 Phase 1 验收后评估
