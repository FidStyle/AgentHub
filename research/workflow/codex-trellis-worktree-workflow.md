# Codex + Trellis + Git Worktree 高效开发操作流

目标：在不牺牲合同、测试、Trellis 规范和主分支干净状态的前提下，并行推进多个 AgentHub 大功能。

## 0. 总规则

* 主 worktree 必须保持干净。
* 每条功能线一个独立 worktree。
* 每个活跃 worktree 一个 Codex 会话。
* 没有 Trellis 任务，不做生产实现。
* 没有测试、报告、提交和 clean 状态，不合并主分支。
* 数据库 schema、共享合同、部署/Caddy、Orchestrator 模型、主干合并必须加锁。

## 1. 从干净主分支开始

```bash
cd /Users/joytion/Documents/code/AgentHub_new_claude_test
git status --short
git branch --show-current
git pull --ff-only
git status --short
```

期望：

```text
git status 无输出
当前分支是 main
```

如果不干净：

```bash
git status --short
git diff --name-only
```

先处理干净，再创建 worktree。

## 2. 创建 worktree 根目录

```bash
mkdir -p ../agenthub-worktrees
```

## 3. 创建功能 worktree

```bash
git worktree add ../agenthub-worktrees/deploy-v1 -b feature/deploy-v1
git worktree add ../agenthub-worktrees/mini-ide -b feature/mini-ide-agentic-edit
git worktree add ../agenthub-worktrees/rich-artifacts -b feature/rich-doc-ppt-artifacts
git worktree add ../agenthub-worktrees/chat-polish -b feature/chat-im-polish
git worktree add ../agenthub-worktrees/orchestrator-spike -b spike/orchestrator-execution-model
```

检查：

```bash
git worktree list
```

## 4. 哪些能并行，哪些必须串行

可以并行：

| Worktree | 分支 | 功能线 |
| --- | --- | --- |
| `deploy-v1` | `feature/deploy-v1` | 自托管静态/Docker 部署、Caddy hash 路由、部署状态卡 |
| `mini-ide` | `feature/mini-ide-agentic-edit` | 小型 IDE、选区上下文、patch 预览/应用、commit 历史 |
| `rich-artifacts` | `feature/rich-doc-ppt-artifacts` | Markdown/MDX/PPT/文档预览和基础编辑 |
| `chat-polish` | `feature/chat-im-polish` | 回复、引用、重新生成、会话置顶/排序、Agent 联系人体验 |

只做 spike：

| Worktree | 分支 | 范围 |
| --- | --- | --- |
| `orchestrator-spike` | `spike/orchestrator-execution-model` | 对比 Temporal/Inngest/Hatchet/LangGraph/AutoGen；不直接改生产主链路 |

必须串行：

| 区域 | 原因 |
| --- | --- |
| 数据库 schema / migration | 同一时间只能有一个 schema owner |
| `packages/shared` 核心领域类型 | 避免合同漂移 |
| `research/contracts/*` | 共享事实层不能分叉 |
| Caddy 配置 / 部署目录约定 | 只能有一套路由模型 |
| Orchestrator 执行模型 | 调度语义只能统一决策 |
| 主分支合并 | 同一时间只合并一个功能分支 |

## 5. 锁机制

所有 worktree 共用 Git common dir，所以锁放在 common dir。

查看锁根目录：

```bash
git rev-parse --git-common-dir
```

创建锁目录：

```bash
mkdir -p "$(git rev-parse --git-common-dir)/agenthub-locks"
```

加锁：

```bash
mkdir "$(git rev-parse --git-common-dir)/agenthub-locks/db-schema.lock"
```

解锁：

```bash
rmdir "$(git rev-parse --git-common-dir)/agenthub-locks/db-schema.lock"
```

锁名：

```text
db-schema.lock
shared-types.lock
contracts.lock
deploy-caddy.lock
orchestrator-model.lock
main-merge.lock
```

如果 `mkdir` 失败，说明锁已被占用，必须等待。

## 6. 每个 worktree 初始化

进入 worktree：

```bash
cd ../agenthub-worktrees/<name>
git status --short
pnpm install
```

不同 worktree 使用不同端口：

```bash
PORT=3001 pnpm dev:web
PORT=3002 pnpm dev:web
PORT=3003 pnpm dev:web
```

不要让多个 worktree 同时改同一套破坏性测试数据。测试必须隔离 workspace/session。

## 7. 每个 worktree 内的 Trellis 流程

### 7.1 什么时候用 trellis-brainstorm

使用场景：

* 产品范围不清楚。
* 有多个实现路线。
* 会影响跨层合同。
* 用户要求规划、比较、调研。

给 Codex 的 prompt：

```text
$trellis-brainstorm
为 <feature> 创建 Trellis 任务。
以 bytedance_init_prd.md 为最高事实源。
写 prd.md 和 research notes。
先不要实现。
```

### 7.2 什么时候用 trellis-before-dev

每次写代码前都用。

给 Codex 的 prompt：

```text
$trellis-before-dev
加载 <package/layer> 相关规范。
然后实现 <small vertical slice>。
变更保持小范围。
不要碰无关文件。
```

### 7.3 实现时的 prompt

```text
实现 <slice>。

约束：
- 先读当前 Trellis task PRD 和相关合同。
- 保持 AgentHub 数据合同。
- 产品主链路不能用 mock runtime 数据证明完成。
- 补充或更新聚焦测试。
- UI 保持 shadcn/ui + Tailwind CSS 4 + lucide-react。
- 最终答复前运行相关测试和 git diff --check。
```

