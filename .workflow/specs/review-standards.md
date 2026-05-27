---
title: "Review Standards"
readMode: required
priority: medium
category: review
keywords:
  - review
  - checklist
  - gate
  - approval
  - standard
---

# Review Standards

## Entries



<spec-entry category="review" keywords="governance,tracker,maestro,ralph,research" date="2026-05-26">

### 公开项目跟进与验收台账

所有 Maestro/Ralph 执行任务必须以 research/project-tracker.md 作为用户可见进度源。每完成一个 wave，必须同步更新 project-tracker.md 和 research/execution-reports/*.md。没有公开跟进记录，不允许标记任务完成。

</spec-entry>

<spec-entry category="review" keywords="ui,design,frontend,components,desktop,web,mobile" date="2026-05-26">

### UI 设计与组件契约

所有 UI 修改必须遵循 research/ui-design-system.md、research/product-design.md 和相关 UI 契约文档。三端视觉风格必须统一，全局中文。禁止无样式纯 HTML，禁止临时毛坯 UI，禁止把 Runtime API Key 配置暴露为主流程表单；Runtime 配置优先做检测、状态展示和引导。

</spec-entry>

<spec-entry category="review" keywords="governance,gate,status,complete,ralph,maestro" date="2026-05-27">

### 治理门禁硬规则

1. **治理门禁不可绕过** — 任何 milestone complete / session complete 前必须通过 `scripts/verify-governance-gate.sh <TASK-ID>`。
2. **Ralph completed 不等于项目完成** — status.json 仅为机器执行状态，不作为最终验收依据。
3. **完成前必须运行** `bash scripts/verify-governance-gate.sh <TASK-ID>` 并确认 exit 0。
4. **没有 research/project-tracker.md 和 execution-reports 证据，不允许 milestone complete**。
5. **每个 wave 验证通过后必须精确 git add + 中文 commit** — 禁止 `git add .`，禁止提交 refer_proj、缓存、临时日志。

</spec-entry>

<spec-entry category="review" keywords="maestro,codex,指导,验收,命令路由,playbook" date="2026-05-27">

### Codex 指导 Maestro 的验收契约

Codex 在本项目中承担技术甲方和验收裁判职责，Maestro/Ralph 承担执行职责。后续所有 Maestro 指导、命令选择、prompt 生成和完成验收必须遵循 `research/maestro-guidance-playbook.md`。当 Maestro 输出与 `research/project-tracker.md`、`research/execution-reports/`、git 提交或治理门禁不一致时，以 `research/` 总账和 `scripts/verify-governance-gate.sh <TASK-ID>` 为准，要求 Maestro 先补闭环，不进入新功能。

</spec-entry>

<spec-entry category="review" keywords="git,commit,wave,quality,verify" date="2026-05-26">

### Wave 级自动提交规则

每个功能 wave 只有在 lint/type/test/E2E 或对应验证通过，并且 research/project-tracker.md 与 execution-reports 已同步后，才能git add 并 git commit。commit message 必须中文，且只能提交本 wave 相关文件；不得提交 refer_proj/*、无关缓存、临时日志或未确认改动。

</spec-entry>


<spec-entry category="review" keywords="governance,tracker,execution-reports,commit,gate,ralph" date="2026-05-27">

### 公开治理门禁

任何 Maestro/Ralph session 不得仅凭 status.json completed 判定完成。完成前必须运行 `bash scripts/verify-governance-gate.sh <TASK-ID>`，并确认 research/project-tracker.md、research/execution-reports、测试证据和中文 commit 均已闭环；失败时必须输出 CONCERNS，禁止 milestone-complete。`scripts/check-governance-gate.sh` 仅作为兼容别名。

</spec-entry>

<spec-entry category="review" keywords="codex,prompt,maestro,ralph,overlay,amend,governance" date="2026-05-27">

### Codex 指导 Maestro 的升级策略

Codex 后续为用户生成 Maestro/Ralph prompt 时，必须遵循 `research/maestro-guidance-playbook.md` 的 Prompt 生成规则：先用当前任务 Prompt 明确约束，再依靠 Spec/always-inject 做长期记忆，以 `scripts/verify-governance-gate.sh <TASK-ID>` 作为硬门禁。只有当 Maestro/Ralph 仍反复漏跑门禁、门禁失败却 complete、手动改 `status.json` 或只写 `.workflow/scratch/` 时，才升级到 `/maestro-overlay` 或 `/maestro-amend --from-session <id> --scan`；不得优先直接修改 Maestro 本体执行逻辑。

</spec-entry>
