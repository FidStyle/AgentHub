# Maestro 指导与验收手册

> 本手册定义 Codex 如何指导 Maestro/Ralph 完成 AgentHub 后续开发，以及如何验收 Maestro 的反馈。它是 `research/` 公开总账体系的一部分，优先级高于 `.workflow/.maestro/*/status.json` 里的机器状态。

工作流总入口是 [ai-workflow-control.md](./ai-workflow-control.md)。中大型任务必须先创建或引用 `research/contracts/<TASK-ID>.md`，Maestro/Ralph 只负责把共享合同派生为 analyze/plan/execute/verify/review，不得重写合同事实。

---

## 角色分工

| 角色 | 职责 | 不做什么 |
| --- | --- | --- |
| 用户 | 提供产品判断、人工测试反馈、业务取舍 | 不负责补齐执行报告和治理门禁 |
| Codex | 技术甲方、架构审查、命令路由、验收裁判 | 不默认替 Maestro 大规模写业务代码 |
| Maestro/Ralph | 执行分析、规划、实现、验证、审查和提交 | 不得绕过 `research/` 总账和治理门禁 |
| `research/` | 人类可读的需求、设计、跟进和证据中心 | 不存放临时机器状态 |
| `.workflow/` | Maestro 机器执行状态、计划和 scratch 产物 | 不作为最终项目完成依据 |
| `research/contracts/` | Trellis 与 Maestro/Ralph 的共享任务合同 | 不存放 scratch 计划或执行状态 |

---

## Codex 工作方式

Codex 每次收到用户转述的 Maestro 反馈后，按以下顺序处理：

1. 读取 `research/ai-workflow-control.md`，判断当前场景属于需求、技术方案、UI、实现、测试、验收、治理修复还是复盘。
2. 对中大型任务确认是否已有 `research/contracts/<TASK-ID>.md`；没有合同则先让 Maestro/Codex 做合同阶段，不直接 execute。
3. 读取必要的 `research/` 文档，而不是只相信 Maestro summary。
4. 给出 Maestro 下一步应使用的命令；只在命令本身不足以表达边界时追加短 prompt 或长 prompt。
5. 对 Maestro 宣称完成的内容做独立核对：共享合同、`git status`、最新 commit、`research/project-tracker.md`、`execution-reports/`、测试证据。
6. 发现不一致时，要求 Maestro 先补治理闭环，不进入新功能。

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

额外硬规则：完成一个功能后，不能立即默认推进下一个功能。必须先检查同一产品面是否存在未关闭的 regression / quality debt，尤其是用户已经能看到的 UI/UX 点击语义、鉴权后入口、真实 DB/API/session 闭环、消息发送和刷新持久化。若存在这类问题，下一步默认是修复和补测试，而不是继续开发新能力。

对 UI/UX 或工作台类功能，review/verify 不能只接受“组件存在”“按钮可见”“页面无横向滚动”。必须至少验证关键按钮有 handler、点击后产生真实状态/API 变化、错误态可见、刷新后数据仍在；否则只能标记 `DONE_WITH_CONCERNS` 或 `BLOCKED`，不得进入 milestone complete。

`status.json completed` 只说明 Maestro 状态机完成，不等于项目完成。

Analyze、plan、verify、review 等 artifact-only 阶段也必须提交自己的公开产物。只要写入或修改 `research/`、`.workflow/roadmap.md`、`.workflow/scratch/*/plan.json`、测试文件或代码，就必须精确 `git add` 本阶段相关文件并使用中文 commit。不得把“没有代码改动”作为不提交 research/tracker/report 的理由。

## 后台 Shell 与 Delegate 时间预算

Maestro/Ralph 执行后台 shell、delegate、长轮询测试或 watcher 时，必须设置明确时间预算，不能无限等待：

1. 常规 review/decision delegate 若 3-5 分钟无实质输出，应主动检查进程、日志和当前 step 状态。
2. 长测试或构建必须先说明预期耗时；超过预期时应输出当前证据并决定继续、降级为本地判定，或停止并标记 BLOCKED。
3. 发现残留 `maestro`、`delegate`、`tsx`、`node`、dev server 或 test runner 后台进程时，必须列出并清理与本 step 相关的残留进程，不能让会话空等。
4. Decision 节点不应为了等待 delegate 而阻塞整条链；已有足够证据时可本地评估并写入 review/verify artifact。
5. 完成输出必须说明是否存在仍在运行的后台进程；存在无关既有进程时要标明“不属于本 step”。

---

## Prompt 生成规则

Codex 指导 Maestro 时优先输出可直接执行的 `/maestro-*`、`/quality-*` 或 `/manage-*` 命令。Prompt 不是默认产物，按风险分级选择：

1. **命令即可**：阶段已知、上下文刚刚确认、命令参数足够表达目标时，只给命令和一句目的说明。
2. **短 prompt**：需要补充边界、禁止项、验收口径或 deferred 分类时，给 3-8 行短说明，避免复制整套模板。
3. **长 prompt**：只有中大型合同交接、跨阶段 execute、dirty worktree、治理门禁失败、Maestro 反复漏项、产品边界不清或用户要求可复制完整指令时，才输出 `<<<BEGIN_MAESTRO_PROMPT ... >>>` 长模板。

