# Maestro 指导与验收手册

> 本手册定义 Codex 如何指导 Maestro/Ralph 完成 AgentHub 后续开发，以及如何验收 Maestro 的反馈。它是 `research/` 公开总账体系的一部分，优先级高于 `.workflow/.maestro/*/status.json` 里的机器状态。

---

## 角色分工

| 角色 | 职责 | 不做什么 |
| --- | --- | --- |
| 用户 | 提供产品判断、人工测试反馈、业务取舍 | 不负责补齐执行报告和治理门禁 |
| Codex | 技术甲方、架构审查、命令路由、验收裁判 | 不默认替 Maestro 大规模写业务代码 |
| Maestro/Ralph | 执行分析、规划、实现、验证、审查和提交 | 不得绕过 `research/` 总账和治理门禁 |
| `research/` | 人类可读的需求、设计、跟进和证据中心 | 不存放临时机器状态 |
| `.workflow/` | Maestro 机器执行状态、计划和 scratch 产物 | 不作为最终项目完成依据 |

---

## Codex 工作方式

Codex 每次收到用户转述的 Maestro 反馈后，按以下顺序处理：

1. 判断当前场景属于需求、技术方案、UI、实现、测试、验收、治理修复还是复盘。
2. 读取必要的 `research/` 文档，而不是只相信 Maestro summary。
3. 给出 Maestro 下一步应使用的命令和 prompt。
4. 对 Maestro 宣称完成的内容做独立核对：`git status`、最新 commit、`research/project-tracker.md`、`execution-reports/`、测试证据。
5. 发现不一致时，要求 Maestro 先补治理闭环，不进入新功能。

---

## 命令路由表

| 场景 | 首选命令 | 何时使用 | 避免 |
| --- | --- | --- | --- |
| 不知道该走哪条链 | `/maestro` | 小范围自动路由 | 用它替代复杂长期闭环 |
| 新目标复杂且跨多阶段 | `/maestro-ralph "目标"` | 需要 analyze -> plan -> execute -> verify -> review | 缺少治理门禁时直接 beta 长跑 |
| 已有 Ralph session | `/maestro-ralph-execute` | 继续当前 session 的 next pending step | 重新 `/maestro-ralph` 导致重开链路 |
| 需要长时间自动推进 | `/maestro-ralph-beta` | 仅在治理硬门禁稳定后使用 | P0 高风险任务初次尝试 |
| 需求模糊 | `/maestro-brainstorm` | 用户还在讨论产品方向 | 直接 `/maestro-execute` |
| 生成正式规格文档链 | `/maestro-blueprint` | Product Brief、PRD、Architecture、Epics | 用代码实现替代规格确认 |
| 技术路线不确定 | `/maestro-analyze` | Auth、Runtime、E2E、UI 技术选型 | 先写代码再补分析 |
| 已有分析，需拆计划 | `/maestro-plan` | 产出 waves、tasks、验证标准 | 裸 `/maestro-execute` |
| 已有计划目录 | `/maestro-execute --dir <plan-dir>` | 按 `.workflow/scratch/*/plan.json` 执行 | 未读计划直接改代码 |
| UI 审美或交互不达标 | `/maestro-impeccable` | 桌面/Web/移动端 UI 打磨 | 只用功能测试判断 UI |
| 从参考项目提炼 UI | `/maestro-ui-codify` | AionUi、CodeG、Cherry Studio 等参考沉淀 | 只靠口头“参考一下” |
| 执行后验证 | `/maestro-verify` | 功能、结构、测试和反模式检查 | 只看 `toBeVisible` 或 status.json |
| 生成/补齐测试 | `/quality-auto-test` | 缺单测、E2E、视觉断言 | 实现后不补测试 |
| 交互/UAT 验证 | `/quality-test` | 需要点击、填写、状态流转 | 只跑类型检查 |
| 测试失败定位 | `/quality-debug` | verify/test/review 失败后 | 反复 execute 盲修 |
| 代码审查 | `/quality-review` | verify 通过后，complete 前 | 直接 milestone complete |
| 文档同步 | `/quality-sync` | 代码变更后 PRD/技术文档可能滞后 | 让 `.workflow` 替代 `research/` |
| 阶段集成审计 | `/maestro-milestone-audit` | complete 前跨模块检查 | 跳过 audit |
| 阶段归档完成 | `/maestro-milestone-complete` | verify、review、audit、governance gate 全通过后 | 手动改 status.json |
| 流程自身有缺陷 | `/maestro-amend --from-session <id> --scan` | Ralph 虚假完成、命令链漏门禁 | 继续加普通 prompt |
| 非侵入式修补命令 | `/maestro-overlay` | 注入门禁、阅读要求、质量规则 | 直接改 Maestro 原始命令 |
| 查看项目状态 | `/manage-status` | 日常进度查询 | 人工翻 scratch 猜状态 |
| 问题登记/跟踪 | `/manage-issue` | 发现缺陷、需求冲突、阻塞 | 散落在聊天里 |
| 自动发现问题 | `/manage-issue-discover` | 验收前风险扫描 | 等用户发现 |
| 沉淀执行产物 | `/manage-harvest` | 从 `.workflow` 提炼到 wiki/spec/research | 让 scratch 长期堆积 |
| 复盘学习 | `/maestro-learn` / `/learn-retro` | 形成可复用经验 | 只留 commit message |

