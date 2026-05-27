# AgentHub Research 文档目录

> 本目录存放 AgentHub 的项目级需求、产品设计、技术选型、架构文档和项目跟进记录。

---

## 目录规范

```
research/
  README.md                 ← 本文件：目录规范和阅读指南
  index.md                  ← 全部文档总索引（唯一入口）
  prd.md                    ← 总体 PRD，FR-ID 注册表
  product-design.md         ← 产品设计：页面、用户流、组件状态
  technical-design.md       ← 技术路线、架构、数据模型、协议
  ui-design-system.md       ← 三端 UI 设计系统、组件契约、视觉 E2E 门禁
  desktop-p0-ui-ux-contract.md  ← Desktop P0 UI/UX 契约
  automation-reference-comparison.md ← 自动化执行参考比较
  project-tracker.md        ← P0/P1/P2 项目跟进表（必须实时更新）
  decision-log.md           ← 关键产品与技术决策日志
  modules/                  ← 模块调研（auth, runtime, orchestrator 等）
  prd-amendments/           ← PRD 增补修订（不直接改 prd.md）
  execution-reports/        ← 执行报告（每次迁移/实现前后）
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

---

## 文档优先级（冲突时）

1. `prd.md` 的 FR-ID 和验收标准
2. `product-design.md` 的页面与交互契约
3. `ui-design-system.md` 的 UI 契约
4. `technical-design.md` 的最终技术路线
5. `modules/*.md` 的研究证据
6. 会话中的临时讨论

---

## 治理规则

1. **跟进义务**：Maestro/Ralph 每完成一个 wave，必须同步更新 `project-tracker.md` 和 `execution-reports/*.md`。
2. **PRD 修订**：发现 PRD/技术设计与当前计划冲突，只能新增 `prd-amendments/*.md`。
3. **索引维护**：新增研究文档必须同步更新 `index.md`。
4. **归档规则**：已完成的过渡计划、历史 prompt 移入 `archive/` 或 `prompts/`。
5. **完成门禁**：session/milestone complete 前必须运行 `bash scripts/verify-governance-gate.sh <TASK-ID>`，失败时不得手动修改 `status.json` 绕过。
