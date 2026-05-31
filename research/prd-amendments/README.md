# PRD 修订记录目录

**用途：** 当实现或验收过程中发现 `research/prd.md` 的 `FR-ID`、验收标准或范围边界不够明确时，先在本目录记录待确认修订，再合并回 Master PRD。

---

## 何时使用

命中以下情况时必须暂停实现，并在本目录新增修订记录：

- 新行为无法映射到现有 `FR-ID`。
- 现有 Acceptance Criteria 不足以写出自动化断言。
- UI 任务缺少视觉契约、参考项目来源或视觉 E2E 断言。
- 参考项目结论与 PRD、产品设计、UI 契约或技术设计冲突。
- 实现需要引入未定义的权限、凭证、本地执行能力或发布动作。
- E2E、截图或布局断言暴露 PRD 未描述的用户可见状态。

小范围且无争议的修订可以直接更新 `research/prd.md`，但提交说明必须写明影响的 `FR-ID`。

---

## 文件命名

```text
YYYY-MM-DD-{slug}.md
```

示例：

```text
2026-05-25-runtime-login-boundary.md
2026-05-25-mobile-approval-empty-state.md
```

## 当前修订

| 修订 | 状态 | 说明 |
| --- | --- | --- |
| [2026-05-31-three-surface-workbench-permission-model.md](./2026-05-31-three-surface-workbench-permission-model.md) | confirmed | 三端会话工作台、权限预设、Desktop Host、Mobile 远程监督、参考组件迁移和 Context/Changes/Artifacts 结构 |

---

## 模板

```markdown
# {修订标题}

**日期：** YYYY-MM-DD
**状态：** draft | confirmed | merged | rejected
**触发任务：** `.trellis/tasks/{task}/`
**影响 FR-ID：** `FR-xxx-001`
**相关文档：** `research/prd.md`, `research/product/product-design.md`, `research/product/ui-design-system.md`, `research/architecture/technical-design.md`

---

## 1. 触发原因

说明实现、测试或参考项目调研中发现了什么不清楚或冲突。

## 2. 当前契约

引用当前 PRD、产品设计、UI 契约或技术设计中的相关表述。

## 3. 问题

说明当前契约为什么不足以指导实现或自动化验收。

## 4. 建议修订

写出建议新增、修改或删除的需求文本、验收标准或边界说明。

## 5. 测试影响

说明需要新增或调整哪些单测、集成测试、E2E、截图或布局断言。

## 6. 用户确认问题

列出必须由用户确认的问题。没有待确认问题时写“无”。

## 7. 合并记录

- confirmed：{确认来源}
- merged：{合并到 research/prd.md 的提交或说明}
```

---

## 合并规则

1. `draft` 不得作为实现依据，只能作为讨论材料。
2. `confirmed` 可以用于回填任务切片，但还必须尽快合并到 `research/prd.md`。
3. `merged` 后需要同步更新相关 `.trellis/tasks/*/prd.md`、`implement.jsonl` 和 `check.jsonl`。
4. `rejected` 保留原因，不能删除历史记录。
