# 修复 Codex 登录状态误判

## Goal

修复 Desktop Runtime 检测中 Codex 已安装、已登录但 UI 仍显示“需运行 codex login 后重新检测”的误判。

## Facts

- 用户本机 `command -v codex` 返回 `/Users/joytion/.nvm/versions/node/v24.15.0/bin/codex`。
- 用户本机 `codex --version` 返回 `codex-cli 0.135.0`。
- 用户本机 `codex login status` 返回 `Logged in using an API key - ...`。
- 用户本机 `codex doctor --json` 中 `auth.credentials.status` 为 `ok`，`network.provider_reachability.status` 也为 `ok`。

## Requirements

- Codex 检测不能只因为 `codex login status` 执行细节异常就判定未登录。
- 如果 `codex login status` 输出无法稳定解析，必须用 `codex doctor --json` 的 `auth.credentials.status === "ok"` 兜底。
- `codex doctor --json` 的 `overallStatus=warning` 不应阻塞认证通过；warning 只进入诊断文案。
- Codex 一次性消息发送不能无限停留在“发送中”；必须使用明确 non-interactive 参数，并设置超时后返回中文错误。
- 增加单测覆盖 `Logged in using an API key` 和 doctor auth fallback。

## Acceptance Criteria

- [ ] `Logged in using an API key - ...` 被判定为 authenticated。
- [ ] `doctor.checks.auth.credentials.status=ok` 可兜底判定 authenticated。
- [ ] Codex 本地一次性发送命令包含 `--skip-git-repo-check`、`--sandbox read-only`、`--color never` 和 `--`。
- [ ] Codex 长时间无响应时不会让 UI 永久停留在“发送中”。
- [ ] Desktop 测试、type-check、build 通过。
