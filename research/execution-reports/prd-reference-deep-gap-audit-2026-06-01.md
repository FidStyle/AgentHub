# PRD + 参考项目深度缺口审计（2026-06-01）

## 审计范围

本轮不改产品代码，只按 `research/prd.md`、P0 合同和主要参考项目反查当前实现，重点识别“能跑一条消息但没有达到 PRD 产品形态”的同类风险。

事实源优先级：PRD/P0 合同 > 当前用户最新口径 > 当前代码 > 最近实测报告。历史 report、测试通过数、组件存在本身不作为完成证据。

已对比参考项目：

| 参考项目 | 重点组件 | 可迁移模式 |
| --- | --- | --- |
| `refer_proj/xintaofei__codeg` | `conversation-shell.tsx`, `message-input.tsx`, `agent-plan-overlay.tsx`, `agent-tool-call.tsx`, `aux-panel-file-tree-tab.tsx`, `aux-panel-git-changes-tab.tsx` | 三栏最小高度布局、富输入框、计划浮层、工具调用状态、文件树操作、Git changes 面板 |
| `refer_proj/lehhair__OpenCodeUI` | `MessageRenderer.tsx`, `ToolPartView.tsx`, `InputBox.tsx`, `InlinePermission.tsx` | part-based 消息模型、工具生命周期、内联权限/问题、输入历史/附件/停止 |
| `refer_proj/AionUi` | `ChatLayout`, `MessagePlan`, `MessageToolCall`, `MessageToolGroup`, `MessagePermission`, `Workspace`, `Preview` | 可折叠 workspace/preview、多类型预览、文件操作、changes hooks、工具组汇总 |
| `refer_proj/ChatGPTNextWeb__NextChat` | `markdown.tsx`, `chat.tsx`, `sidebar.tsx`, `artifacts.tsx` | Markdown 组件化、会话侧栏、artifact 查看入口 |

## 总体结论

当前最新提交已经把云端 `/api/chat`、默认 Orchestrator、Markdown 基础渲染、右栏 `角色 / 文件 / 变更 / 产物`、workspace 删除、云端 Git 目录、附件和 artifact metadata 打通到可验真层面。这个修复解决了“完全不能发消息/没有回复”的主断点。

但按 PRD 和参考项目反查，Web 主工作台仍主要是“文本流 + metadata 面板”，还没有成为完整 Agent 协作工作台。最大残留是：Orchestrator 没有结构化计划/确认/分派闭环，runtime 没有工具/权限/文件变更事件模型，右侧 changes/artifacts/file tree 没有和真实 workspace Git/产物系统双向联动。Desktop 和 Mobile 也只覆盖轻量链路，不能写成三端所有功能完成。

## Web P0 阻塞项

