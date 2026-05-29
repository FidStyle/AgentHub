# AgentHub AI 工作流控制协议

> 本文件定义 AgentHub 后续开发的顶层协作方式。新会话、新窗口、Codex、Trellis 和 Maestro/Ralph 都必须从这里恢复工作流判断。

---

## 1. 核心原则

AgentHub 后续开发采用 **共享合同层 + 独立执行系统**。

```text
research/        = 共享合同层，存放产品事实、技术路线、验收口径和执行证据
.trellis/        = Codex/Trellis 实现规范系统，负责任务上下文、工程规则和代码前置检查
.workflow/       = Maestro/Ralph 执行编排系统，负责 analyze/plan/execute/verify/review 状态机
refer_proj/      = 参考输入，只能提炼规则，不能作为提交产物
```

Trellis 和 Maestro 不互相吞状态，也不各自发明产品事实。二者通过 `research/` 中的显式合同协作。

---

## 2. 角色分工

| 角色 | 职责 | 不做什么 |
| --- | --- | --- |
| 用户 | 提供最终产品取舍和人工验收反馈 | 不负责补齐任务报告、测试证据和治理门禁 |
| Codex | 工作流控制者、技术甲方、架构审查、验收裁判；负责把用户目标转成共享合同，并监督 Trellis/Maestro 按合同执行 | 不把大范围产品实现藏在零散聊天里；不只按局部页面/API 宣称完成 |
| Trellis | 任务和工程规范系统；把共享合同派生为 `.trellis/tasks/*`、`implement.jsonl`、`check.jsonl` 和 `.trellis/spec/*` | 不作为产品路线图唯一事实源；不直接相信 `.workflow/.maestro/*/status.json` |
| Maestro/Ralph | 大范围执行系统；按合同进行 analyze、plan、execute、verify、review 和提交 | 不绕过 `research/` 公开总账；不只写 `.workflow/scratch/`；不以 `status.json completed` 代表项目完成 |
| `research/` | 唯一共享事实和合同层；记录 PRD、技术设计、UX 合同、执行报告、决策和项目状态 | 不存放临时机器状态 |

---

## 3. 共享合同机制

所有中大型任务必须先有共享合同：

```text
research/contracts/<TASK-ID>.md
```

共享合同是 Trellis 和 Maestro 的唯一协作接口。合同必须包含：

1. `TASK-ID`、绑定 `FR-ID`、优先级。
2. 来源文档：原始 PRD、`research/prd.md`、产品设计、技术设计、相关模块调研。
3. 用户链路合同：从真实用户入口到完成状态的完整路径。
4. 三端职责边界：Web、Desktop、Mobile 分别负责什么。
5. 数据合同：是否必须使用真实 DB、schema/API/session 要求、迁移和 seed 要求。
6. UI/UX 合同：布局、状态、错误提示、空状态、交互闭环、中文文案。
7. 参考项目输入：读哪些项目、提炼哪些 UX/结构规则、不采用哪些内容。
8. 测试合同：自动化测试和人工验收必须覆盖的完整链路。
9. 完成门禁：type-check、集成测试、E2E、视觉断言、报告、tracker、commit、治理脚本。
10. 禁止项：不得 mock 主链路数据、不得提交参考项目、不得绕过治理门禁。

合同一旦创建：

- Trellis task 的 `prd.md` 必须引用它。
- Trellis `implement.jsonl` / `check.jsonl` 必须包含它。
- Maestro prompt 必须强制读取它。
- 执行报告必须回写合同对应的测试证据和残留风险。
- Codex 最终验收必须按合同逐项核对。

---

## 4. 产品实现原则

AgentHub MVP 必须以最终产品形态实现，不能用 mock 主链路掩盖真实问题。

### 4.1 数据原则

- Workspace、Session、Message、User、Account 等主链路数据必须使用真实数据库。
- P0 阶段允许使用本地开发数据库、远端 dev 数据库、migration、seed、测试账号和测试 fixtures。
- 产品运行时禁止返回内存 mock workspace/session/message 来假装流程成功。
- 未配置数据库时，应显示明确的配置错误或开发环境指引，而不是返回假成功。
- E2E 可以使用测试 fixture 或测试认证通道，但必须验证同一套 API、schema 和权限模型。