---

## 固定验收口径

Maestro/Ralph 说“完成”时，Codex 必须核对：

1. `git status --short`：没有遗漏的相关改动；如有无关用户改动，必须说明并隔离。
2. `git log -3 --oneline`：最新提交对应本 wave 或本任务。
3. `research/project-tracker.md`：任务状态、测试证据、下一步动作已更新。
4. `research/execution-reports/`：本 wave 或本任务报告已补齐。
5. 测试命令：type-check、unit、E2E、视觉断言按任务范围执行。
6. `scripts/verify-governance-gate.sh <TASK-ID>`：最终完成前必须 exit 0。

`status.json completed` 只说明 Maestro 状态机完成，不等于项目完成。

---

## Prompt 生成规则

Codex 给 Maestro 的 prompt 必须包含：

1. 明确的 `TASK-ID` 和绑定 `FR-ID`。
2. 必读文档：至少包含 `research/index.md`、`research/project-tracker.md`、相关 PRD/技术/UI 文档。
3. 明确阶段：分析、计划、实现、验证、审查、治理修复之一。
4. 禁止项：不得 `git add .`，不得提交 `refer_proj/*`、缓存、临时日志和未确认改动。
5. 完成定义：测试证据、执行报告、tracker、精确 commit、governance gate。
6. 开始/结束标记，便于用户复制。

推荐格式：

```text
<<<BEGIN_MAESTRO_PROMPT
目标：...
当前状态：...
必读文档：...
执行要求：...
验证要求：...
提交要求：...
完成标准：...
END_MAESTRO_PROMPT>>>
```

---

## 当前项目默认流程

| 阶段 | 默认处理 |
| --- | --- |
| 需求/PRD 变更 | 更新 `research/prd.md` 或新增 `research/prd-amendments/*.md`，再进入实现 |
| 技术方案变更 | `/maestro-analyze` -> `/maestro-plan`，更新 `technical-design.md` 或 `modules/*.md` |
| 中大型实现 | `/maestro-ralph` 建 session，后续用 `/maestro-ralph-execute` 推进 |
| UI 专项 | `/maestro-ui-codify` 提炼参考 -> `/maestro-impeccable` 打磨 -> `/maestro-verify` |
| 测试专项 | `/quality-auto-test` -> `/quality-test` -> `/maestro-verify` |
| 最终验收 | `/maestro-verify` -> `/quality-review` -> `/maestro-milestone-audit` -> governance gate -> `/maestro-milestone-complete` |
| 流程偏差 | `/maestro-amend --from-session <id> --scan`，必要时新增 overlay |

---

## 用户反馈处理规则

用户把 Maestro 输出、截图、人工测试结果或疑问发给 Codex 时，Codex 先判断：

- 如果是实现结果：先验收，再决定是否让 Maestro 继续。
- 如果是 UI 不满意：先回到 UI 契约和参考项目，不直接让 Maestro 小修小补。
- 如果是需求不清：暂停实现，更新 PRD amendment 或让 Maestro analyze。
- 如果是测试失败：走 `quality-debug`，不要盲目 execute。
- 如果是流程漏项：走 `maestro-amend` 或治理门禁，不把问题藏在单次 prompt。

