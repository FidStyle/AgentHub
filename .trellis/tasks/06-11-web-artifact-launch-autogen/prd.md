# 网页产物启动脚本兜底与静态/动态预览

## Goal

网页类产物完成后：
1. `.agenthub/start.sh` 由**系统在收口阶段兜底自动创建**，不再完全依赖模型按 prompt 手写。
2. 预览形式按**静态/动态**区分，统一为 **IP+端口** 形式：
   - **动态网页**（有 `package.json` 且含 `start`/`dev`/`preview`/`serve` 脚本）→ 启动真实服务，预览 `127.0.0.1:PORT`。
   - **纯静态网页**（无可运行 package 脚本，单纯 HTML）→ 不需要用户写启动命令，系统起一个 `http-server` 端口指向 `index.html`，统一也走 `127.0.0.1:PORT`。

## Problem Evidence（用户报告 + 已读代码确认）

用户完成简单网页后看到「启动命令必须指向 .agenthub 内的脚本」（来自 `cloud-workspace-fs.ts:573` `scriptPathFromStartCommand` 抛错），且静态网页未自动获得可预览入口。

## Root Cause（已读代码确认）

1. **静态 HTML 被挡在自动发布外**：`apps/web/app/api/chat/route.ts:1221`
   ```
   if (input.autoPublish && candidateHasStartInstruction(candidate))
   ```
   `candidateHasStartInstruction`（`route.ts:835`）要求 metadata 有 `startCommand` 或 `packageScript`。纯静态 HTML（无 package.json）经 `attachRunnableLaunch`（`route.ts:839`，`!runnable` 时跳过）后两者皆无 → 静态 HTML 永远不自动发布、不起端口、无 start.sh。

2. **无系统兜底生成 `.agenthub/start.sh`**：当前 start.sh 仅靠模型按 prompt（`config/orchestration/prompts.ts:22-36`）手写。系统侧 `createWorkspaceArtifactLaunchScript`（`cloud-workspace-fs.ts:615`）生成的是 `run-artifact-{id}.sh`（非标准 `start.sh`），且仅在手动 publish 时触发。

3. **能力已存在但未串联**：`createWorkspaceArtifactLaunchScript` 生成的脚本内部**已具备**静态/动态兜底（`cloud-workspace-fs.ts:663-689`：优先 agent start.sh → npm 脚本 → `http-server` 起静态端口）。缺的是「收口阶段对网页产物自动生成标准 start.sh 并纳入静态产物的端口发布」。

## Approach（系统收口阶段兜底生成，已与用户确认）

### 决策（已确认）
- **静态/动态判定**：`detectWorkspaceRunnablePackage`（`cloud-workspace-fs.ts:596`）有 package.json 且含 `start/dev/preview/serve` = 动态；否则（含纯 HTML）= 静态。复用现有函数，不额外分析 HTML 引用的库。
- **start.sh 创建**：收口阶段系统检测到网页类产物（HTML 入口 或 runnable package）但缺 `.agenthub/start.sh` 时，系统**自动生成标准 `.agenthub/start.sh`**。
- **统一端口预览**：动态 → 服务端口；静态 → `http-server` 指向 index.html 的端口。

### 必做
1. **新增系统兜底生成 `.agenthub/start.sh`**：在 `cloud-workspace-fs.ts` 新增（或扩展）一个函数，针对网页产物生成标准 `.agenthub/start.sh`：
   - 动态（`detectWorkspaceRunnablePackage` 命中）：脚本用 `PORT="${PORT:-3000}"` 跑 `npm install`（缺 node_modules 时）+ `npm run <script> -- --host 127.0.0.1 --port "$PORT"`。
   - 静态（无 runnable package、存在 HTML 入口）：脚本用 `PORT="${PORT:-3000}"` 跑 `npx --yes http-server <htmlDir> -a 127.0.0.1 -p "$PORT"`。
   - 复用 `cloud-workspace-fs.ts:651-691` 现有脚本模板逻辑与 `shellSingleQuote`/`PORT` 约定，避免重复造轮子；产物为标准 `.agenthub/start.sh`（满足 `scriptPathFromStartCommand` 的 `bash .agenthub/*.sh` 格式）。
   - **不覆盖模型已写的 start.sh**：若 `.agenthub/start.sh` 已存在则不动（模型主导优先，系统仅兜底缺失场景）。