短 prompt 通常只包含：

- 本次目标和 `TASK-ID`。
- 关键输入文件或计划目录。
- 明确边界：只验证、只计划、只修某项，或不得继续 execute。
- 最重要的完成标准，例如报告、tracker、测试证据或 governance gate。

长 prompt 才需要完整包含：

1. 明确的 `TASK-ID` 和绑定 `FR-ID`。
2. 必读文档：至少包含 `research/ai-workflow-control.md`、`research/index.md`、`research/project-tracker.md`、`research/contracts/<TASK-ID>.md`、相关 PRD/技术/UI 文档。
3. 明确阶段：分析、计划、实现、验证、审查、治理修复之一。
4. 禁止项：不得 `git add .`，不得提交 `refer_proj/*`、缓存、临时日志和未确认改动。
5. 完成定义：测试证据、执行报告、tracker、精确 commit、governance gate。
6. 开始/结束标记，便于用户复制。
7. 对 plan 阶段，必须要求读取 `.trellis/spec/guides/end-to-end-contract-planning.md` 并输出 `PLAN_ANTI_PATTERN_REVIEW: PASS`；未通过时只能 revise，不能 execute。

如果当前工作区存在既有无关改动，短 prompt 或长 prompt 都必须要求 Maestro/Ralph 在开始时记录 dirty baseline，在提交时只提交本任务相关文件，并在完成输出里列出剩余 dirty 项；不能因为无关 dirty 项存在而跳过本任务 commit。

Codex 后续为用户生成 Maestro/Ralph 指导时，默认套用以下协议：

1. **先选命令，再决定 prompt 长度**：命令能清楚表达就不给长 prompt；需要额外约束时先给短 prompt；只有复杂或高风险任务才给长 prompt。
2. **用 Spec 承载长期记忆**：如果本次任务暴露新的反复性规则、质量标准或流程缺口，优先补 `.workflow/specs/*` 或 `research/maestro-guidance-playbook.md`，而不是只在聊天里提醒。
3. **用脚本承载硬判断**：完成与否不得靠 Maestro summary 或 `status.json completed`，必须以 `scripts/verify-governance-gate.sh <TASK-ID>`、git 状态、测试证据和 `research/` 公开总账为准。
4. **观察后再升级 overlay**：只有当 Maestro/Ralph 在 1-2 次任务中仍然忘记运行门禁、脚本失败仍 complete、手动改 `status.json` 或只写 `.workflow/scratch/` 时，才建议使用 `/maestro-overlay` 或 `/maestro-amend --from-session <id> --scan` 注入命令级补丁。
5. **最后才考虑改 Maestro 本体**：除非 overlay 不能覆盖、升级后仍重复失效，或用户明确要求维护 Maestro 工具链，否则不直接修改 Maestro 原始命令或执行逻辑。

默认优先级：

```text
命令选择 > 短 prompt > 长 prompt > 项目 Spec / always-inject > 门禁脚本 > overlay/amend > Maestro 本体修改
```

短 prompt 推荐格式：

```text
命令：/maestro-verify <phase> --dir <plan-dir>
补充：只验证并分流剩余项；不得继续 execute。核对 tracker、execution report、git status 和 governance gate。
```

长 prompt 推荐格式：

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

标准 Prompt 骨架：

```text
<<<BEGIN_MAESTRO_PROMPT
目标：<一句话说明本次任务>
TASK-ID：<任务 ID>
绑定 FR-ID：<FR-ID 列表>

执行前必读：
- research/prompts/maestro-execution-governance.md
- research/ai-workflow-control.md
- .trellis/spec/guides/end-to-end-contract-planning.md
- research/index.md
- research/project-tracker.md
- research/decision-log.md
- research/contracts/<TASK-ID>.md
- <本任务相关 PRD / 技术 / UI 文档>

当前状态：
- <来自 project-tracker / git / 用户反馈的事实>

执行要求：
- <分析/计划/实现/验证/治理修复的具体要求>
- 不得手动编辑 .workflow/.maestro/*/status.json 绕过 active step 或 decision gate。
- 不得只写 .workflow/scratch/，必须同步 research/ 公开总账。

验证要求：
- <lint/type/test/E2E/视觉断言命令>
- 将验证命令和结果写入 research/execution-reports/。

提交要求：
- 只能精确 git add 本 wave 相关文件，禁止 git add .。
- commit message 必须中文。
- 禁止提交 refer_proj/*、缓存、临时日志和未确认改动。

完成标准：
- research/project-tracker.md 已更新。
- research/execution-reports/ 已补齐。
- 测试证据已写入报告。
- 已运行 bash scripts/verify-governance-gate.sh <TASK-ID> 且 exit 0。
- 门禁失败时输出 CONCERNS 并停止，不允许 milestone-complete/session complete。
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
