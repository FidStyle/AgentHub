# 收紧会话列表间距并梳理新建入口

## Goal

让左侧会话列表更接近 IM 联系人列表的紧凑布局，减少卡片内边距、行间距和辅助信息占用；同时明确“新会话”和“新建群聊”的产品语义，避免用户感知为重复入口。

## What I Already Know

- 用户提供的当前 DOM 显示会话项使用 `p-3`、较多垂直间距和多行辅助信息，视觉上比参考 IM 列表松散。
- 参考图是典型两行 IM 列表：左侧头像/图标，中间标题和摘要，右侧日期，整体行高紧凑。
- 当前会话列表组件是 `apps/web/components/workspace/SessionList.tsx`。
- Bytedance 原始 PRD 要求左侧会话列表支持新建、置顶、归档、搜索，IM/联系人/群聊也是 P1 范围。

## Requirements

- 会话项改为更紧凑的 IM 列表布局：图标、标题、最近活跃时间同一行，摘要/成员为次级信息。
- 减少卡片外观感：降低 padding、gap、margin，避免每条会话像独立大卡片。
- 操作按钮仍保留置顶、归档、删除，但不应挤压标题和摘要。
- “新会话”和“新建群聊”不是同一个功能：新会话用于一对一/默认会话，新建群聊用于多 Agent 群组；如果 UI 同屏出现两个入口，需要文案或结构上区分清楚。

## Acceptance Criteria

- [ ] 会话列表项垂直高度明显降低，摘要和时间/成员信息不会产生大段空白。
- [ ] 标题、时间、摘要、成员信息在窄侧栏中不重叠、不溢出。
- [ ] 置顶/归档/删除仍可通过按钮触达，测试 ID 保持稳定。
- [ ] 如存在“新会话”和“新建群聊”两个入口，最终语义清晰，不再像重复功能。
- [ ] 相关组件测试、lint/type-check 或最小可行验证通过。

## Out Of Scope

- 不重做整个 IM 信息架构。
- 不改变后端 session/group 数据模型。
- 不新增复杂的会话创建弹窗。

## Technical Notes

- Initial code search found `pin-session` / `archive-session` / `delete-session` / `新建群聊` in `apps/web/components/workspace/SessionList.tsx`.
