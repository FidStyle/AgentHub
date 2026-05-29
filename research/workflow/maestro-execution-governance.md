# Maestro/Ralph 执行治理门禁 Prompt

> 用途：每次让 Maestro/Ralph 执行实现类任务、wave、verify、review 或 milestone complete 前，把本 Prompt 放入执行指令。它是 `research/` 公开治理体系的执行模板。

---

## 必读文件

开始前必须读取：

1. `research/workflow/ai-workflow-control.md`
2. `research/index.md`
3. `research/project-tracker.md`
4. `research/decision-log.md`
5. `research/prd.md`
6. `research/architecture/technical-design.md`
7. `.workflow/specs/review-standards.md`
8. `.workflow/specs/test-conventions.md`

中大型任务必须额外读取：

1. `research/contracts/<TASK-ID>.md`
2. `.trellis/spec/guides/end-to-end-contract-planning.md`

涉及 UI 时额外读取：

1. `research/product/ui-design-system.md`
2. `research/product/product-design.md`
3. `research/product/desktop-p0-ui-ux-contract.md`

---

## 完成定义

不得以 `.workflow/.maestro/*/status.json` 的 `completed` 作为项目完成依据。任何 wave、session 或 milestone 完成前，必须同时满足：

1. 对应 `research/contracts/<TASK-ID>.md` 的用户链路、数据合同、UI/UX 合同和测试合同已逐项满足。
2. `research/project-tracker.md` 已同步任务状态、测试证据、阻塞问题和下一步动作。
3. `research/execution-reports/` 已补齐本任务的阶段级执行报告；wave 级细节优先追加到同一报告或 `.workflow/` 产物，不得默认新建碎片 report。
4. lint/type/test/E2E 或本任务声明的验证命令已经真实运行，并把命令与结果写入对应任务报告、tracker 或 ledger。
5. `git status --short` 无未提交或未跟踪文件。
6. 最近一次 commit 使用中文 message，且只包含本 wave 相关文件。
7. 最近一次 commit 不包含 `refer_proj/*`、缓存、临时日志或 `.workflow/.maestro/*/status.json`。
8. 已运行 `bash scripts/verify-governance-gate.sh <TASK-ID>`，并且 exit 0。

---

## Plan 阶段硬门禁

任何 `maestro-plan`、修复计划、wave 计划或 task decomposition 在 execute 前必须通过 plan anti-pattern review。

必须拒绝或 revise 的计划：

1. 用 `playwright test --list`、文件存在、grep-only、类型检查作为主链路通过证据。
2. 用 `page.route`、`vi.mock`、mock auth、fixture-only 或内存数据证明真实 DB/API/session 主链路。
3. 用 placeholder/hardcoded Runtime 或 `/api/chat` 响应冒充 Agent 成功。
4. 假设 Electron renderer 能读取外部浏览器 OAuth cookie，而没有一次性 device binding token/code、deep link token 或 main-process session bridge。
5. local_desktop Runtime 不可用时返回成功聊天内容，而不是 `DEVICE_OFFLINE` 或等价错误。
6. 把 `status.json completed`、`DONE_WITH_CONCERNS`、`verification.passed=false`、`NO-GO` 当作产品完成。

Plan 报告必须包含：

- `PLAN_ANTI_PATTERN_REVIEW: PASS`
- 已检查 `.trellis/spec/guides/end-to-end-contract-planning.md`
- 每个 task 的行为级 DoD
- 每个 test task 的真实运行命令
- 每个 auth/db/runtime task 的边界说明

---

## 禁止行为

1. 禁止手动编辑 `status.json` 绕过 active step、decision gate 或 complete gate。
2. 禁止在治理门禁失败时执行 `milestone-complete`、`session complete` 或把任务标记为完成。
3. 禁止使用 `git add .`。
4. 禁止提交 `refer_proj/*`、`node_modules/`、构建产物、缓存、临时日志或未确认改动。
5. 禁止只写 `.workflow/scratch/` 内部记录而不更新 `research/` 公开总账。
6. 禁止在产品运行时使用 mock 主链路数据假装完成真实数据库/API/权限流程。
7. 禁止未经 plan anti-pattern review 就进入 execute。
8. 禁止让后台 shell、delegate、watcher、dev server 或 test runner 无时间预算地长期阻塞会话。

