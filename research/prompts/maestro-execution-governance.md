# Maestro/Ralph 执行治理门禁 Prompt

> 用途：每次让 Maestro/Ralph 执行实现类任务、wave、verify、review 或 milestone complete 前，把本 Prompt 放入执行指令。它是 `research/` 公开治理体系的执行模板。

---

## 必读文件

开始前必须读取：

1. `research/index.md`
2. `research/project-tracker.md`
3. `research/decision-log.md`
4. `research/prd.md`
5. `research/technical-design.md`
6. `.workflow/specs/review-standards.md`
7. `.workflow/specs/test-conventions.md`

涉及 UI 时额外读取：

1. `research/ui-design-system.md`
2. `research/product-design.md`
3. `research/desktop-p0-ui-ux-contract.md`

---

## 完成定义

不得以 `.workflow/.maestro/*/status.json` 的 `completed` 作为项目完成依据。任何 wave、session 或 milestone 完成前，必须同时满足：

1. `research/project-tracker.md` 已同步任务状态、测试证据、阻塞问题和下一步动作。
2. `research/execution-reports/` 已补齐本 wave 或本任务的执行报告。
3. lint/type/test/E2E 或本任务声明的验证命令已经真实运行，并把命令与结果写入执行报告。
4. `git status --short` 无未提交或未跟踪文件。
5. 最近一次 commit 使用中文 message，且只包含本 wave 相关文件。
6. 最近一次 commit 不包含 `refer_proj/*`、缓存、临时日志或 `.workflow/.maestro/*/status.json`。
7. 已运行 `bash scripts/verify-governance-gate.sh <TASK-ID>`，并且 exit 0。

---

## 禁止行为

1. 禁止手动编辑 `status.json` 绕过 active step、decision gate 或 complete gate。
2. 禁止在治理门禁失败时执行 `milestone-complete`、`session complete` 或把任务标记为完成。
3. 禁止使用 `git add .`。
4. 禁止提交 `refer_proj/*`、`node_modules/`、构建产物、缓存、临时日志或未确认改动。
5. 禁止只写 `.workflow/scratch/` 内部记录而不更新 `research/` 公开总账。

---

## 每个 Wave 的固定动作

完成一个 wave 后，按顺序执行：

1. 更新 `research/project-tracker.md` 对应任务条目。
2. 新增或更新 `research/execution-reports/<task-or-wave>-report.md`。
3. 运行本 wave 的验证命令，并把命令、结果、失败项和截图路径写入报告。
4. 精确 `git add` 本 wave 相关文件。
5. 使用中文 commit message 提交。
6. 运行 `bash scripts/verify-governance-gate.sh <TASK-ID>`。
7. 只有脚本 exit 0，才允许进入 verify/review/milestone-complete。

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
