# 修正统一回归假阳性

## Goal

用户复核后指出上一轮 `UNIFIED-PRODUCT-LINE-REGRESSION-2026-06-05` 的 `pass` 结论不成立。需要按 `$trellis-break-loop` 对“验收假阳性”做根因分析，修正报告、tracker、顺序总表、验证脚本和 `.trellis/spec`，防止后续继续引用错误结论。

## User-Observed Failures

1. **缺乏真实开发过程**
   - UI 对话过程太少，没有可见的 Orchestrator/架构师回复、前端/后端工程师分配、逐步开发过程。
   - 没有伴随正常消息流的“思考中/执行中/读文件/编辑文件/测试/完成”等可见进度。
   - 没有可见的具体文件编辑请求或代码引用过程。

2. **权限控制不正常**
   - 基础/手动模式下，点击“允许本次操作”后，权限卡应进入“已允许/已批准/执行中/已完成”等状态，而不是仍停留在待确认。
   - 完全控制模式下，允许范围内不应出现手动权限请求卡。
   - 权限请求必须伴随正常消息流/执行状态出现，不能孤立地作为静态卡片。

3. **产物标记逻辑不成立**
   - 不能把所有文件都标记为产物。
   - 产物应由模型推荐并请求用户确认，或由用户指定。
   - 产物类型需要更明确：例如单 HTML/静态 bundle、文件夹 manifest、部署 bundle、Docker/package 等。

## Required Corrections

- 将上一轮统一回归 `pass` 结论降级为 `failed/invalidated`，明确不再作为当前产品能力通过证据。
- 更新 `apps/web/scripts/verify-unified-product-lines.ts`，使其能捕获上述假阳性：
  - A 线必须检查可见开发过程消息，而不仅是 plan nodes 和文件存在。
  - A 线必须检查 fixed sample 是从 full-control/auto prompt 产生，而不是历史工作区静态读回。
  - B 线必须检查手动 allow 后原权限卡状态变化；full-control 下不得出现需要人工点击的 allow/reject 卡。
  - C 线必须检查产物确认/推荐语义，不得只因 artifact row 或 workspace 文件存在而通过。
- 更新 `.trellis/spec/cross-layer/real-flow-acceptance.md`，把“统一回归脚本本身必须避免静态坐标假阳性”写成可执行合同。
- 更新 `research/project-tracker.md` 和 `research/sequential-execution-progress.md`，把当前状态改为 blocked/failed，并给出下一步真实修复任务方向。
- 记录 `$trellis-break-loop` 根因分析。

## Acceptance Criteria

- [x] `verify-unified-product-lines.ts` 在当前已知假阳性样本上返回失败，并列出用户指出的缺口。
- [x] 报告 `research/execution-reports/unified-product-line-regression-2026-06-05.md` 明确标记上一轮 pass 已撤销。
- [x] tracker / sequential ledger 不再声明统一回归完成。
- [x] `.trellis/spec/cross-layer/real-flow-acceptance.md` 包含防止同类假阳性的规则。
- [x] 运行 `pnpm --filter @agenthub/web exec tsx scripts/verify-unified-product-lines.ts`，预期失败并输出 A/B/C 失败原因。
- [x] 运行 `pnpm --filter @agenthub/web type-check`、`git diff --check`、Trellis validate。
- [ ] 自动提交、归档、记录 journal。

## Verification Result

- `pnpm --filter @agenthub/web exec tsx scripts/verify-unified-product-lines.ts`：预期失败，A/B/C failed，D pass。失败原因包括缺 fresh run marker、full-control 下仍有 pending manual permission card、产物缺推荐/确认语义。
- `pnpm --filter @agenthub/web type-check`：PASS。
- `python3 ./.trellis/scripts/task.py validate .trellis/tasks/06-05-fix-unified-regression-false-positive`：PASS。
- `git diff --check`：PASS。

## Out of Scope

- 本任务不修复完整产品链路实现本身。
- 本任务不重新实现 artifact packaging / Docker 发布。
- 本任务不处理 Demo 包和 3 分钟素材。
