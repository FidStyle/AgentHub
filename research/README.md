# AgentHub Research 文档目录

> 本目录存放 AgentHub 的项目级需求、产品设计、技术选型、架构文档和项目跟进记录。

---

## 目录规范

```
research/
  README.md                 ← 本文件：目录规范和阅读指南
  index.md                  ← 全部文档总索引（唯一入口）
  ai-workflow-control.md    ← AI 工作流控制协议：Codex/Trellis/Maestro 分工
  ../bytedance_init_prd.md  ← 最高产品事实源
  ../bytedance_init_video_txt.txt ← Bytedance 讲解转写，辅助解释事实源
  prd.md                    ← 派生 PRD，FR-ID 注册表
  product-design.md         ← 产品设计：页面、用户流、组件状态
  technical-design.md       ← 技术路线、架构、数据模型、协议
  ui-design-system.md       ← 三端 UI 设计系统、组件契约、视觉 E2E 门禁
  desktop-p0-ui-ux-contract.md  ← Desktop P0 UI/UX 契约
  automation-reference-comparison.md ← 自动化执行参考比较
  project-tracker.md        ← P0/P1/P2 项目跟进表（必须实时更新）
  decision-log.md           ← 关键产品与技术决策日志
  contracts/                ← 共享任务合同（Trellis 与 Maestro/Ralph 的协作接口）
  modules/                  ← 模块调研（auth, runtime, orchestrator 等）
  prd-amendments/           ← PRD 增补修订；Bytedance 对齐类修订可直接更新 master PRD
  execution-reports/        ← 阶段/里程碑级执行报告；禁止为每个小 bug 或每个 wave 新建碎片报告
  reference-repos/          ← 参考仓库对比分析
  prompts/                  ← Maestro 执行 prompt 模板
  archive/                  ← 历史/过渡文档归档
    maestro/                ← Maestro 历史过渡文档
scripts/
  verify-governance-gate.sh ← Maestro/Ralph 完成前治理门禁脚本
```

---

## 根目录保留规则

根目录只保留**当前活跃的契约文档**和**跟进入口**：

| 保留条件 | 示例 |
|----------|------|
| 产品/技术契约（实现必须遵循） | prd.md, technical-design.md, ui-design-system.md |
| 项目跟进入口 | project-tracker.md, decision-log.md, index.md |
| 当前活跃的设计契约 | desktop-p0-ui-ux-contract.md |

不满足以上条件的文档必须移入子目录。

## 文档生命周期与去噪规则

`research/` 不是流水账目录。新增文档前必须先判断能否写入现有长期文档：

| 信息类型 | 默认写入位置 | 禁止做法 |
|----------|--------------|----------|
| bug / regression / 未完成项 / 不完善项 | `regression-ledger.md`，必要时同步 `project-tracker.md` | 为每个 bug 新建一份 execution report |
| 任务状态、阻塞、下一步 | `project-tracker.md` | 新建临时 status 文档 |
| 产品/技术决策 | `decision-log.md` | 散落在 execution report 或聊天里 |
| PRD 范围变化 | 小范围直接更新 `prd.md` 和下游设计；影响范围大时补 `prd-amendments/` | 直接改业务代码来隐式改变需求 |
| 中大型任务合同 | `contracts/<TASK-ID>.md` | 每个 wave 都建合同 |
| 验证证据 | 对应任务的一份 execution report 中追加章节 | 每个 wave 都新建 `<task-or-wave>-report.md` |
| 临时计划、scratch、机器状态 | `.workflow/` 或 `.trellis/tasks/<task>/research/` | 放进根 `research/` |

`index.md` 只索引长期入口、合同目录和关键当前报告；不要把每个 execution report、每个 bug 记录、每个 scratch 产物都挂到总索引。

---

## 文档优先级（冲突时）

1. `bytedance_init_prd.md` 的原始产品要求
2. `bytedance_init_video_txt.txt` 的解释性材料
3. 用户最新明确决策
4. `ai-workflow-control.md` 的工作流控制规则
5. `contracts/<TASK-ID>.md` 的当前任务共享合同
6. `prd.md` 的派生 FR-ID 和验收标准
7. `product-design.md` 的页面与交互契约
8. `ui-design-system.md` 的 UI 契约
9. `technical-design.md` 的最终技术路线
10. `modules/*.md` 的研究证据
11. 会话中的临时讨论

---

## 治理规则

1. **工作流入口**：新会话先读 `index.md` 和 `ai-workflow-control.md`，再进入 Trellis 或 Maestro。
2. **共享合同**：中大型任务必须使用 `contracts/<TASK-ID>.md` 作为 Trellis 与 Maestro/Ralph 的协作接口。
3. **跟进义务**：Maestro/Ralph 每完成一个用户可见阶段或里程碑，必须同步更新 `project-tracker.md` 和对应任务报告；wave 级细节优先追加到同一报告或 `.workflow/` 产物，不得默认新建碎片 report。
4. **PRD 修订**：发现 PRD/技术设计与 Bytedance 原始材料或当前计划冲突，先更新 `prd.md`、产品设计和技术设计；影响范围大时再补 `prd-amendments/*.md`。
5. **索引维护**：只有长期入口、合同、关键当前报告需要同步 `index.md`；碎片报告、单个 bug 记录、历史证据不得进入总索引。
6. **归档规则**：已完成的过渡计划、历史 prompt 移入 `archive/` 或 `prompts/`。
7. **完成门禁**：session/milestone complete 前必须运行 `bash scripts/verify-governance-gate.sh <TASK-ID>`，失败时不得手动修改 `status.json` 绕过。