| ID | 分类 | PRD expected | 参考项目模式 | 当前证据 | 需要补齐 |
| --- | --- | --- | --- | --- | --- |
| WRG-001 | `partial_shell` | `FR-ORCH-001`：未 @ 默认 Orchestrator 判断澄清/计划/分派；@ 多角色进入 Orchestrated Flow；计划需确认、校验和按节点执行 | codeg `AgentPlanOverlay` 从 live message content 提取 plan entries；AionUi `MessagePlan` 在消息流内表达计划状态 | `apps/web/app/api/chat/route.ts` 只把 role context 拼进 `systemPrompt`；`OrchestratorPanel` 只 GET `/api/plans` `/api/actions`，没有被 chat/runtime 自动写入 | 增加 Orchestrator 结构化事件协议：clarify / plan_proposed / plan_confirmed / node_assigned / node_result / summary；`/api/chat` 或 worker 解析并落 plans/actions/messages |
| WRG-002 | `missing_required` | `FR-ORCH-001`：计划确认后应调度 ready 节点给 Role Agent，失败后支持重试/跳过/停止 | OpenCodeUI tool/session part 可展示子任务和状态；AionUi MessageToolGroup 汇总多工具/多步骤 | `apps/web/app/api/plans/[planId]/confirm/route.ts` 只改状态；没有 node executor、依赖调度、结果回填 | 实现 plan runner：校验 DAG、runtime/workspace 域、节点队列、节点结果落库、失败恢复 UI |
| WRG-003 | `partial_shell` | `FR-ARTIFACT-001`, `FR-ACTION-001`：消息流应有工具调用、权限卡、结果卡、diff 卡和执行输出 | OpenCodeUI `ToolPartView` 支持 running/pending/error/completed、duration、inline permission/question；codeg `agent-tool-call` 支持 subagent/tool calls | `apps/web/store/session-store.ts` 消息模型只有 `role/content/roleAgentId`；SSE 只处理 `role_selected`、`runtime_output` 和少量 terminal notice | 扩展 message part/event model：tool_call_started/tool_delta/tool_result/permission_request/question/diff/artifact；主消息流渲染对应卡片 |
| WRG-004 | `partial_shell` | `FR-ACTION-001`, `FR-PERM-001`：权限预设需控制执行，超权动作在当前 Session 授权后继续执行 | OpenCodeUI `InlinePermission` 缓存已批准请求，避免工具结果前 UI 跳变；codeg `permission-dialog` 明确权限请求 | Composer 已把 permissionMode 放 metadata；ActionCard 能批准，但批准后不恢复被阻塞动作 | 权限引擎接入 runtime/tool dispatcher：动作请求落 action，批准后继续原 run；支持仅本次/本 Session/调整策略 |
| WRG-005 | `partial_shell` | `FR-RESULT-001`, `FR-ARTIFACT-001`：结果卡展示摘要、文件变更、Git diff、预览链接、执行输出 | codeg `aux-panel-git-changes-tab` 调 `gitStatus/gitAdd/gitRollback/openCommitWindow`；AionUi `FileChangeList` 和 preview viewers | `ArtifactPanel` 的 ChangesTab 只筛 message metadata 中的 `diff/git_diff/files`，不会扫描 workspace Git status | 实现 `/api/workspaces/:id/git/status`、diff read、change tree、rollback/stage/preview；runtime 完成后刷新 changes |
| WRG-006 | `partial_shell` | `FR-WEB-001`：右栏文件/产物/预览可查看结构化内容并从对话回链 | AionUi Workspace 支持打开/预览/rename/delete/drag import/paste；Preview 支持 Markdown/Code/Image/PDF/Office/HTML/Diff | FileTreeTab 只读树；ArtifactsTab 只展示内容和 raw metadata；无打开文件、下载、版本、source link、preview 面板 | 文件树增加 open/preview/download/rename/delete/upload；artifact 增加 viewer、download、source message/run link、版本/类型 |
| WRG-007 | `partial_shell` | `FR-CHAT-001`：IM composer 支持文本、Markdown、@Role、附件/上下文和流式回复 | codeg/OpenCodeUI InputBox 支持 textarea、附件、mentions、slash commands、history、stop/abort、queue edit | `ChatPanel` 使用单行 `Input`；@ 只能点 toolbar 选角色，不能在文本内解析；无 stop/abort；无草稿历史 | 替换为 textarea/autoresize composer；实现 inline @ parsing、多选 chips、slash/action menu、停止/重试、草稿 |
| WRG-008 | `implemented_unverified` | 用户真实手打消息必须通过 React controlled input 发出 | 参考项目都有真实输入 E2E 和 keyboard flows | 最近 opencli 验证中 controlled input 填充不稳定，最终用浏览器 `fetch('/api/chat')` 验证真实 cookie 链路 | 用 Playwright 或 opencli human handoff 补“手动输入 -> 点击发送 -> SSE 动态显示 -> reload 持久”截图和断言 |
| WRG-009 | `partial_shell` | 会话列表应展示最近消息、状态、参与角色、待审批提示 | ChatGPTNextWeb/sidebar 和 codeg sidebar 都用最后消息、时间和当前会话状态组织 | `session-store.ts` 把 `lastMessage` 永远设为空；`SessionList` 因此长期显示“暂无最新消息” | `/api/sessions` 聚合 last_message/participants/status/pending_action_count，并在发送/stream 后更新 |
| WRG-010 | `stale_or_ghost` | 当前实际工作台应只有一套真实 ChatPanel/DetailPanel 语义 | 参考项目组件职责清晰，未挂载旧组件不保留产品语义 | `apps/web/components/chat/ChatPanel.tsx` 和 `apps/web/components/layout/DetailPanel.tsx` 仍有旧英文 Plan/Result/Artifact Detail/Agent 配置语义 | 确认未引用后删除；如仍需复用，迁移到当前 workspace 工作台并统一中文/真实数据 |

