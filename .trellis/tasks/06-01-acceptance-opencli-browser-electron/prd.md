# 验收真实闭环 1：opencli 浏览器与 Electron 验真 skill

## Goal

把 `$write-help-doc` 的 opencli 浏览器控制经验项目化，形成 AgentHub Web/Electron UAT skill，并用它验证登录态复用、GitHub 人机边界、Electron 启动路径和截图证据。

## Requirements

- 使用 `.agents/skills/agenthub-opencli-uat/SKILL.md` 作为项目内测试约束。
- Web 优先复用 opencli browser session/profile；登录/授权/2FA 时停下让用户处理。
- Electron 自动化说明 `DESKTOP_APP_PATH`：它是 Playwright/Electron 启动目标路径，不是产品功能。
- Web/PWA 可用浏览器视口测试；原生 RN 模拟器不作为本轮 Codex 自动化阻塞项。

## Acceptance Criteria

- [x] opencli skill 可被后续任务直接引用。
- [x] 产出一条 Web 登录态复用 smoke 流程。
- [x] 产出一条 Electron 启动/截图 smoke 流程或明确构建路径缺失。
- [x] 敏感登录边界不被自动化绕过。

## Verification Notes

- 项目内 skill 已建立：`.agents/skills/agenthub-opencli-uat/SKILL.md`。
- `opencli doctor` PASS：Daemon OK，Extension connected，Connectivity OK；仅有 CLI/extension update 提示。
- Web/opencli 证据：`e2e/artifacts/opencli-uat/web-opencli-home.png`、`e2e/artifacts/opencli-uat/web-workspace-after-local-flow.png`。
- Electron 自动化说明和 fallback 已写入 skill；实际 Electron 验收采用 Playwright Electron，`npx playwright test --config e2e/playwright.desktop.config.ts --workers=1` 通过。
- 登录/授权/敏感边界规则记录在 skill 中，未绕过 GitHub/OAuth/2FA。

## References

- `research/contracts/ACCEPTANCE-REAL-FLOW-2026-06-01.md`
- `.agents/skills/agenthub-opencli-uat/SKILL.md`
- `/Users/joytion/.codex/skills/write-help-doc/SKILL.md`
