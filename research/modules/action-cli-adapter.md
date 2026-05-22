# 模块调研：Action/CLI Adapter、预览与权限确认

**日期：** 2026-05-21  
**状态：** Draft  
**覆盖 FR-ID：** `FR-ACTION-001`, `FR-PERM-001`, `FR-RESULT-001`, `FR-ARTIFACT-001`, `FR-DESK-001`, `FR-NOTIFY-001`  
**相关产品设计：** `research/product-design.md` 第 7、8、9 章

---

## 1. 调研问题

Action/CLI Adapter 是预览、构建、测试、未来部署的兼容层。P0 不做完整部署平台，但必须能证明本地预览和命令执行流程。

本模块需要回答：

1. Action 请求结构如何设计？
2. 权限确认如何绑定到 Action，而不是 Diff？
3. Local Desktop 和 Cloud Workspace 如何共用同一个 Action 模型？
4. 结果如何进入 Task Result Card？

---

## 2. Action 请求模型建议

```typescript
interface ActionRequest {
  id: string;
  workspaceId: string;
  sessionId: string;
  requestedByRoleAgentId?: string;
  requestedByOrchestrator: boolean;
  executionDomain: 'cloud' | 'local_desktop';
  kind: 'preview' | 'test' | 'build' | 'shell' | 'deploy';
  command?: string;
  args?: string[];
  workingDirectory: string;
  riskLevel: 'low' | 'medium' | 'high';
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'canceled';
}
```

P0 重点：

- `preview`: 启动 dev server 或返回 preview URL。
- `test/build/shell`: 作为受控命令执行。
- `deploy`: 只作为卡片和未来扩展，不做完整部署平台。

对应需求：`FR-ACTION-001`, `FR-PERM-001`。

---

## 3. 权限矩阵建议

| 动作 | 默认风险 | 是否确认 |
| --- | --- | --- |
| 读取 Workspace 内文件摘要 | low | 可按 Session 策略自动 |
| 启动本地预览 | medium | 默认确认 |
| 运行测试 | medium | 默认确认或 Session 自动推进 |
| Shell 命令 | high | 必须确认 |
| 删除/覆盖/批量修改 | high | 必须确认 |
| 部署/发布 | high | 必须确认 |
| 超长任务或高成本任务 | high | 必须确认 |

注意：Git diff 展示不是审批类型。审批对象是 Action、计划、下一步或权限升级。

对应需求：`FR-PERM-001`, `FR-NOTIFY-001`。

---

## 4. 执行位置

| Workspace 类型 | 执行者 | 约束 |
| --- | --- | --- |
| Cloud Workspace | Cloud Runtime / Cloud Executor | workingDirectory 必须在云端项目目录内 |
| Local Desktop Workspace | Desktop Connector | workingDirectory 必须在授权 workspace root 内 |

同一个 Action 模型跨两种执行域复用，区别只在 Executor。

---

## 5. 推荐路线

P0 推荐：

- 后端只创建和授权 ActionRequest。
- Executor 分为 Cloud Executor 和 Desktop Executor。
- Desktop Executor 通过 Node 子进程运行命令。
- 所有状态进入 Action 状态卡。
- 执行输出摘要进入 Task Result Card。
- Preview URL 作为 Artifact 或 Result 字段展示。

---

## 6. 参考项目校准

参考 `research/modules/reference-projects.md`：

- LobeHub `ShellCommandCtr` 将 shell command 执行封装在 Electron 主进程，并提供 run/get output/kill 能力。
- LobeHub `LocalFileCtr` 把本地文件读写、搜索、移动等能力集中在主进程 controller，而不是散落在 UI。
- Poco-Claw 将 tool execution、artifact、callback、session status 做成后端可测试对象，说明 Action 执行事件应持久化。

这些参考支持当前结论：AgentHub Action/CLI Adapter 应是结构化请求和事件模型，不应让前端直接拼命令或把执行状态只存在内存里。

---

## 7. 待用户确认

**推荐确认项：**

A. P0 只实现 preview/test/build/shell 的 Action 模型，deploy 仅保留状态卡兼容。  
B. P0 加入真实静态站部署。  
C. P0 只做 preview，不做 test/build/shell。

我的建议是 **A**。它能覆盖 Demo 和未来部署兼容层，不把 P0 做重。

---

## 8. 参考资料

- Node.js child_process 文档：https://nodejs.org/api/child_process.html
- Electron 官方文档：https://www.electronjs.org/docs/latest/