## Desktop 缺口

| ID | 分类 | PRD expected | 当前证据 | 需要补齐 |
| --- | --- | --- | --- | --- |
| DRG-001 | `partial_shell` | Desktop 轻量会话仍必须走 Workspace 执行域、Runtime 绑定和权限策略，不能绕过云端后端和 DeviceChannel | `DesktopAgentSession.tsx` 直接 `runtime.execute({ runtimeType, prompt }, cwd)`，写本地 activity；未绑定真实 Web session/run/action | 将 Desktop 本地输入转成同一 backend run/action，或明确只作为本机诊断 scratch，不计入 PRD 轻量会话完成 |
| DRG-002 | `partial_shell` | Desktop 绑定本地 Workspace 文件夹，并展示真实绑定状态 | `console-store.ts` 默认 `~/.agenthub/workspaces/default` 静态 workspaceDirs；没有和用户 Workspace/DeviceChannel 绑定查询 | 接入真实 workspace binding API/native folder picker；本地目录健康状态回传后端 |
| DRG-003 | `partial_shell` | 打开 Web 工作台入口必须指向有效 Workspace/Session，失败给中文下一步 | `useOpenWebWorkspace.ts` 固定打开 `/workspace`，不带当前 workspace/session | 从当前绑定 workspace/session 生成 URL；无有效目标时展示登录/创建/启动 Web 的下一步 |
| DRG-004 | `stale_or_ghost` | Desktop 不做审批中心，不维护假授权记录 | `console-store.ts` 仍有 `authorizationRecords: []` 类型和静态策略/活动 seed；需要继续确认所有 UI 是否只做策略/日志 | 删除假授权语义；保留越权记录时必须接真实 `/api/actions`/runtime logs |

## Mobile / PWA 缺口

| ID | 分类 | PRD expected | 当前证据 | 需要补齐 |
| --- | --- | --- | --- | --- |
| MRG-001 | `partial_shell` | Mobile/PWA 查看 Session、轻量消息、审批、任务进度、预览和 artifact 摘要 | `/m/sessions/[sessionId]` 可发基础 `/api/chat`，但消息是 `<p>` 纯文本；无 plan/tool/action/result/artifact rich card | 复用 Web message part renderer 的移动降维版：plan summary、permission card、tool status、artifact link |
| MRG-002 | `partial_shell` | Mobile 可审批 Orchestrator 计划、权限升级、部署/Action 确认、失败重试 | `/m/approve` 只读 `notifications` 中 `approval_required` 并 POST approve；当前 chat/runtime 不自动生成这些通知 | runtime/action/plan 生成通知；移动审批后恢复对应 action/run |
| MRG-003 | `partial_shell` | Mobile 可查看预览链接和轻量产物摘要 | `/m/preview` 只能从 message/attachment content 做只读 pre；外部 url 明确不读取，无 artifact viewer | 接 artifact API，按类型渲染 Markdown/code/image/diff 摘要；支持从消息/通知跳转 |
| MRG-004 | `implemented_unverified` | 原生 RN App 可作为三端之一完成核心轻量 IM | `apps/mobile` 依赖 env 注入 `EXPO_PUBLIC_*`，没有真实登录/session 选择 GUI；未跑模拟器/设备截图 | 若验收包括原生端，补登录态注入/会话选择和设备/模拟器 UAT；否则 P0 口径限定为 PWA mobile |

