# AI 协作规范沉淀展示

本目录用于展示 AgentHub 开发过程中沉淀出来的 AI 协作规范。这里不是新的事实源，也不复制 `.trellis` 的全量内容；真实开发规则仍以仓库内的 `.trellis/`、`.agents/skills/`、`AGENTS.md` 和 `research/` 为准。

## 为什么使用 Trellis

AgentHub 的开发周期长、上下文多、跨 Web、Mobile、Desktop、Runtime、Orchestrator 和 Artifact 多条链路。单靠聊天记录让 AI 记住规则并不可靠，因此项目使用 Trellis 作为 AI 开发 harness。

Trellis 的作用不是替代产品文档，而是把任务、工程规范和跨会话记忆放进仓库，让 AI 在实现前读到正确上下文，并在任务结束后把新规则沉淀回规范。

来源：

- [Trellis GitHub](https://github.com/mindfold-ai/Trellis)
- [Trellis 中文文档](https://docs.trytrellis.app/zh)

## 协作分层

| 层级 | 位置 | 作用 |
| --- | --- | --- |
| 产品与项目事实 | `research/` | PRD、技术文档、执行报告、验收合同和项目总账 |
| 开发 harness | `.trellis/` | workflow、task、spec、workspace memory、context injection |
| 项目技能 | `.agents/skills/` | 可复用 AI 工作流入口，例如开发前读 spec、验收、更新 spec |
| 全局/项目规则 | `AGENTS.md` | 当前仓库内 AI 必须遵守的顶层协作规则 |
| 自动化测试 | `e2e/`、`apps/*/__tests__` | 用测试约束真实用户链路，避免只靠口头完成 |

## Spec、Skill、Rules、Test 的区别

| 类型 | 本项目中的含义 | 适合放什么 |
| --- | --- | --- |
| Spec | 长期有效、可执行的工程契约 | API/DB/Runtime/UI 约束、错误矩阵、测试断言、禁止模式 |
| Skill | 可复用的 AI 操作流程 | 开发前读规范、真实 UAT、spec 更新、复盘防回归 |
| Rules | 会话或仓库级硬规则 | 不改用户无关变更、不用 mock 假装主链路完成、先读事实源 |
| Test | 对功能是否真的成立的判据 | Playwright 无状态 E2E、OpenCLI 真实浏览器 UAT、单元/集成测试 |

## 核心方法：SDD + TDD

本项目的 AI 协作核心是 Spec Driven Development 和 Test Driven Development。

SDD 负责在实现前定义清楚：

- 需求来源和范围
- 三端职责
- 权限、产物、Runtime、Artifact 的边界
- 哪些行为必须写入长期 spec

TDD 负责在实现后验证清楚：

- 功能不是只在代码里存在
- 用户能从真实入口完成链路
- Web、Mobile、Desktop 的状态和语义一致
- AI 不能用 mock、历史报告或单点截图冒充完成

## 本项目沉淀出的关键协作规则

| 规则 | 说明 | 真实规范源 |
| --- | --- | --- |
| 先读事实源再实现 | Bytedance 原始材料、`research/` 合同和 `.trellis/spec` 优先于聊天记忆 | [`research/workflow/ai-workflow-control.md`](../research/workflow/ai-workflow-control.md) |
| 完成必须按真实链路判断 | 不能只看接口 200、页面可见或历史 pass | [`.trellis/spec/cross-layer/real-flow-acceptance.md`](../.trellis/spec/cross-layer/real-flow-acceptance.md) |
| Bytedance 验收必须逐步验证 | 声称 P0/P1 完成时要覆盖用户入口、状态读回、三端证据 | [`.trellis/spec/cross-layer/real-flow-bytedance-uat.md`](../.trellis/spec/cross-layer/real-flow-bytedance-uat.md) |
| IM 和产物是产品主链路 | Artifact、Diff、Preview、发布状态要进入聊天和右侧产物面板 | [`.trellis/spec/cross-layer/im-conversation-artifact-contract.md`](../.trellis/spec/cross-layer/im-conversation-artifact-contract.md) |
| Role Agent 不是 Runtime 名称 | 用户看到的是前端工程师、文档工程师等角色，不是 Claude Code/Codex 工具名 | [`.trellis/spec/cross-layer/role-agent-tools-contract.md`](../.trellis/spec/cross-layer/role-agent-tools-contract.md) |
| 本地 Runtime 凭证不托管 | Desktop 只检测和转发本地能力，不在云端保存本地 CLI 凭证 | [`.trellis/spec/cross-layer/runtime-credential-boundary.md`](../.trellis/spec/cross-layer/runtime-credential-boundary.md) |
| UI 必须三端一致 | Web、Mobile、Desktop 可以布局不同，但状态、文案、组件语义要一致 | [`.trellis/spec/frontend/ui-style-guidelines.md`](../.trellis/spec/frontend/ui-style-guidelines.md) |
| 发现 AI 忘规则就写回 spec | 聊天提醒不可靠，复发问题要固化到 `.trellis/spec` | [`.agents/skills/trellis-update-spec/SKILL.md`](../.agents/skills/trellis-update-spec/SKILL.md) |

## 常用 Skill

| Skill | 用途 |
| --- | --- |
| [trellis-before-dev](../.agents/skills/trellis-before-dev/SKILL.md) | 实现前读取相关 `.trellis/spec`，防止 AI 按记忆写代码 |
| [trellis-update-spec](../.agents/skills/trellis-update-spec/SKILL.md) | 调试、实现或讨论后，把可复用经验写回 spec |
| [trellis-check](../.agents/skills/trellis-check/SKILL.md) | 完成后按规范做质量检查 |
| [agenthub-opencli-uat](../.agents/skills/agenthub-opencli-uat/SKILL.md) | 用 OpenCLI 复用真实浏览器状态做 Web/Electron UAT |
| [bytedance-real-step-uat](../.agents/skills/bytedance-real-step-uat/SKILL.md) | 针对 Bytedance P0/P1 做真实用户视角验收 |
| [$grill-me](https://github.com/mattpocock/skills/blob/main/skills/productivity/grill-me/SKILL.md) | 让 AI 反向追问和拆解决策，避免需求没想清楚就实现 |

## Playwright 与 OpenCLI 的分工

| 工具 | 适用场景 | 本项目中的价值 |
| --- | --- | --- |
| Playwright | 无状态、可重复、CI 友好的自动化测试 | 断言页面、布局、行为、刷新读回和主流程回归 |
| OpenCLI | 复用真实浏览器、真实登录态、可视化操作 | 适合 GitHub 登录、真实浏览器 UAT、人工权限边界和截图证据 |

## 使用 Codex 的原因

本项目主要使用 Codex 做开发控制和实现协作。核心原因是可控性、稳定性和成本更符合这个项目的长周期开发方式。

在这个项目里，AI 不是只负责写代码，还要读取规范、执行测试、指出完成度问题、把经验写回 spec。Codex 的行为边界更容易控制，也更适合在 Trellis harness 下按步骤执行。相比之下，Claude Code 在实际体验里更容易出现代码跑不通或主动发散过强的问题，因此没有作为主控开发工具。

## 后续演进

当前项目已经形成了 spec 优先、真实测试验收、问题写回规范的基本闭环。后续可以继续沉淀一个更稳定的项目测试 skill，把标准权限、产物助手、PPT 预览、三端一致性、Desktop/Web 联调等高频验收流程固化下来。

这样 AI 协作就不只是“让 AI 写代码”，而是形成：

```text
需求澄清 -> Spec 沉淀 -> 实现 -> 测试验收 -> 复盘 -> 更新 Spec/Skill
```

的持续改进流程。