### 7.4 什么时候用 trellis-check

代码或文档改完后用。

给 Codex 的 prompt：

```text
$trellis-check
按 PRD 和合同验证这个功能。
运行触达 package 的 lint/type-check/tests。
涉及 UI 时检查真实 UI 行为。
列出剩余风险。
```

### 7.5 什么时候用 trellis-update-spec

使用场景：

* 学到可复用合同或约定。
* 修复了一个以后要防止的 bug 类。
* 跨功能实现规则发生变化。

给 Codex 的 prompt：

```text
$trellis-update-spec
记录 <feature> 中学到的可复用规则。
更新最小相关 spec。
不要写泛泛流程文字。
```

### 7.6 什么时候用 trellis-finish-work

使用条件：

* 测试通过。
* 已提交 commit。
* 当前 worktree clean。
* 任务文档/报告已更新。

给 Codex 的 prompt：

```text
$trellis-finish-work
确认质量门禁、已提交变更、git status 干净、剩余风险。
```

## 8. 功能完成检查

在功能 worktree 中运行：

```bash
git status --short
git diff --check
pnpm --filter @agenthub/shared test -- --run
pnpm --filter @agenthub/web type-check
pnpm --filter @agenthub/web test -- <target-tests> --run
```

如果改了 UI：

```bash
pnpm test:e2e:acceptance -- <target-spec>
```

如果改了 Desktop：

```bash
pnpm --filter @agenthub/desktop type-check
pnpm --filter @agenthub/desktop test -- --run
```

如果改了 Mobile：

```bash
pnpm --filter @agenthub/mobile type-check
pnpm --filter @agenthub/mobile test -- --run
```

最后固定运行：

```bash
git status --short
git diff --check
```

## 9. 功能 worktree 内提交

```bash
git status --short
git add <changed-files>
git diff --cached --name-status
git commit -m "feat: <中文摘要>"
git status --short
```

期望：

```text
git status 无输出
```

## 10. 回到主 worktree 合并

加主干合并锁：

```bash
cd /Users/joytion/Documents/code/AgentHub_new_claude_test
mkdir -p "$(git rev-parse --git-common-dir)/agenthub-locks"
mkdir "$(git rev-parse --git-common-dir)/agenthub-locks/main-merge.lock"
```

更新主分支：

```bash
git status --short
git branch --show-current
git pull --ff-only
```

合并一个功能分支：

```bash
git merge --no-ff feature/deploy-v1
```

运行检查：

```bash
git diff --check
pnpm --filter @agenthub/web type-check
pnpm --filter @agenthub/web test -- <target-tests> --run
git status --short
```

解锁：

```bash
rmdir "$(git rev-parse --git-common-dir)/agenthub-locks/main-merge.lock"
```

## 11. 删除已完成 worktree

合并后：

```bash
git worktree remove ../agenthub-worktrees/deploy-v1
git branch -d feature/deploy-v1
git worktree prune
git worktree list
```

## 12. 冲突处理规则

如果冲突涉及 schema/contracts/shared types：

```bash
git merge --abort
```

加对应锁：

```bash
mkdir "$(git rev-parse --git-common-dir)/agenthub-locks/db-schema.lock"
mkdir "$(git rev-parse --git-common-dir)/agenthub-locks/contracts.lock"
mkdir "$(git rev-parse --git-common-dir)/agenthub-locks/shared-types.lock"
```

只允许一个 worktree 解决。

## 13. Prompt 模板

### 创建功能任务

```text
当前在 worktree <name>，分支 <branch>。
为 <feature> 创建或继续 Trellis 任务。
以 bytedance_init_prd.md 为最高事实源。
如果实现细节不清楚，先 brainstorm。
不要改无关功能。
```

### 实现切片

```text
实现切片 <slice-name>。
先加载 trellis-before-dev。
读取当前 PRD 和合同。
打通一个可见用户路径。
补聚焦测试。
运行相关检查。
完成后提交。
```

### 验证切片

```text
加载 trellis-check。
按 PRD、合同、bytedance 源验证 <slice-name>。
运行目标测试和 UI 检查。
报告具体命令和结果。
真实用户路径没验过，不要宣称完成。
```

### 更新规范

```text
加载 trellis-update-spec。
只记录 <slice-name> 中学到的可复用规则。
保持更新最小，并绑定真实代码行为。
```

### 合并请求

```text
当前 worktree 已提交且 clean。
切回主 worktree。
获取 main-merge 锁。
合并分支 <branch>。
运行目标检查。
保持 git status 干净。
```

## 14. 最快安全推进顺序

1. `feature/deploy-v1`
2. `feature/mini-ide-agentic-edit`
3. `feature/chat-im-polish`
4. `feature/rich-doc-ppt-artifacts`
5. `spike/orchestrator-execution-model`
6. spike 决策后再开生产 Orchestrator 分支

## 15. 最终 clean 检查

每个剩余 worktree：

```bash
git status --short
```

主 worktree：

```bash
git status --short
git worktree list
find "$(git rev-parse --git-common-dir)/agenthub-locks" -maxdepth 1 -type d
```

期望：

```text
git status 无输出
没有残留 lock 目录，除了 agenthub-locks 根目录
```
