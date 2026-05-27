#!/usr/bin/env bash
set -euo pipefail

TASK_ID="${1:-}"
if [[ -z "$TASK_ID" ]]; then
  echo "❌ 用法: $0 <TASK-ID>"
  echo "   例: $0 AUTH-MIG-001"
  exit 1
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
TRACKER="$REPO_ROOT/research/project-tracker.md"
REPORTS_DIR="$REPO_ROOT/research/execution-reports"
FAILURES=0

fail() { echo "❌ $1"; FAILURES=$((FAILURES + 1)); }
pass() { echo "✅ $1"; }

echo "═══════════════════════════════════════"
echo " 治理门禁检查: $TASK_ID"
echo "═══════════════════════════════════════"
echo ""

# 1. Git 工作区干净
DIRTY=$(git status --short 2>/dev/null | grep -v '^??' || true)
if [[ -n "$DIRTY" ]]; then
  fail "Git 工作区有未提交的修改:"
  echo "$DIRTY"
else
  pass "Git 工作区干净"
fi

# 2. project-tracker.md 包含该 task id
if [[ ! -f "$TRACKER" ]]; then
  fail "research/project-tracker.md 不存在"
else
  if grep -q "$TASK_ID" "$TRACKER"; then
    pass "project-tracker.md 包含 $TASK_ID"
  else
    fail "project-tracker.md 未包含 $TASK_ID 记录"
  fi
fi

# 3. task 状态为完成
if [[ -f "$TRACKER" ]]; then
  TASK_SECTION=$(sed -n "/### $TASK_ID/,/^### /p" "$TRACKER" | head -40)
  if echo "$TASK_SECTION" | grep -qiE '(completed|全部完成|验证通过|✅.*完成)'; then
    pass "$TASK_ID 状态为已完成"
  else
    fail "$TASK_ID 在 project-tracker.md 中未标记为完成状态"
  fi
fi

# 4. 包含测试证据
if [[ -f "$TRACKER" ]]; then
  if echo "$TASK_SECTION" | grep -qiE '测试证据.*\|.*\S'; then
    pass "project-tracker.md 包含测试证据"
  else
    fail "project-tracker.md 中 $TASK_ID 缺少测试证据"
  fi
fi

# 5. execution-reports 存在相关报告
# 从 task ID 提取搜索词：AUTH-MIG-001 → "auth" (第一段)
SEARCH_TERM=$(echo "$TASK_ID" | cut -d'-' -f1 | tr '[:upper:]' '[:lower:]')
REPORT_COUNT=$(find "$REPORTS_DIR" -maxdepth 1 -type f -name "*${SEARCH_TERM}*" 2>/dev/null | wc -l | tr -d ' ')
if [[ "$REPORT_COUNT" -gt 0 ]]; then
  pass "execution-reports 包含 $REPORT_COUNT 个相关报告"
else
  fail "execution-reports/ 下未找到 $TASK_ID 相关执行报告（搜索词: $SEARCH_TERM）"
fi

# 6. 最近 git commit 存在
RECENT_COMMIT=$(git log --oneline -1 2>/dev/null || true)
if [[ -n "$RECENT_COMMIT" ]]; then
  pass "最近 commit: $RECENT_COMMIT"
else
  fail "未找到任何 git commit"
fi

echo ""
echo "═══════════════════════════════════════"
if [[ $FAILURES -gt 0 ]]; then
  echo " 结果: 失败 ($FAILURES 项未通过)"
  echo "═══════════════════════════════════════"
  exit 1
else
  echo " 结果: 全部通过 ✅"
  echo "═══════════════════════════════════════"
  exit 0
fi
