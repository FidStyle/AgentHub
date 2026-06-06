#!/usr/bin/env bash
set -euo pipefail

TASK_ID="${1:-}"
if [[ -z "$TASK_ID" ]]; then
  echo "错误：缺少 TASK-ID"
  echo "用法: $0 <TASK-ID>"
  echo "例: $0 AUTH-MIG-001"
  exit 1
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
TRACKER="$REPO_ROOT/research/project-tracker.md"
REPORTS_DIR="$REPO_ROOT/research/execution-reports"
EVIDENCE_AUDIT="$REPO_ROOT/scripts/audit-acceptance-evidence.mjs"
FAILURES=0

fail() { echo "[失败] $1"; FAILURES=$((FAILURES + 1)); }
pass() { echo "[通过] $1"; }
info() { echo "[信息] $1"; }

echo "═══════════════════════════════════════"
echo " 治理门禁检查: $TASK_ID"
echo "═══════════════════════════════════════"
echo ""

# 1. Git 工作区必须完全干净，包括未跟踪文件。
DIRTY=$(git status --short 2>/dev/null || true)
if [[ -n "$DIRTY" ]]; then
  fail "Git 工作区存在未提交或未跟踪文件。请先精确 git add + 中文 commit，禁止 git add ."
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

# 3. task 状态必须完成，且不能只停留在进行中。
TASK_SECTION=""
if [[ -f "$TRACKER" ]]; then
  TASK_SECTION=$(awk -v id="### $TASK_ID" '
    $0 ~ "^### " && found { exit }
    index($0, id) == 1 { found = 1 }
    found { print }
  ' "$TRACKER")
  if echo "$TASK_SECTION" | grep -qE '(in_progress|partial|blocked|not-run|im-first-open|不能写 completed|未计入通过|不声明|尚未完成|fixed_pending_verify|REG-[0-9-]+.*open)'; then
    fail "$TASK_ID 在 project-tracker.md 中仍包含 partial/open/blocked/not-run 语义"
  elif echo "$TASK_SECTION" | grep -qE '(completed|全部完成|验证通过|全量验收通过|✅.*完成|✅.*通过)'; then
    pass "$TASK_ID 状态为已完成"
  else
    fail "$TASK_ID 在 project-tracker.md 中未标记为完成状态"
  fi
fi

# 4. project-tracker.md 必须包含有效测试证据。
if [[ -f "$TRACKER" ]]; then
  TEST_LINE=$(echo "$TASK_SECTION" | grep -E '^\| \*\*测试证据\*\* \|' || true)
  if [[ -n "$TEST_LINE" ]] && ! echo "$TEST_LINE" | grep -qE '(待执行|待补充|无|N/A|TODO)'; then
    pass "project-tracker.md 包含测试证据"
  else
    fail "project-tracker.md 中 $TASK_ID 缺少测试证据"
  fi
fi

# 5. execution-reports 必须存在相关报告。优先按内容匹配 TASK-ID，再按任务前缀兜底。
SEARCH_TERM=$(echo "$TASK_ID" | cut -d'-' -f1 | tr '[:upper:]' '[:lower:]')
REPORT_COUNT=0
if [[ -d "$REPORTS_DIR" ]]; then
  CONTENT_MATCH_COUNT=$(grep -RIl -- "$TASK_ID" "$REPORTS_DIR" 2>/dev/null | wc -l | tr -d ' ')
  NAME_MATCH_COUNT=$(find "$REPORTS_DIR" -maxdepth 1 -type f -name "*${SEARCH_TERM}*" 2>/dev/null | wc -l | tr -d ' ')
  REPORT_COUNT=$((CONTENT_MATCH_COUNT + NAME_MATCH_COUNT))
else
  fail "research/execution-reports/ 不存在"
fi
if [[ "$REPORT_COUNT" -gt 0 ]]; then
  pass "execution-reports 包含 $REPORT_COUNT 个相关报告"
else
  fail "execution-reports/ 下未找到 $TASK_ID 相关执行报告（搜索词: $SEARCH_TERM）"
fi

# 5.1. 严格验收证据审计：禁止把 partial、历史证据、open P0 regression 或 timeline-only 读回算成完成。
if [[ -f "$EVIDENCE_AUDIT" ]]; then
  AUDIT_STATUS=0
  AUDIT_OUTPUT=$(node "$EVIDENCE_AUDIT" "$TASK_ID" --root "$REPO_ROOT" 2>&1) || AUDIT_STATUS=$?
  if [[ "$AUDIT_STATUS" -ne 0 ]]; then
    fail "严格验收证据审计未通过"
    echo "$AUDIT_OUTPUT"
  elif [[ "${AUDIT_OUTPUT:-}" != "" ]] && echo "$AUDIT_OUTPUT" | grep -q "Classification: product-pass"; then
    pass "严格验收证据审计为 product-pass"
  elif [[ "${AUDIT_OUTPUT:-}" != "" ]]; then
    info "严格验收证据审计输出："
    echo "$AUDIT_OUTPUT"
  fi
else
  fail "严格验收证据审计脚本不存在: $EVIDENCE_AUDIT"
fi

# 6. 最近 git commit 必须存在，且 commit message 必须包含中文。
RECENT_COMMIT=$(git log --oneline -1 2>/dev/null || true)
if [[ -n "$RECENT_COMMIT" ]]; then
  pass "最近 commit: $RECENT_COMMIT"
  RECENT_COMMIT_SUBJECT=$(git log -1 --pretty=%s 2>/dev/null || true)
  if echo "$RECENT_COMMIT_SUBJECT" | grep -qE '[一-龥]'; then
    pass "最近 commit message 为中文或包含中文"
  else
    fail "最近 commit message 未包含中文：$RECENT_COMMIT_SUBJECT"
  fi
else
  fail "未找到任何 git commit"
fi

# 7. 最近 commit 必须覆盖公开治理账本。
RECENT_FILES=$(git diff-tree --no-commit-id --name-only -r HEAD 2>/dev/null || true)
if echo "$RECENT_FILES" | grep -qE '(^research/project-tracker\.md$|^research/execution-reports/)'; then
  pass "最近 commit 覆盖 project-tracker 或 execution-reports"
else
  fail "最近 commit 未覆盖 research/project-tracker.md 或 research/execution-reports/"
fi

# 8. 最近 commit 不得包含参考项目、缓存、临时日志或 Ralph 机器状态。
if echo "$RECENT_FILES" | grep -qE '(^refer_proj/|^research/reference-repos/.*?/\.git/|(^|/)(node_modules|\.next|dist|build|coverage)/|(^|/).*\.log$|^\.workflow/\.maestro/.*/status\.json$)'; then
  fail "最近 commit 包含禁止提交的文件："
  echo "$RECENT_FILES" | grep -E '(^refer_proj/|^research/reference-repos/.*?/\.git/|(^|/)(node_modules|\.next|dist|build|coverage)/|(^|/).*\.log$|^\.workflow/\.maestro/.*/status\.json$)' || true
else
  pass "最近 commit 未包含 refer_proj、缓存、日志或 Ralph status.json"
fi

# 9. 输出最近 commit 文件，方便人工验收。
info "最近 commit 文件清单："
echo "$RECENT_FILES" | sed 's/^/  - /'

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
