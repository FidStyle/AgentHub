# 治理门禁修复报告

> 日期：2026-05-27

## 问题

Ralph session `ralph-20260527-100000` 的 status.json 标记 completed，但缺乏硬性机制确保 research 总账、execution-reports、测试证据和 git commit 同步闭环。

## 修复措施

1. **治理门禁脚本** — `scripts/verify-governance-gate.sh`
   - 检查 git 工作区、project-tracker 记录、完成状态、测试证据、执行报告、git commit
   - 任一失败 exit 1

2. **Spec 更新** — `.workflow/specs/review-standards.md` 新增治理门禁硬规则

3. **Overlay 注入** — 两个 overlay 覆盖 4 个命令：
   - `governance-gate-enforcement`: maestro-verify, maestro-milestone-audit, maestro-milestone-complete
   - `governance-gate-ralph`: maestro-ralph

4. **Research 文档更新** — index.md 和 project-tracker.md 治理规则补充

## 验证

```
bash scripts/verify-governance-gate.sh AUTH-MIG-001 → exit 0
maestro overlay list → 2 overlays enabled
```
