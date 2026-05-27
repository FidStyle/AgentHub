# GOV-GATE-001 执行报告

## 基本信息

| 字段 | 内容 |
|------|------|
| 任务 ID | GOV-GATE-001 |
| 日期 | 2026-05-27 |
| 类型 | 项目治理基础设施 |
| 执行方 | Codex |
| 目标 | 把 Maestro/Ralph 完成前治理规则从软 Spec 固化为可执行脚本门禁 |

## 变更范围

| 文件 | 说明 |
|------|------|
| `scripts/verify-governance-gate.sh` | 增强完成前治理门禁：检查干净工作区、公开跟进表、执行报告、中文 commit、禁止提交路径和最近 commit 文件清单 |
| `scripts/check-governance-gate.sh` | 兼容别名，转发到 `verify-governance-gate.sh`，避免旧 Prompt 或 Spec 调用失败 |
| `research/prompts/maestro-execution-governance.md` | 新增 Maestro/Ralph 执行治理 Prompt |
| `research/index.md` | 增加门禁脚本和治理 Prompt 索引 |
| `research/README.md` | 增加 scripts 目录说明和完成门禁规则 |
| `.workflow/specs/review-standards.md` | 统一脚本名称，明确 `check-governance-gate.sh` 只是兼容别名 |
| `.workflow/config.json` | 将治理 Prompt、gate 关键词接入 Maestro spec injection |
| `research/project-tracker.md` | 登记 GOV-GATE-001 跟进状态 |

## 验证记录

| 命令 | 结果 |
|------|------|
| `bash -n scripts/verify-governance-gate.sh` | 通过 |
| `bash -n scripts/check-governance-gate.sh` | 通过 |
| `maestro spec injection always --docs research/prompts/maestro-execution-governance.md --keywords gate,治理门禁,status.json --categories review,test` | 通过，治理 Prompt 已进入 always-inject |

## 门禁行为说明

当前工作区仍存在既有 UI/业务改动和未跟踪 E2E 文件。治理门禁脚本在这种状态下应当失败，因为它的职责是阻止 Maestro/Ralph 在公开账本和提交闭环不完整时标记完成。

该失败不是脚本错误，而是期望行为。后续每个 Maestro wave 完成后，必须先精确提交本 wave 相关文件，再运行：

```bash
bash scripts/verify-governance-gate.sh <TASK-ID>
```

只有 exit 0 才允许进入 verify/review/milestone-complete。

## 后续使用要求

1. 所有实现类任务的 Prompt 必须引用 `research/prompts/maestro-execution-governance.md`。
2. Maestro/Ralph 不得手动编辑 `.workflow/.maestro/*/status.json` 绕过门禁。
3. 门禁失败时必须输出 `CONCERNS`，并先补 `research/project-tracker.md`、`research/execution-reports/`、测试证据和中文 commit。
