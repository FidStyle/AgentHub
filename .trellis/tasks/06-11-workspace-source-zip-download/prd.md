# 工作区源码打包下载

## Goal

为工作区新增「下载源码」功能：把整个工作区打包成一个 zip 下载。打包时按 `.gitignore` 规则排除文件（如 `node_modules` 等大文件）；若是前后端项目且工作区根缺 `.gitignore`，打包前按需自动生成一份合理的 `.gitignore`（含 `node_modules`/`dist`/`build`/`.next` 等），再按其规则排除打包。

## Context（已读代码确认的现状）

- **单文件/单目录下载已有**：`apps/web/app/api/workspaces/[id]/files/download/route.ts`。目录下载已调 `createWorkspaceFolderZip` 返回 zip（`application/zip`）。
- **鉴权链可复用**：`requireAuth()`（`lib/auth-guard.ts`）→ `loadOwnedWorkspace(db,id,user)`（`lib/workspace/workspace-api.ts:22`，`owner_id` 校验）→ `loadCloudWorkspaceRoot`（要求 `execution_domain==='cloud'`）。路径安全 `resolveWorkspacePath`（`cloud-workspace-fs.ts:224`，拒绝 `\0` 与 `..` 越界）。
- **遍历排除是硬编码**：`IGNORED = {.git, node_modules, .next, dist, build}`（`cloud-workspace-fs.ts:28`），`buildWorkspaceFolderManifest`（:334）与 `readCloudWorkspaceTree`（:200）共用。**当前无任何 .gitignore 解析。**
- **ZIP 能力**：`createWorkspaceFolderZip`（:380）手写 ZIP store 模式（无压缩、全量进内存），按 manifest 文件列表打包。`crc32/u16/u32` helper 可复用。
- **git 已就绪**：每个 workspace 经 `ensureCloudWorkspaceProject` 跑过 `git init`；`runGit(rootDir, args)`（:411）是现成的 git 调用封装。
- **无 zip 第三方依赖**（yauzl 仅 playwright 传递依赖，不可用）。
- **前端文件树工具栏**：`FileTreeTab` 有「新建」「上传」按钮区（约 ChatPanel/文件树组件），可加「下载工作区」按钮。下载 URL 形如 `/api/workspaces/{id}/files/download?path=...`。

## Approach（已与用户确认的三项决策）

### 决策
1. **gitignore 排除 = `git ls-files`**：用 `git ls-files --cached --others --exclude-standard`（在 workspaceRoot 跑，复用 `runGit`）列出 git 视角下「应纳入版本控制 + 未被忽略的未跟踪」文件，天然按 `.gitignore` 排除，与用户自定义 .gitignore 完全一致、零新依赖。
2. **gitignore 打包时按需生成**：下载打包时，若工作区根无 `.gitignore` 且检测到前后端特征（存在 `package.json`，或常见后端标志），先生成一份默认 `.gitignore`（含 `node_modules/`、`dist/`、`build/`、`.next/`、`.env`、日志等），写入工作区根，再执行 `git ls-files` 打包。生成的 `.gitignore` 落到工作区里（用户后续也能看到/编辑）。
3. **范围=整工作区 + 文件树按钮入口**：新增打包整个工作区的能力 + 文件树工具栏「下载工作区」按钮。

### 必做
1. **新增 `createWorkspaceZip(rootDir)`**（`cloud-workspace-fs.ts`）：
   - 用 `runGit(rootDir, ['ls-files', '--cached', '--others', '--exclude-standard', '-z'])` 取文件列表（`-z` 用 NUL 分隔，稳健处理含空格/特殊字符/中文文件名）。
   - 对每个文件经 `resolveWorkspacePath` 校验后读入，复用现有 `crc32/u16/u32` + ZIP store 拼装逻辑产出 Buffer。
   - 边界：git 不可用或 `ls-files` 失败时，回退到现有硬编码 IGNORED 遍历（`buildWorkspaceFolderManifest(rootDir,'')` 思路），保证功能不因 git 异常完全失效；明确日志说明回退。
   - 跳过 `.git/` 自身（`ls-files` 默认不含，但回退路径要排除）。

