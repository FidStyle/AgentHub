# 验收真实闭环 5：对话附件与 artifact 产出

## Goal

把附件上传和 artifact 产出从视觉入口改为真实数据闭环：附件内容可被 runtime 使用，artifact 可持久读取并展示。

## Requirements

- 附件不能只保存文件名；需要 API、存储、metadata、权限校验和 UI 状态。
- runtime 生成 artifact 时必须写 durable output，至少 DB metadata + 可读内容/path。
- Artifact 面板展示真实 artifact，并支持刷新恢复。

## Acceptance Criteria

- [ ] 上传附件后 DB/API 能读取文件元数据和内容引用。
- [ ] `@角色` 请求可携带附件上下文。
- [ ] runtime 输出 artifact 后右侧面板可见，刷新后仍可见。

## References

- `research/contracts/ACCEPTANCE-REAL-FLOW-2026-06-01.md`
- `packages/shared/src/domain/artifact.ts`
- `.trellis/spec/guides/end-to-end-contract-planning.md`
