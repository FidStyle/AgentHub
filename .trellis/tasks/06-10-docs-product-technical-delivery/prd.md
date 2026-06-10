# docs product technical delivery

## Goal

为 AgentHub 准备两份可单独上交的交付文档：产品文档和技术文档。文档必须覆盖 Bytedance 原始方向下的 IM、多 Agent、Artifact、上下文 handoff、Runtime 接入、三端职责、预览/二次交互和部署发布设计，同时保持高内聚、低耦合、凝练不冗余。

## What I Already Know

- 用户明确要求产品文档和技术文档是两份单独 Markdown，并需要知道具体位置。
- `research/product/product-design.md` 与 `research/architecture/technical-design.md` 已存在，但内容偏详细设计，不适合作为最终上交版直接提交。
- `research/` 是项目共享合同层，不能把执行报告当作最终产品/技术文档。
- README 需要保持简单，重点给出 prerequisites、dev/release、三端启动方式和特殊说明。

## Requirements

- 产出两份专门上交文档：产品文档和技术文档。
- 两份交付文档必须完全独立，正文不能依赖其他 Markdown 补充解释。
- 用户已将两份交付文档单独转移；它们不随本仓库提交。
- 产品文档覆盖：
  - 产品定位、三端职责、工作区设计、IM/单聊/群聊/@ 逻辑、多 Agent 协作、消息类型、富媒体卡片、产物助手/PPT 助手、预览与二次交互、上下文 handoff、部署发布体验、未来飞书/小程序方向。
- 技术文档覆盖：
  - 总体架构、数据/实体关系、Runtime adapter 和 Claude Code/Codex 接入、Desktop connector、Orchestrator DAG、handoff、消息 part/card 协议、Artifact/PPT/preview/publish 技术链路、权限模式、兼容性和边界条件、未来 Docker/Caddy/飞书/小程序。
- 更新 `README.md`，保持简洁：
  - prerequisites
  - Docker/Postgres/Redis/Playwright/PPT 转换可选依赖
  - Web/Mobile/Desktop 启动表
  - 验收、Release、自托管简要入口
- 不删除历史 execution reports。
- 不把计划中能力写成已完成；用“当前实现”和“后续计划”区分。

## Acceptance Criteria

- [ ] 两份交付 Markdown 已单独移交，且可单独阅读，不需要跳转其他文档补上下文。
- [ ] README 命令与 `package.json` scripts 保持一致。
- [ ] 文档覆盖用户列出的主题，不出现明显重复段落或相互矛盾。
- [ ] Mermaid 图与文字语义一致，尤其是 Web/Server/Desktop 的职责边界。
- [ ] 运行基本文档检查：关键字检索、README 命令对齐检查、Markdown 语法快速检查。

## Out of Scope

- 不改业务代码。
- 不运行完整三端 E2E。
- 不重写所有 research 历史文档。
- 不删除历史报告和验收 ledger。

## Technical Notes

- 最高事实源：`bytedance_init_prd.md`、`bytedance_init_video_txt.txt`。
- 详细设计事实源：`research/prd.md`、`research/product/product-design.md`、`research/architecture/technical-design.md`。
- 模块事实源：`research/modules/im-foundation.md`、`research/modules/orchestrator*.md`、`research/modules/runtime-adapters.md`、`research/modules/desktop-connector.md`、`research/modules/action-cli-adapter.md`。
- README 命令来自 `package.json` scripts。