### 4.2 三端职责

依据 `bytedance_init_prd.md` 和现有 PRD：

- Web：主力端，承载完整 IM、Workspace、Agent、Artifact、预览和编辑体验。
- Desktop：本地能力端，承载本地文件访问、系统通知、Runtime/Agent 进程管理和身份桥接状态。
- Mobile/PWA：轻量端，承载查看对话、审批确认和产物预览。

三端可以不同布局，但不能形成三套产品逻辑。核心数据模型、状态名、错误语义、视觉 token 和对话体验必须一致。

---

## 5. 标准执行流程

### 5.1 需求进入

Codex 收到用户目标后先分类：

- 小范围修复：可直接走 Trellis/Codex inline，但仍必须按现有 spec 和测试门禁。
- 中大型链路：必须先创建或更新 `research/contracts/<TASK-ID>.md`。
- 用户明确问 Maestro/Ralph：Codex 先读本文件和 `research/maestro-guidance-playbook.md`，输出路由、prompt 或验收意见，不直接改代码。

Codex 只在产品方向不可推断时集中提问。普通技术选择、UI 细节和测试组织应由 Codex 根据合同、PRD、参考项目和现有代码自行判断。

### 5.1.1 已完成功能优先修复原则

项目推进默认遵守 **先稳定已完成功能，再开发新功能**：

1. 已标记完成的 P0/P1 功能一旦暴露真实用户链路问题，必须先登记为 regression / quality debt，不得把它当成零散聊天结论。
2. 若问题影响主链路可用性、点击语义、真实数据闭环、鉴权入口或消息/runtime 链路，优先级高于继续推进新的功能开发。
3. 新功能开始前，Codex 必须快速检查 `research/project-tracker.md` 中是否存在未关闭的主链路 regression；存在时必须先建议修复或明确说明为什么不阻塞。
4. Maestro/Ralph 完成一个功能后，不能只按计划向下推进；必须做一次“已交付功能可用性回归扫查”，覆盖真实入口、主要按钮、空状态、错误态、刷新持久化和 E2E 是否真的断言行为结果。
5. 用户发现的问题默认先作为验真样本：如果现有 verify/review 没能发现同类问题，必须补合同、测试和治理规则，再修代码。
6. 任何“完成”结论必须能回答：真实用户是否能从入口完成目标动作，而不仅是页面渲染、按钮存在或接口单测通过。

### 5.2 验真样本

用户已经发现的具体 bug 或失败链路，默认先作为 **流程验真样本**，不直接作为实现目标。

验真样本的用途是检验当前工作流能否通过合同、参考项目分析、代码审计和端到端测试自行发现问题。如果流程只能在用户明示 bug 后修复，说明流程仍不合格。

处理规则：

1. Codex 可以把样本私下用于设计验收合同和审查框架，但不要把根因或修复方向直接喂给 Maestro/Ralph。
2. Maestro/Ralph 的 analyze/verify prompt 应描述用户链路和完成标准，不应预置“登录会跳到 3000、5173 未登录”等答案。
3. 若执行系统自行发现同类问题，并给出证据、根因、影响面和修复计划，说明流程有效。
4. 若执行系统没有发现样本问题，Codex 必须判定流程门禁不足，先修合同、测试和验收规则，再考虑实现修复。
5. 验真样本通过后，样本本身才进入普通缺陷修复或重构任务。

示例：GitHub 登录链路目前是验真样本。后续不应直接给执行者“修登录跳转”，而应让 `Desktop 启动 -> GitHub 登录 -> Web callback -> Desktop/Web 状态一致 -> workspace 可用` 这条合同和 E2E 自己暴露问题。

### 5.3 合同阶段

Codex 负责：

1. 读取原始 PRD、`research/index.md` 和相关设计/技术文档。
2. 按 `research/contracts/TEMPLATE.md` 起草共享合同。
3. 只对不可推断的大方向集中询问用户。
4. 将合同登记到 `research/index.md` 和必要的 tracker/decision log。