2. **新增 `ensureWorkspaceGitignore(rootDir)`**（`cloud-workspace-fs.ts`）：
   - 若 `rootDir/.gitignore` 已存在 → 不动（尊重用户/模型已写的）。
   - 否则检测前后端特征（存在 `package.json` 即判为需要；可选检测后端标志如 `requirements.txt`/`pom.xml`/`go.mod`）→ 写入默认 `.gitignore`（`node_modules/`、`dist/`、`build/`、`.next/`、`out/`、`*.log`、`.env`、`.DS_Store` 等合理默认）。
   - 纯静态/无项目特征 → 可不生成（无大文件需排除）。
   - 返回是否生成、写了哪些规则，供日志/响应。

3. **新增下载路由**：`apps/web/app/api/workspaces/[id]/files/download-all/route.ts`：
   - 复用鉴权链：`requireAuth` → `loadOwnedWorkspace` → `loadCloudWorkspaceRoot`。
   - 调 `ensureWorkspaceGitignore(root)` → `createWorkspaceZip(root)`。
   - 返回 `application/zip` + `Content-Disposition: attachment; filename*=...`（文件名用工作区名/slug，非 ASCII 用 RFC 5987 `filename*=UTF-8''` 编码，对齐现有 download route 的非 ASCII 处理）。

4. **前端「下载工作区」按钮**：在文件树工具栏（`FileTreeTab` 的「新建」「上传」按钮区）加按钮，点击触发 `/api/workspaces/{id}/files/download-all` 下载。复用现有下载触发方式（a 标签/window.location）。

### Out of Scope
- 不引入 archiver 等第三方 zip 库（复用现有手写 store ZIP，源码排除大文件后体积可控）。
- 不做真压缩（store 模式即可；如需压缩另开任务）。
- 不覆盖用户/模型已写的 `.gitignore`。
- 不动产物收口、启动脚本、@菜单等其它任务范畴。
- 不在建工作区时生成 .gitignore（用户选了打包时按需生成）。

## Verification

### 单元/集成测试（`apps/web/__tests__/`）
1. `__tests__/workspace-files-artifacts.test.ts`（现有 zip 测试 ~line 124 验 ZIP 魔数 `504b0304`）新增：
   - `createWorkspaceZip`：工作区含 `index.html` + `node_modules/big.js` + `.gitignore`（含 `node_modules/`）→ zip 含 index.html、**不含** node_modules 下文件。验 ZIP 魔数与中央目录条目数。
   - 含中文/空格文件名 → 正确打包（`-z` NUL 分隔生效）。
   - git 不可用时回退遍历仍产出 zip（mock runGit 失败）。
   - `ensureWorkspaceGitignore`：无 .gitignore + 有 package.json → 生成含 `node_modules/` 的 .gitignore；已有 .gitignore → 不覆盖；无 package.json → 不生成。
2. `__tests__/api/workspace-files-download.test.ts`（现有 download route 测试）新增 download-all：
   - 正常下载返回 `application/zip` + 正确 Content-Disposition。
   - 鉴权：非 owner / 未登录 → 401/403（复用现有鉴权链断言）。
3. 运行 `pnpm --filter @agenthub/web test -- __tests__/api __tests__/workspace-files-artifacts`，全绿、无 skip。
4. `npx tsc --noEmit` / `mcp__ide__getDiagnostics` 检查改动文件。

### 端到端
5. 可起 dev server 时：工作区造一个含 node_modules 的前后端项目，点「下载工作区」，确认下载的 zip 不含 node_modules、含源码、`.gitignore` 已生成。不可实测则以测试 + zip 内容断言替代，如实说明。

## Security Notes
- 所有打包文件路径经 `resolveWorkspacePath` 校验防越界；`git ls-files` 输出的路径不可信，逐条校验。
- 鉴权必须走 owner 校验，禁止跨用户下载他人工作区。
- `runGit` 用 spawn 数组参数（非 shell 字符串拼接），无命令注入面；但仍确认不把不可信文件名拼进 shell。

## Notes
- 参照 `.trellis/spec/backend/runtime-workspace-contract.md`（工作区文件读写/路径安全）、`.trellis/spec/backend/quality-guidelines.md`。
