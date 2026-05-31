# 共享任务合同目录

本目录存放 AgentHub 中大型任务的共享合同。共享合同是 Trellis 和 Maestro/Ralph 的唯一协作接口。

## 使用规则

1. 中大型产品链路、三端 UI、认证/数据库、E2E 或架构任务必须先创建合同。
2. 合同文件命名为 `<TASK-ID>.md`，例如 `AUTH-WORKSPACE-P0.md`。
3. Trellis task、Maestro prompt、execution report 和 Codex 验收都必须引用同一份合同。
4. 合同不得只描述页面或接口，必须描述真实用户链路。
5. 产品运行时禁止用 mock 主链路数据满足合同；测试 fixture、seed、测试账号可以使用。

模板见 [TEMPLATE.md](./TEMPLATE.md)。

## 当前合同

| 合同 | 说明 |
| --- | --- |
| [THREE-SURFACE-WORKBENCH-PERMISSION-001.md](./THREE-SURFACE-WORKBENCH-PERMISSION-001.md) | 三端会话工作台与权限模型统一：Web 完整工作台、Desktop Host/策略/执行日志、Mobile 远程监督控制、Run/Context/Changes/Artifacts 双向关联 |
