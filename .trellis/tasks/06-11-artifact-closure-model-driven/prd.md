# 产物收口模型驱动选取

## Goal

让「最终产物」由**本次任务真实生成的内容 + 用户原始诉求**动态决定，而不是无条件把工作区初始化模板 `README.md` 当成最终产物。用户可能要求产出 1 个产物（一个 PPT / 一个指定 MD / 一个网页），也可能同时要求多个产物（如 PPT + 文档），收口必须能识别并登记全部真实产物。

## Failure Evidence（已用 fresh evidence 确证）

真实运行 workspace `666-f3d438ab`（plan `231ae059-8385-48c8-aebb-5d6b7ee185de`「生成字节跳动介绍ppt」，acceptance 库 `agenthub_acceptance`）：

| 文件 | 大小 | 真实身份 | 实际登记 |
|------|------|---------|---------|
| `字节跳动公司介绍.pptx` | 49358 B | **本次真实产物**（演示稿工程师节点 completed，PPT 确实生成） | ❌ 未登记，连 supporting 都不是 |
| `README.md` | 47 B（`# 测试666`） | 工作区初始化模板空壳 | ✅ 被登记为 `final_product_candidate` |

- 收口节点 result：`最终产物：README.md`、`supportingArtifactIds: []`。
- `.agenthub/delivery.json`：`source_path: README.md`、`generated_by: 产物助手`。
- 架构师汇总节点照抄了错误结论。

## Root Cause（已读代码确认，本次实际触发路径）

本次 666 收口走的是 **`apps/web/app/api/chat/route.ts` 的 `recommendDeliveredArtifact` 路径**（产出 `deliveredArtifactRecommendation` + 写 `delivery.json` `generated_by:产物助手`），**不是** `action-dispatcher.ts` 的 `persistArtifactClosure`（后者 result 结构是 `{systemArtifactClosure, artifactCount, artifacts}`，无 `deliveredArtifactRecommendation`）。判据：666 收口 result 含 `deliveredArtifactRecommendation` 字段。

三个叠加缺陷（均在 `chat/route.ts`）：

1. **README 硬优先**：`findDeliveredArtifactCandidates`（`route.ts:1348`）的 `renderableCandidates` 固定列表（`route.ts:1365`）把 `README.md` 排在动态发现的 `.pptx`（`route.ts:1380`）之前。
2. **无模板空壳过滤**：47 字节的初始化 README 被当作有效产物。
3. **只取 candidates[0] + 不结合用户诉求**：`recommendDeliveredArtifact`（`route.ts:1107`）`const candidate = candidates[0]`，真实 PPT 连 supporting 循环（`route.ts:1204`）都进不去；`ArtifactRecommendationInput`（`route.ts:83`）不含用户原始 prompt / plan 规划意图。

## Approach（路径 A：模型推荐 + 系统落库）

保持现有系统扫描出候选集的能力，但**最终 final/supporting 的判定结合用户原始诉求**，不硬推荐模板 README。不改 DAG 调度、不让 artifact_closure 起独立模型 job。

### 必做

1. **过滤模板空壳**：在候选生成阶段（`findDeliveredArtifactCandidates` / `workspaceFileCandidate`）识别并排除工作区初始化模板 README（如内容等于/接近 `# {workspaceName}\n\nAgentHub cloud workspace project.` 模板、或体积极小且无实质内容的占位文件）。判定要稳健——只过滤"未被本次任务改写的初始化占位"，不要误杀用户真实写的小 MD。

2. **真实产物优先于模板**：调整 `findDeliveredArtifactCandidates` 候选排序——本次真实生成/改写的交付物（`.pptx`/`.docx`/HTML 入口/用户指定 MD）优先于残留模板 README。去掉「README 无条件排在 pptx 之前」的硬编码。

3. **结合用户诉求选最终产物（不硬推荐）**：把用户原始诉求传入收口判定。最小实现是给 `ArtifactRecommendationInput`（`route.ts:83`）增加 `userOriginalPrompt?: string`（及必要的 plan 规划意图/前序节点摘要），在调用点（`route.ts:2507 / 2873 / 3127`）透传现有的 `userMessage`，用于：(a) 在多个候选间按用户诉求匹配选 final（如用户说"PPT"则 `.pptx` 为 final）；(b) 决定是否存在多个并列 final。复用现有 `handoffs`/`userMessage` 数据，勿新增链路。

