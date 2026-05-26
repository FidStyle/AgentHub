# AgentHub Trellis 到 Maestro 迁移计划

**状态：** 待确认迁移计划
**当前要求：** 不初始化 `.workflow`
**迁移目标：** 让 Maestro 接管 Phase 3 执行编排，同时保留 Trellis 作为回退机制

---

## 1. 当前阶段

当前处于迁移准备阶段，只产出文档：

- `research/maestro-migration-handoff.md`
- `research/maestro-phase3-roadmap.md`
- `research/maestro-tdd-quality-gates.md`
- `research/maestro-spec-export.md`
- `research/maestro-transition-plan.md`

本阶段不做：

- 不初始化 `.workflow`。
- 不改代码。
- 不写测试。
- 不移动或删除 Trellis 文件。
- 不 stage 或 commit。

---

## 2. 迁移分阶段计划

| 阶段 | 名称 | 动作 | 输出 | 是否创建 `.workflow` |
| --- | --- | --- | --- | --- |
| T0 | 文档交付 | 生成本组 Maestro 迁移交付文件 | 5 个 `research/maestro-*.md` | 否 |
| T1 | 用户确认 | 用户 review roadmap、gate、Trellis 退出/回退条件 | 确认或修订意见 | 否 |
| T2 | Maestro 初始化 | 按确认后的计划初始化 `.workflow` | Maestro state 和空 milestone 结构 | 是 |
| T3 | Spec export | 把 FR-ID、架构、测试、review 规则导入 Maestro spec | 可加载 spec | 是 |
| T4 | M0 试点 | 执行 `Monorepo + shared test harness` | 工程骨架、test harness、L0-L2 证据 | 是 |
| T5 | 迁移评审 | 判断 Maestro 是否稳定接管 | pass/fallback 决策 | 是 |
| T6 | Phase 3 正式推进 | 按 roadmap M1-M8 执行 | P0 Demo milestone artifacts | 是 |

---

## 3. Trellis 退出点

Trellis 退出主执行流发生在 T5 之后，而不是安装 Maestro 之后。

退出必须同时满足：

- [ ] 用户确认迁移交付文件。
- [ ] `.workflow` 初始化成功。
- [ ] Maestro spec 已导入 FR-ID traceability、产品边界、执行域边界、质量门禁。
- [ ] M0 `Monorepo + shared test harness` 完成。
- [ ] M0 通过 L0-L2 gate。
- [ ] Maestro 产物能追溯到 `research/prd.md`、`product-design.md`、`technical-design.md`。
- [ ] 没有 PRD 范围漂移。

退出后：

- Trellis 不再默认驱动新实现任务。
- `.trellis/` 保留为只读历史、规范和回退来源。
- 已有 Trellis 任务不迁移为代码修改，除非用户要求。

---

## 4. Trellis 回退点

任何阶段出现以下问题，Trellis 回退接管：

| 阶段 | 回退触发 | 回退方式 |
| --- | --- | --- |
| T1 | 用户不同意 roadmap 或 gate | 修订 research 文档，继续不初始化 `.workflow` |
| T2 | `.workflow` 初始化失败或状态异常 | 停止 Maestro 初始化，回到 Trellis |
| T3 | spec export 丢失 `FR-ID` 或引入 PRD 外需求 | 丢弃错误 spec，回到 Trellis planning guide 校正 |
| T4 | M0 无法建立 shared harness 或无法记录 gate 证据 | 暂停 Maestro 试点，用 Trellis Phase 3 任务拆解重做 |
| T5 | Maestro 产物不可审计或质量门禁不可复现 | Trellis 继续作为主执行流 |
| T6 | 后续 milestone 连续破坏 FR-ID 追踪或执行域边界 | 停止 Maestro milestone，回退 Trellis check/finish 流 |

回退时禁止自动删除 `.trellis/`、`.workflow` 或安装文件。是否清理由用户另行确认。

---

## 5. Maestro 接管后的运行规则

Maestro 每个 task 必须遵守：

1. 先读 `research/prd.md`、`product-design.md`、`technical-design.md` 中相关章节。
2. 写明 `FR-ID`，且 `FR-ID` 必须来自 PRD。
3. 写明产品表面和技术章节。
4. 先定义 gate，再实现。
5. 通过 L0 后才能进入实现。
6. 安全边界相关任务至少需要 L1-L2 自动化 gate。
7. 真实 Runtime、OAuth、Desktop 本地执行可进入 L4 gated/manual gate，但不能替代 L1-L3。
8. 每个 milestone 结束时输出 coverage 和未覆盖验收标准。

---

## 6. M0 试点详细定义

M0 名称：

`Monorepo + shared test harness`

目标：

- 建立 Phase 3 工程骨架。
- 证明 `FR-ID` 可以贯穿任务、测试、review、artifact。
- 先把安全边界和共享状态机测试基座建起来，再扩展 UI 和 Runtime。

必须包含：

- `apps/web`
- `apps/desktop`
- `packages/shared`
- shared domain types 的放置规则
- FR-ID registry 或常量
- execution domain policy 的最小测试
- shared test fixture/harness
- L0-L2 verification artifact

不包含：

- 完整 Web 三栏工作台。
- 完整 Desktop Connector。
- 真 Claude/Codex CLI 调用。
- Mobile PWA 完整页面。
- P1/P2 功能。

绑定需求：

- `FR-AUTH-001`
- `FR-WS-001`
- `FR-DEVICE-001`
- `FR-RUNTIME-001`
- `FR-PERM-001`
- `NFR-SEC-001`
- `NFR-OBS-001`

---

## 7. 立即下一步

当前只做 T0：

- 新增 5 个 research 迁移交付文件。
- 运行 `git diff --check`。
- 运行 `git status --short research .workflow`。

确认通过后，等待用户决定是否进入 T1/T2。未确认前不初始化 `.workflow`。

