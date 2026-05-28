# <TASK-ID>: <任务名称> 共享合同

> 本合同是 Trellis 与 Maestro/Ralph 的共享事实接口。实现、测试、验收和执行报告都必须引用本文件。

---

## 1. 元信息

| 字段 | 内容 |
| --- | --- |
| TASK-ID | `<TASK-ID>` |
| 优先级 | `P0/P1/P2` |
| 绑定 FR-ID | `<FR-ID 列表>` |
| 来源 | `bytedance_init_prd.md`, `research/prd.md`, `<其他文档>` |
| 负责人角色 | Codex 控制流程；Trellis 管实现规范；Maestro/Ralph 管大范围执行 |
| 状态 | draft / active / verified / archived |

---

## 2. 背景与目标

说明用户要完成的真实产品目标，而不是技术子任务。

---

## 3. 用户链路合同

从真实入口开始写完整路径：

1. `<入口 1>`
2. `<操作 2>`
3. `<系统状态 3>`
4. `<完成条件>`

不得只写“页面可见”“接口 200”。

---

## 4. 三端职责边界

| 端 | 职责 | 不做什么 |
| --- | --- | --- |
| Web | `<主工作台/IM/Artifact/...>` | `<边界>` |
| Desktop | `<本地 runtime/connector/...>` | `<边界>` |
| Mobile/PWA | `<轻量查看/审批/预览>` | `<边界>` |

---

## 5. 数据与后端合同

- 数据库要求：
- migration/seed 要求：
- 认证/session 要求：
- API 要求：
- 权限和错误语义：

产品运行时是否允许 mock 主链路数据：**否**。

---

## 6. UI/UX 合同

- 信息架构：
- 核心页面/组件：
- 空状态：
- 加载状态：
- 错误状态：
- 中文文案要求：
- 三端一致性要求：

---

## 7. 参考项目输入

| 参考项目 | 读取范围 | 提炼内容 | 不采用内容 |
| --- | --- | --- | --- |
| `<repo>` | `<路径/页面/模块>` | `<UX/结构/测试规则>` | `<不复制的内容>` |

---

## 8. Trellis 派生要求

- `.trellis/tasks/<task>/prd.md`：
- `implement.jsonl`：
- `check.jsonl`：
- 需要更新的 `.trellis/spec/*`：

---

## 9. Maestro/Ralph 派生要求

- 推荐命令：
- analyze/plan/execute/verify/review 要求：
- plan anti-pattern review：执行前必须按 `.trellis/spec/guides/end-to-end-contract-planning.md` 自查并修订。
- 需要更新的 `.workflow/roadmap.md` 或 plan：
- execution report 路径：

---

## 10. 测试与验收合同

自动化测试必须覆盖：

- type-check：
- API/integration：
- Web E2E：
- Desktop E2E：
- Mobile/PWA E2E：
- 视觉/布局断言：
- 数据库验证：

人工验收路径：

1. `<步骤>`
2. `<步骤>`
3. `<完成判断>`

---

## 11. 计划阶段禁止项

任何 plan 出现以下情况必须 revise，不得 execute：

- 用 `playwright test --list`、文件存在、grep-only 作为主验收。
- 用 mock API、mock auth、内存数据或 hardcoded sample 证明真实 DB/API/session 主链路。
- 用 placeholder runtime response 冒充 Agent/Runtime 成功。
- 假设 Electron renderer 能读取外部浏览器 OAuth cookie，而没有 device binding、deep link token 或 main-process session bridge。
- 只写“后续补真实实现 / TODO”覆盖 P0 主链路行为。
- 将 `status.json completed` 或 `DONE_WITH_CONCERNS` 当作产品完成。

计划必须先通过 `.trellis/spec/guides/end-to-end-contract-planning.md` 的 checklist。

---

## 12. 验真样本

如果本任务存在用户已发现但不应直接喂给执行者的失败链路，登记为验真样本。

| 样本 | 只给执行者的合同描述 | 不应预置的答案 | 通过标准 |
| --- | --- | --- | --- |
| `<样本名>` | `<完整用户链路和完成标准>` | `<不要在 prompt 中暴露的根因/具体症状>` | `<执行系统自行发现并提供证据>` |

验真样本不是直接修复目标。若执行系统不能自行发现样本问题，先修测试合同和工作流门禁。

---

## 13. 完成门禁

完成前必须满足：

- [ ] `research/project-tracker.md` 已更新。
- [ ] `research/execution-reports/*.md` 已补齐。
- [ ] 真实验证命令和结果已写入报告。
- [ ] 精确 commit，禁止 `git add .`。
- [ ] 最近 commit 不包含 `refer_proj/*`、缓存、临时日志、`.workflow/.maestro/*/status.json`。
- [ ] `bash scripts/verify-governance-gate.sh <TASK-ID>` exit 0。
- [ ] Codex 按本合同完成独立验收。
- [ ] 验真样本已被执行系统自行发现，或已记录为流程门禁缺陷并补强合同/测试。

---

## 14. 残留风险与后续

- `<风险 1>`
- `<风险 2>`
