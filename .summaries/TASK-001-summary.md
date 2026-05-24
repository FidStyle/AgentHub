# TASK-001: Message 类型统一 + Markdown 依赖安装

## Changes
- `packages/shared/src/domain/message.ts`: Complete rewrite -- all field names converted to snake_case to match `database.types.ts`, added `role_agent_id`, `metadata`, `is_pinned`, `updated_at` fields, updated `MessageType` union to match DB schema
- `package.json`: Added `dependencies` section with `react-markdown@^9.0.0`, `rehype-highlight@^7.0.0`, `remark-gfm@^4.0.0`

## Verification
- [x] `role_agent_id` field exists in message.ts
- [x] `message_type` field exists in message.ts
- [x] `metadata: Record<string, unknown> | null` field exists in message.ts
- [x] `is_pinned` field exists in message.ts
- [x] `created_at` snake_case field exists in message.ts
- [x] `updated_at` field exists in message.ts
- [x] `react-markdown` dependency added to package.json
- [x] `rehype-highlight` dependency added to package.json
- [x] `remark-gfm` dependency added to package.json
- [x] `pnpm install` succeeds without error

## Tests
- [x] `pnpm install`: passed (104 packages added, react-markdown 9.1.0, rehype-highlight 7.0.2, remark-gfm 4.0.1 installed)

## Deviations
- None

## Notes
- `MessageType` union in `message.ts` now matches DB schema (`'text' | 'plan_card' | 'result_card' | 'approval' | 'system_event'`) instead of the previous narrower set
- `created_at` and `updated_at` are typed as `string` (matching DB schema) rather than `Date`
- `sender_id` is nullable (`string | null`) per DB schema