## 测试与治理缺口

| ID | 分类 | 当前证据 | 风险 | 需要补齐 |
| --- | --- | --- | --- | --- |
| TRG-001 | `stale_or_ghost` | `e2e/tests/artifact.spec.ts`、`web/artifact-panel-data.spec.ts` 注释和断言仍写旧「上下文」Tab；当前 UI 是 `角色 / 文件 / 变更 / 产物` | 测试可能因 skip 没暴露；后续实跑会断言旧语义，造成假绿或误导 | 更新 E2E 到当前 tab 语义，新增文件/变更/产物真实 API 断言 |
| TRG-002 | `implemented_unverified` | 多个真实 DB/Electron/RN 测试以 `TEST_AUTH_COOKIE`、`DESKTOP_APP_PATH`、模拟器环境缺失而 skip | 不能把“测试文件存在”写成“真实三端已通过” | 建立验收 profile：Web real browser、Electron app path、PWA mobile viewport、RN optional；skip 结果单独列为未验真 |
| TRG-003 | `partial_shell` | `product-reality-gap-audit.spec.ts` 是结构锚点，部分断言仍检查旧修复状态 | 审计锚点容易被误当成通过门禁 | 将“缺口存在锚点”和“产品通过门禁”分开命名；修复后反转或删除旧锚点 |
| TRG-004 | `stale_or_ghost` | `research/reference-repos/three-surface-workbench-component-migration.md` 仍有旧 `Context / Changes / Artifacts` 右栏口径 | 与用户最新口径“右侧为角色、文件树、变更、产物，不单独放上下文”冲突 | 新增 amendment 或更新 reference migration doc，防止下一轮按旧右栏实现 |

## 修复任务建议

建议不要再以“发消息有回复”作为主任务完成口径，改成按以下任务树推进：

1. **Web Orchestrator 真闭环**
   - 结构化事件协议、plan/action/message schema 对齐。
   - `/api/chat`/worker 自动生成计划、确认卡、节点调度和结果汇总。
   - Web/PWA 消息流内渲染 plan/approval/result。

2. **Runtime Tool/Event 模型**
   - Codex/Claude 输出解析为 tool parts、permission request、diff/artifact events。
   - SSE/store/message schema 从纯文本升级为 part-based。
   - stop/abort/retry 和错误态进入统一 run 状态。

3. **Workspace 文件、变更、产物工作台**
   - Git status/diff API、文件预览/下载/重命名/删除/上传。
   - Artifact durable API 和 viewer。
   - 右栏条目和中间消息/run 双向定位。

4. **Composer 和会话列表升级**
   - textarea、自适应高度、inline @、slash、附件/文件引用、停止按钮。
   - sessions API 聚合 last message、参与角色、运行/审批状态。

5. **Desktop 本地链路产品化**
   - 本地轻量输入走后端 run/action，或从 PRD 口径里降级为本机 scratch。
   - 真实 workspace folder binding。
   - 打开 Web 指向有效 workspace/session。

6. **Mobile/PWA 降维富消息**
   - 复用 plan/tool/action/artifact message model。
   - 审批通知和 action resume 真实闭环。
   - 明确原生 RN 是否纳入本次验收；纳入则补模拟器/设备 UAT。

7. **测试口径清理**
   - 删除/迁移旧组件和旧 tab 测试。
   - 将 skip 的真实环境测试从“通过数”中剥离。
   - 增加 opencli/Playwright 真实手动输入、三列独立滚动、文件/变更/产物可读截图证据。

## 未实测范围

本轮为代码和参考项目审计，没有重新运行 Web server、runtime worker、Electron 或 RN 模拟器。最近一次已知实测只能证明：真实浏览器 cookie 下云端 API chat、附件、artifact metadata、右栏基础展示和 workspace 删除可用；不能证明上述 Orchestrator/tool/diff/artifact viewer/三端富消息能力已完成。
