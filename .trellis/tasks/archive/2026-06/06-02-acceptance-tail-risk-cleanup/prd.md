# 修复验收收尾旧入口与运行态口径

## 背景

`REG-20260601-002` 仍记录验收收尾风险：native session resume/continue 未完成、Web 旧入口和假绿风险需要继续扫描、真实浏览器 UAT 前不能保留会误导完成口径的入口。

本任务只修已确认的收尾风险，不扩展新产品能力。

## 范围

- 停用旧 `/api/runtime/invoke`，禁止返回“invoked”假成功。
- Web `/api/runtime/status` 区分“一次性本地执行可用”和“native session 暂不可恢复”，避免把一次性 CLI 当作可续接原生会话。
- 删除未挂载的旧 Web chat/sidebar/detail/store 语义文件，避免后续误接旧入口。
- 补最小测试，证明旧 runtime invoke 不再可用、runtime status 明确暴露 native session 限制。

## 验收

- 旧 runtime invoke POST 返回 410 和中文说明，不发送 DeviceChannel 请求，不创建随机 runtime session。
- Runtime status 响应包含 `nativeSessionAvailable: false` 和中文限制说明；本地 workspace 可用性仍由 Desktop + doctor 控制。
- 未挂载旧组件/store 文件被删除，当前 `workspace/*` 主入口不受影响。
- Web 相关单测通过。
