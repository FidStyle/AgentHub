# 完成 P0 验收环境与报告收口

## 背景

用户要求完成 P0 收口，重点解决验收报告中仍开放的环境入口、E2E 并行污染表述、真实浏览器 UAT 证据和历史 P0 命名残留问题。当前代码已经修复 runtime 假入口、多角色、pin、通知审批等主要实现，但报告和环境脚本仍把统一验收环境称为 `p0`，并且本地 Web E2E 多 worker 风险没有明确的验收命令边界。

## 目标

- 将统一验收环境入口规范化为 acceptance 命名，优先使用 `docker/.acceptance.env`，保留旧 `docker/.p0-test.env` 读取兼容但不再作为主入口。
- 更新本地 seed、smoke、server、Playwright global setup 等真实 DB/API/session 验收脚本，避免用户必须理解历史 P0 文件名。
- 明确 Web E2E “共享测试用户污染”的含义：不是禁止 CLI 并行，而是数据库变更型验收测试不能共用一个 Auth.js 测试用户并多 worker 修改同一工作区状态。
- 提供串行 acceptance E2E 命令作为验收门禁；普通开发仍可跑并行 Playwright，但不能把共享 fixture 并行跑的结果作为 P0 主链路通过证据。
- 运行可复现测试，更新 `research/regression-ledger.md`、`research/project-tracker.md` 和执行报告，关闭或降级 P0 收口项。

## 范围

- 涉及文件：环境脚本、E2E setup/config、package scripts、docker 文档、Trellis 数据库规范、research ledger/tracker/report。
- 不在本任务内伪造 native session resume/continue。若官方 CLI 无可安全续接能力，报告必须明确为不可用/未验收，而不是写通过。
- 登录绑定 E2E 可以通过 opencli 人工点击形成证据；若环境不可用，报告必须写成未覆盖而非 passed。

## 完成标准

- `docker/.acceptance.env` 成为文档和脚本主入口；旧 `docker/.p0-test.env` 仅兼容读取/迁移提示。
- `pnpm env:acceptance:*` 命令覆盖 DB up/down、seed、fixture seed、smoke；旧 `env:p0:*` 作为别名保留。
- 有 `pnpm test:e2e:acceptance` 或等价命令固定串行 workers，避免共享 Auth.js 测试用户下的 DB 变更互相污染。
- 单元/类型/build/环境 smoke 至少按实际可用环境运行并记录 exit code；无法运行的 Docker/opencli/登录绑定必须写明阻塞原因。
- P0 report/ledger/tracker 不再把跳过、mock、旧入口或未验真项计入完成。
