# 右侧工作台拖动与文件树体验修复 PRD

## 背景

用户在真实工作台验收中发现：右侧工作台宽度仍不可拖动或难以使用，角色过程、编排、文件、Git 等长内容被窄栏挤压；文件和 Git 视图仍像文字列表，不符合 VSCode 式文件夹/变更浏览体验；前端缺少简单新增文件入口和面向查看/编辑文件的宽屏工作区。

本任务绑定 Bytedance 原始 PRD 的 Web 工作台、IM-first 多角色协作、Context/Changes/Artifacts、文件/Git/产物可见闭环，涉及 `FR-UI-001`、`FR-WEB-001`、`FR-CHAT-001`、`FR-RESULT-001`、`FR-ARTIFACT-001`。

## 目标

1. 右侧工作台在桌面视口中可真实拖动宽度，宽度可持久化，拖动后聊天区和输入区仍可操作。
2. 文件和 Git 面板采用类似 VSCode 的树形信息架构，默认只展开一级文件夹，长路径和 diff 不再挤在窄列表中。
3. 查看或编辑文件时，工作台进入宽屏/分栏模式：左侧为文件树，右侧为文件内容或 diff。
4. 文件面板提供简单新增文件能力，走真实 workspace 文件 API；未能创建时显示中文错误。
5. 测试覆盖源码契约、组件行为、真实浏览器拖动/宽屏基础交互；未运行的三端验收必须明确标记。

## 非目标

- 不做 P2 富文档/演示稿。
- 不重做完整 IDE、语言服务、终端或 Docker 发布。
- 不改变后端 runtime 主链路、角色调度语义或权限策略。

## 用户链路

1. 用户打开 Web 工作台。
2. 用户拖动右侧工作台左侧把手，右栏宽度变化，刷新后保留。
3. 用户进入“文件”页签，看到 workspace 文件树，顶层目录默认展开，深层目录默认折叠。
4. 用户点击文件，右侧自动展开为更宽工作台，左树右内容；内容长行可滚动而不挤压角色/过程文本。
5. 用户点击新增文件，输入路径和内容，创建后文件树刷新并选中新文件。
6. 用户进入“Git”页签，先看到变更文件树/列表，点击某个文件后才加载并显示 diff。

## 验收标准

- `artifact-resize-handle` 可被真实浏览器拖动；拖动前后 `artifact-panel` 宽度发生变化，`agenthub:right-panel-width` 写入 localStorage，刷新后恢复。
- 工作台支持宽屏模式，触发点包括文件选择、Git diff 选择或显式展开按钮；宽屏模式不会遮挡聊天输入区。
- 文件树默认展开一级目录；文件夹可折叠/展开；文件名和路径使用截断/横向滚动策略，不能把右栏撑坏。
- 文件面板有 `data-testid="workspace-file-tree"`、`data-testid="workspace-file-viewer"`、`data-testid="workspace-new-file-button"`。
- Git 面板有 `data-testid="workspace-git-tree"` 和按文件选择加载 diff 的交互，默认不把所有 diff 混在一起。
- 新增文件通过真实 API 写入 workspace，成功后刷新列表；失败有中文错误。
- Focused tests、type-check、lint 通过；OpenCLI/Playwright 真实浏览器验收尽量执行，若环境阻塞必须写明。

## 参考与规范

- 最高事实源：`bytedance_init_prd.md`、`bytedance_init_video_txt.txt`
- 共享规范：`research/workflow/ai-workflow-control.md`
- 前端规范：`.trellis/spec/frontend/index.md`、`.trellis/spec/frontend/component-guidelines.md`、`.trellis/spec/frontend/ui-style-guidelines.md`、`.trellis/spec/frontend/quality-guidelines.md`
- 主链路验收：`.trellis/spec/cross-layer/real-flow-acceptance.md`
