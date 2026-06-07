# 跨层实现规范

> 面向跨 Web、Desktop、Backend、Shared 类型的实现契约。

---

## 规范索引

| 规范 | 说明 | 状态 |
| --- | --- | --- |
| [本地 Runtime 凭证边界](./runtime-credential-boundary.md) | 本地 Claude Code / Codex 的检测、绑定、认证诊断和密钥禁止托管规则 | 生效 |
| [Cloud Runtime Gateway 契约](./runtime-gateway-contract.md) | Cloud Runtime Gateway 必需实体、runtime endpoint、DB/API/事件和错误语义 | 生效 |
| [自建基础设施策略](./self-hosted-infra-policy.md) | 禁止包装型托管平台依赖，优先官方镜像/开源实现自部署 | 生效 |
| [并行 Worktree 测试端口规范](./parallel-worktree-testing.md) | 多 worktree 并行运行 dev server、E2E、OpenCLI 或预览服务时必须显式指定唯一端口 | 生效 |
| [真实主链路验收规范](./real-flow-acceptance.md) | 本地/远端对话、@角色、附件和 artifact 的真实通过口径与禁止假绿规则 | 生效 |
| [PRD 反查实现审计规范](./prd-backtrace-audit.md) | 从 PRD 反推代码实现，发现必做未落实和不该保留的假入口/残留组件 | 生效 |
| [IM 联系人和产物契约](./im-conversation-artifact-contract.md) | 联系人/群聊、Role Agent 工具集、富媒体消息卡、PPT 生成和 Diff 应用审批契约 | 生效 |
