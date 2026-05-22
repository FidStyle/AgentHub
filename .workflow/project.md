# Project: AgentHub

## What This Is

多 Agent 协作平台，采用 IM 聊天作为核心交互范式。用户通过类似飞书/微信的对话方式与多个 AI Agent（Claude Code、Codex、OpenCode 等）交互，支持单聊、群聊协作、任务编排和产物预览。

## Core Value

IM 聊天式的多 Agent 协作体验——用户能像发消息一样自然地与 AI Agent 协作完成复杂任务。

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] IM 聊天核心体验：对话列表、单聊模式、消息类型（文本/代码块/文件/预览卡片）
- [ ] 群聊协作模式：@ 多个 Agent，Orchestrator 自动协调分工
- [ ] 多 Agent 接入：统一适配器层，至少接入 Claude Code + Codex
- [ ] 产物预览与编辑：内联网页预览、代码 Diff 视图、全屏编辑器
- [ ] 上下文管理：聊天历史自动传递、关键消息 pin
- [ ] 用户自建 Agent：对话式创建，设定 System Prompt + 工具集

### Out of Scope

- 部署发布功能（P2） — 优先级低，核心体验稳定后再考虑
- 移动端支持（P2） — 先做好 Web 端主力体验
- 桌面端（P2） — Web 端完成后再扩展
- PPT 浏览/生成 — 非核心场景

## Context

字节跳动实习课题项目。考核维度：AI 协作能力(30%)、功能完整度(25%)、生成效果质量(20%)、代码理解度(15%)、创新与产品感(10%)。需交付：产品设计文档、技术文档、可运行 Demo、AI 协作开发记录、3 分钟 Demo 视频。

## Constraints

- **Timeline**: 实习课题周期内完成
- **Evaluation**: 需沉淀 AI 协作的 Spec/Skill/Rules 等协作规范
- **Demo**: 必须有可运行的 Demo 和 3 分钟演示视频

## Tech Stack

- **Language**: TypeScript
- **Framework**: TBD (React/Next.js for frontend)
- **Database**: TBD

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| IM 聊天作为核心交互范式 | 降低用户学习成本，自然交互 | — Accepted |
| 统一适配器层接入多 Agent | 屏蔽 API 差异，可扩展 | — Accepted |
| Orchestrator 协调群聊 | 自动任务拆解分派，提升协作效率 | — Accepted |

## Stakeholders

- 实习生（开发者）
- 字节跳动导师（评审）

---
*Last updated: 2026-05-23 after initialization*
