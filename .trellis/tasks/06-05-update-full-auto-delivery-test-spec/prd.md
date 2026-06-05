# 更新全自动产物交付测试方法

## Goal

把用户明确的新验收标准沉淀到 Trellis code-spec：在后端链路可用的前提下，前端交付线也必须能在完整权限模式下从单句 prompt 自动跑到最终产物交付；同类功能必须使用同一种真实主链路测试方法，不能只看 assistant 文本、HTTP 200、后端状态或局部截图。

## Source of Truth

- `bytedance_init_prd.md`：最高产品事实源。
- `bytedance_init_video_txt.txt`：辅助产品事实源。
- `research/sequential-execution-progress.md`：单分支顺序执行、三端验收和 OpenCLI 优先规则。
- `.trellis/spec/cross-layer/real-flow-acceptance.md`：真实主链路验收规范。
- `.trellis/spec/backend/runtime-workspace-contract.md`：权限模式、runtime continuation 和 durable 状态契约。

## Requirements

- 规定“全自动完整权限交付”不是只验证后端；必须验证前端用户入口能看到执行进度、最终产物和完成状态。
- 对固定样本 `做一个加减乘除的简单网站，使用sqlite存储历史记录`，完整权限模式下应直接跑到产物交付或明确真实失败。
- UI 状态必须区分：
  - 正在思考/规划/读取文件/调用工具/写文件/测试：`思考中` 或 `执行中`
  - 等权限：`等待授权`
  - 拒绝：`已拒绝，等待下一次输入`
  - runtime 中断/失败：`执行失败` 或 `已中断`
  - 产物生成、测试通过、最终汇总完成：`已完成`
- “完成”必须来自 durable plan/action/runtime/artifact 状态，不得只来自 assistant 文本流。
- 前端一条线必须检查：
  - Orchestrator 首响与计划创建。
  - 前端工程师节点被派发并 completed。
  - 文件树/预览/Git 或变更面板能读回产物。
  - 生成页面可操作，SQLite/history 或对应核心功能真实可用。
  - Mobile/PWA 和 Desktop/Electron 或 fallback 读回同一 session 状态。
- 同类功能统一使用该测试方法：全自动权限、手动允许、拒绝、失败/中断、前端产物读回、三端状态一致。

## Acceptance Criteria

- [ ] `.trellis/spec/cross-layer/real-flow-acceptance.md` 增加一个 7-section code-spec 场景，覆盖全自动前端产物交付验收方法。
- [ ] 场景包含签名/状态源、契约、错误矩阵、Good/Base/Bad、测试要求和 Wrong vs Correct。
- [ ] `implement.jsonl` / `check.jsonl` 包含真实 spec/research context。
- [ ] Trellis task validate、JSON/JSONL parse、`git diff --check` 通过。
- [ ] 自动提交并归档任务。

## Out of Scope

- 本任务只更新测试方法/spec，不实现新的前端功能。
- 不重新跑完整 fixed-sample UAT。
