# Playwright 与 OpenCLI 验收分工规范沉淀

## 背景

用户询问 Playwright 与 OpenCLI 分别适合什么场景，并要求用 `$trellis-update-spec` 将结论加入 spec。该结论影响后续 AgentHub Web/Mobile/Desktop 验收口径，必须沉淀为可执行的前端质量规则。

## 目标

- 在 `.trellis/spec/frontend/quality-guidelines.md` 中明确 Playwright 与 OpenCLI 的适用边界。
- 明确哪些场景 Playwright 足够，哪些场景必须 OpenCLI，哪些场景必须两者都跑。
- 保留当前 Bytedance 主链路验收原则：OpenCLI 真实 UAT 优先，Playwright 做确定性回归和布局断言。

## 验收标准

- spec 中能检索到 `Playwright vs OpenCLI` 或等价标题。
- 包含场景矩阵、禁止项、报告分类要求。
- `git diff --check` 通过。