## 后台执行时间预算

执行后台 shell、delegate、长轮询测试或 watcher 时必须遵守：

1. 启动前说明预期用途和大致时间预算；常规 review/decision delegate 超过 3-5 分钟无实质输出时必须主动检查。
2. 超时后不得继续空等；必须查看进程/日志/当前 step 状态，并选择继续、降级为本地判定、终止相关进程，或输出 BLOCKED。
3. 如果清理进程，只能清理本 step 启动或明确相关的残留进程；不要误杀用户无关服务。
4. Review/verify 已有足够代码和测试证据时，可以停止等待 delegate，直接本地写入 `review.json`、`verification.json` 或执行报告。
5. 完成输出必须列出是否还有残留后台进程；若存在，说明归属和处理理由。

---

## 每个 Wave 的固定动作

完成一个 wave 后，按顺序执行。这里的 wave 包括 analyze、plan、verify、review、test、governance 修复和 execute；只要产生或修改了 `research/`、`.workflow/roadmap.md`、`.workflow/scratch/*/plan.json`、测试文件、代码或报告，就必须进入提交流程。

1. 更新 `research/project-tracker.md` 对应任务条目，或在该 wave 不改变公开状态时说明无需更新。
2. 更新对应任务的一份阶段级 execution report；禁止为每个 wave 默认新建 `<task-or-wave>-report.md`。
3. bug、regression、未完成项和不完善项写入 `research/regression-ledger.md`；不要为单个问题创建独立 report。
4. 运行本 wave 的验证命令，并把命令、结果、失败项和截图路径写入对应任务报告、tracker 或 ledger。
5. 运行 `git status --short`，区分本 wave 改动和既有无关改动。
6. 精确 `git add` 本 wave 相关文件，禁止 `git add .`。
7. 使用中文 commit message 提交。
8. 再次运行 `git status --short`。
9. 如果仍有无关既有改动，必须在完成输出中列出并说明“非本 wave 产生，未提交”；如果存在本 wave 未提交改动，必须停止并输出 BLOCKED。
10. 运行 `bash scripts/verify-governance-gate.sh <TASK-ID>`。
11. 只有脚本 exit 0，才允许进入 verify/review/milestone-complete。

### Artifact-only 阶段提交规则

Analyze、plan、verify、review 等非代码阶段也必须提交自己的公开产物：

- `research/project-tracker.md`
- 对应任务的一份 `research/execution-reports/*.md`，或明确追加到已有 report / ledger / tracker
- `research/contracts/*.md`
- `research/decision-log.md`
- 必要的 `.workflow/roadmap.md` 或 `.workflow/scratch/*/plan.json`

如果阶段只产生 `.workflow/.maestro/*/status.json`，不得提交该文件，也不得把该状态当完成证据。

完成输出必须包含：

```text
COMMIT: <hash> <中文 commit message>
GIT_STATUS_AFTER_COMMIT:
<git status --short 输出；如果非空，逐项说明是否为既有无关改动>
```

---

## 失败输出格式

如果门禁失败，必须停止并输出：

```text
--- COMPLETION STATUS ---
STATUS: BLOCKED
CONCERNS:
- <失败项 1>
- <失败项 2>
NEXT:
- <需要补的文件或命令>
--- END STATUS ---
```

---

## 成功输出格式

如果门禁通过，必须输出：

```text
--- COMPLETION STATUS ---
STATUS: DONE
GOVERNANCE_GATE: PASS
TASK_ID: <TASK-ID>
COMMIT: <最近 commit hash 与中文 message>
EVIDENCE:
- <验证命令与结果>
- <execution report 路径>
--- END STATUS ---
```