### 5.4 参考项目阶段

参考项目必须在实现前进入流程，但只提炼规则：

- 信息架构
- 登录后落点
- workspace/session/chat 创建流程
- 空状态、错误态、加载态
- 对话主界面密度
- 三端职责差异
- 测试和验收方法

不得只复制视觉皮肤，不得提交 `refer_proj/*`。

### 5.5 Trellis 派生阶段

当 Codex/Trellis 执行代码任务时：

1. `.trellis/tasks/<task>/prd.md` 引用共享合同。
2. `implement.jsonl` 和 `check.jsonl` 引用共享合同、相关 research 和 spec。
3. 若合同暴露可复用工程规则，更新 `.trellis/spec/*`。
4. 实现前必须读取相关 spec；完成前必须运行质量检查。

### 5.6 Maestro 派生阶段

当 Maestro/Ralph 执行中大型任务时：

1. prompt 必须列出共享合同路径。
2. analyze/plan 不得重写合同，只能提出差异和 amendment。
3. execute 必须按合同拆 wave。
4. verify/review 必须按合同的用户链路和门禁检查。
5. 每个 wave 后更新 `research/project-tracker.md` 和 `research/execution-reports/*.md`。
6. 每个阶段都必须提交自己的公开产物。Analyze、plan、verify、review、test、governance 修复和 execute 只要修改了 `research/`、`.workflow/roadmap.md`、`.workflow/scratch/*/plan.json`、测试文件或代码，就必须精确 `git add` 本阶段相关文件并使用中文 commit。
7. 如果工作区已有无关 dirty 文件，Maestro/Ralph 必须在开始前记录 `git status --short` baseline；提交时只提交本阶段相关文件；完成输出必须列出提交后的剩余 dirty 项，并说明哪些是阶段前已有的无关改动。
8. 禁止用“没有代码改动”作为不提交 `research/project-tracker.md`、`research/execution-reports/*.md`、合同或 plan 的理由。
9. 禁止提交 `.workflow/.maestro/*/status.json`，也禁止只写 `status.json completed` 后结束。

### 5.7 验收阶段

完成不以单页、单接口、单截图为准，只以合同里的真实用户链路为准。

最低验收包含：

- 数据库 migration/seed/dev setup 可执行。
- 真实 API 和权限模型可用。
- 关键用户链路 E2E 覆盖，从真实入口开始。
- UI/UX 有布局断言、无横向滚动、无重叠、文本不溢出。
- 三端状态和语言一致。
- 执行报告、tracker、commit 和治理门禁齐全。

用户只做最后一次人工验收；若反馈问题，进入新的合同修订或新任务，而不是继续在旧任务里无边界补丁。

---

## 6. 新会话恢复规则

任何新 Codex 会话进入 AgentHub 时，应优先读取：

1. `AGENTS.md`
2. `research/index.md`
3. 本文件：`research/ai-workflow-control.md`
4. 当前任务对应的 `research/contracts/<TASK-ID>.md`
5. `research/project-tracker.md`
6. 若涉及 Maestro：`research/maestro-guidance-playbook.md` 和 `research/prompts/maestro-execution-governance.md`
7. 若涉及实现：相关 `.trellis/spec/*` 和 `.trellis/tasks/*`

如果用户只问解释性问题，不必启动任务；但回答必须遵守本文件的角色分工和完成口径。

---

## 7. 流程偏差处理

发现以下情况时，必须暂停宣称完成：

- E2E 只测页面可见，没有覆盖真实用户链路。
- 产品运行时使用 mock 主链路数据。
- 执行系统只能在用户明示具体 bug 后修复，不能通过合同和测试自行发现验真样本。
- Trellis task、Maestro plan 和 `research/` 合同不一致。
- Maestro `status.json` completed 但 tracker/report/测试证据不完整。
- 参考项目结论只停留在聊天，没有写入 research。
- UI 看似完成但三端交互、状态、文案、错误语义不一致。

处理顺序：

```text
回到共享合同 -> 补 research/report/tracker -> 更新 Trellis/Maestro 派生物 -> 再执行实现或验证
```