4. **多产物全部登记（遵守 product-delivery 契约的 primary/supporting 语义）**：
   - **关键约束**（`.trellis/spec/cross-layer/real-flow-product-delivery.md` line 20-21、39）：收口**只能有一个 primary `final_product_candidate`**（launch/publish 入口，主来源 `.agenthub/delivery.json`）；多个 primary launch artifact 是**违规**（line 39 要求 fail）。PPT / 文档 / 图片等交付物用 `kind="supporting_product_artifact"` **单独登记**，出现在右侧产物列表与 IM 预览，但**不替换**也不并列成第二个 primary。
   - 因此用户要的「PPT + 文档两个产物」在 spec 语义下 = 选 1 个 primary（按用户诉求：若用户要 PPT，则 `.pptx` 为 primary final）+ 其余真实产物登记为 supporting。
   - bug 本质修复目标：(a) 模板空壳 README **不得**当 primary；(b) 真实 PPT/文档**必须**至少作为 supporting 被登记（当前连 supporting 都漏了，`route.ts:1204` 的 supporting 循环因 PPT 排在 README 之后、且只从 `candidates.slice(1)` 取而被吞）。避免真实产物完全漏登记。

5. **两条收口路径一致性**：`recommendDeliveredArtifact`（chat/route）与 `persistArtifactClosure`（action-dispatcher，`action-dispatcher.ts:196`）并存。本次只需保证**实际触发路径**（chat/route）修对；若改动涉及共享选取逻辑，注意 action-dispatcher 那条的 `artifactClosureCandidates`（已正确排除非 doc/ppt、有 deliverables/ 过滤）作为正确行为参照，避免两条路径再次发散。

### Out of Scope

- 不调高/调整任何超时；不碰 idle watchdog / keepalive（属已提交的 `06-11-runtime`）。
- 不让 artifact_closure 阶段起独立模型 runtime job（路径 B 不做）。
- 不重写 DAG 生成 / 编排调度（编排本身正常，PPT 确实被造出来了）。
- 不改 relay/subscribe 层。

## Verification

### 单元/集成测试（`apps/web/__tests__/`）
1. 在 `__tests__/api/chat.test.ts`（现有 final/supporting 落库用例 ~line 1220-1300）新增：
   - 工作区含「模板空壳 README（47B 占位）+ 真实 `.pptx`」时，**final 是 `.pptx` 而非 README**，README 不被登记为 final。
   - 用户诉求含「PPT」+ 工作区同时有 `.pptx` 和真实 `.docx` 时，按诉求选 `.pptx` 为 **primary final**，`.docx`（及其它真实产物）登记为 **supporting**——**不**产生第二个 primary（遵守 product-delivery 契约 line 39）。真实产物全部出现在 artifacts 表 / 右侧列表，无漏登记。
   - 反例：工作区只有用户真实写的 MD（非模板）时，该 MD 仍能正常被选为 final（不被空壳过滤误杀）。
2. 运行 `pnpm --filter @agenthub/web test`（至少 `__tests__/api` + `__tests__/orchestrator`），全绿、无 skip。
3. `mcp__ide__getDiagnostics` 检查改动文件类型错误。

### 端到端真实流程（决定性验证）
4. 确认 `agenthub_acceptance_postgres` / `agenthub_runtime_redis` 容器在跑。
5. 复跑「生成字节跳动介绍 PPT」编排，确认收口节点最终产物是 `.pptx`（真实产物）而非 README；若任务要求多产物，全部真实产物均登记，`delivery.json` / `artifacts` 表与右侧产物列表一致。
6. 若涉及真实 Codex CLI 与 UI 无法本地实跑，明确说明并以测试 + 库内 plan_nodes/artifacts 记录推演替代，不谎报通过。

## Notes

- 修复前提：`06-11-runtime`（idle 超时 + 审批续跑）已由 `b21a991 超时处理` 提交，工作树干净，本任务从干净起点开始。
- 参照规范：`.trellis/spec/backend/quality-guidelines.md`（测试不得 skip、根因修复）、`.trellis/spec/guides/cross-layer-thinking-guide.md`（两条收口路径跨层一致性）。