2. **收口流程串联**：在 `recommendDeliveredArtifact`（`route.ts:1104`）选定 primary 为网页类产物（HTML 入口 / runnable package）后，若缺 start.sh 则调用上述兜底生成，并把 `startCommand: 'bash .agenthub/start.sh'` 写入 candidate.metadata，使：
   - `candidateHasStartInstruction(candidate)` 变 true → 静态 HTML 也进入 `route.ts:1221` 自动发布分支。
   - `writeDeliveryManifest`（`route.ts:1213`）的 `start_command` 字段正确指向 start.sh。

3. **静态产物纳入端口发布**：确认 `startArtifactPublish`（`route.ts:1240` 调用）对静态产物经由生成的 start.sh 起 `http-server` 端口，返回 `127.0.0.1:PORT`。若 `startArtifactPublish` 内部仍走 `createWorkspaceArtifactLaunchScript` 的 `run-artifact-*.sh`，确保它能正确引用新生成的 `.agenthub/start.sh`（`cloud-workspace-fs.ts:627-632` 的 agentLaunch 分支）。

4. **两条收口路径**：本次主路径是 chat/route 的 `recommendDeliveredArtifact`。`action-dispatcher.ts` 的 `persistArtifactClosure` 若也需网页产物兜底，注意一致性（但 action-dispatcher 当前只收 doc/ppt，不收 HTML，**确认其是否需同步**——若 HTML 产物只走 chat/route 路径则本任务不动 action-dispatcher）。

### Out of Scope
- 不分析 HTML 内 `<script src>`/import 来判库（用户确认按 package.json 脚本判定）。
- 不覆盖/改写模型已写的 start.sh。
- 不碰超时/idle/relay/DAG/@菜单（其它任务）。
- 不改产物收口的 primary/supporting 选取逻辑（已在 `78bd244` 完成）。

## Verification

### 单元/集成测试（`apps/web/__tests__/`）
1. `__tests__/workspace-files-artifacts.test.ts`（现有 launch script 测试 ~line 135）新增：
   - **静态 HTML 兜底**：workspace 仅有 `index.html`、无 package.json → 系统生成 `.agenthub/start.sh`，内容含 `http-server` + `PORT` + 指向 html 目录；`scriptPathFromStartCommand('bash .agenthub/start.sh')` 不抛错。
   - **动态网页兜底**：workspace 有 `package.json`（含 `dev` 脚本）无 start.sh → 生成的 `.agenthub/start.sh` 含 `npm run dev -- --host 127.0.0.1 --port`。
   - **不覆盖已有 start.sh**：`.agenthub/start.sh` 已存在 → 兜底不修改其内容。
2. `__tests__/api/chat.test.ts`（现有 delivery 测试 ~line 1595）新增：
   - 纯静态 HTML 产物 + `permissionMode='full_control'` → final candidate 的 metadata 有 `startCommand='bash .agenthub/start.sh'`，进入自动发布，publishResult 返回 `127.0.0.1:PORT`。
3. 运行 `pnpm --filter @agenthub/web test -- __tests__/api __tests__/workspace-files-artifacts __tests__/orchestrator`，全绿、无 skip。
4. `npx tsc --noEmit` / `mcp__ide__getDiagnostics` 检查改动文件类型。

### 端到端真实流程
5. 容器在跑时，复跑一个「做一个简单网页」编排，确认：静态网页收口后 `.agenthub/start.sh` 自动生成、预览为 `127.0.0.1:PORT` 指向 index.html；动态网页起真实服务端口。
6. 真实 Codex/UI 无法本地实跑时如实说明，以测试 + 脚本内容断言替代，不谎报通过。

## Notes
- 参照契约：`.trellis/spec/cross-layer/real-flow-product-delivery.md`（line 20/22/36/37：delivery.json+start.sh 为主来源、PORT 约定、静态入口 fallback、无静态入口但有 package 脚本的处理）。
- 前置：`78bd244`（产物收口 primary/supporting 选取）已提交，本任务在其基础上扩展网页产物的启动入口。
