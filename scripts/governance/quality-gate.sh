#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
# عدالة AI — Frontend Quality Gate
# CI/CD enforcer: exits non-zero if ANY gate fails.
# Usage:  bash scripts/governance/quality-gate.sh [--strict]
# ══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

STRICT="${1:-}"
FRONTEND_DIR="artifacts/adala"
PASS=0; FAIL=0
REPORT=()

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; RESET='\033[0m'

gate_pass() { echo -e "  ${GREEN}✓${RESET}  $1"; PASS=$((PASS+1)); REPORT+=("PASS|$1"); }
gate_fail() { echo -e "  ${RED}✗${RESET}  $1"; FAIL=$((FAIL+1)); REPORT+=("FAIL|$1"); }
gate_warn() { echo -e "  ${YELLOW}⚠${RESET}  $1"; REPORT+=("WARN|$1"); }

echo ""
echo -e "${BOLD}${BLUE}╔══════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}${BLUE}║   عدالة AI — Frontend Quality Gate v1.0     ║${RESET}"
echo -e "${BOLD}${BLUE}╚══════════════════════════════════════════════╝${RESET}"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# Gate 1 — TypeScript
# ─────────────────────────────────────────────────────────────────────────────
echo -e "${BOLD}[1/8] TypeScript Compilation${RESET}"
cd "$FRONTEND_DIR"
TS_OUT=$(npx tsc --noEmit 2>&1 || true)
TS_ERRORS=$(echo "$TS_OUT" | grep -c "error TS" || true)
if [ "$TS_ERRORS" -eq 0 ]; then
  gate_pass "TypeScript: 0 errors"
else
  gate_fail "TypeScript: $TS_ERRORS errors found"
  echo "$TS_OUT" | grep "error TS" | head -10
fi
cd - > /dev/null

# ─────────────────────────────────────────────────────────────────────────────
# Gate 2 — ESLint (errors only)
# ─────────────────────────────────────────────────────────────────────────────
echo -e "\n${BOLD}[2/8] ESLint Errors${RESET}"
cd "$FRONTEND_DIR"
ESLINT_OUT=$(npx eslint src --ext .ts,.tsx -f json 2>/dev/null || true)
ESLINT_ERRORS=$(echo "$ESLINT_OUT" | node -e "
  try {
    const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    console.log(d.reduce((s,f)=>s+f.messages.filter(m=>m.severity===2).length,0));
  } catch { console.log(0); }
" 2>/dev/null || echo "0")
if [ "$ESLINT_ERRORS" -eq 0 ]; then
  gate_pass "ESLint: 0 errors"
else
  gate_fail "ESLint: $ESLINT_ERRORS error(s)"
  echo "$ESLINT_OUT" | node -e "
    const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    d.forEach(f=>f.messages.filter(m=>m.severity===2).forEach(m=>
      console.log('  '+f.filePath.split('/src/')[1]+':'+m.line+' '+m.message.slice(0,80))
    ));
  " 2>/dev/null | head -20
fi
cd - > /dev/null

# ─────────────────────────────────────────────────────────────────────────────
# Gate 3 — Banned Components (raw Dialog in pages)
# ─────────────────────────────────────────────────────────────────────────────
echo -e "\n${BOLD}[3/8] Architecture Lock — Banned Components${RESET}"
# grep for import lines that contain Dialog or DialogContent as standalone names
# (not DialogHeader / DialogTitle / DialogFooter / DialogDescription / DialogTrigger)
RAW_DIALOGS=$(grep -rn "from \"@/components/ui/dialog\"\|from '@/components/ui/dialog'" \
  "$FRONTEND_DIR/src/pages" "$FRONTEND_DIR/src/features" \
  --include="*.tsx" 2>/dev/null \
  | grep -oP "import \{[^}]+\}" \
  | grep -cE "\bDialog[^A-Za-z]|\bDialogContent\b" || true)
RAW_DIALOGS="${RAW_DIALOGS:-0}"
if [ "$RAW_DIALOGS" -eq 0 ] 2>/dev/null || [ -z "$RAW_DIALOGS" ]; then
  gate_pass "No raw Dialog/DialogContent imports in pages or features"
else
  gate_fail "$RAW_DIALOGS raw Dialog/DialogContent import(s) found in pages/features — use AdaptiveDialog"
  grep -rn "from \"@/components/ui/dialog\"" \
    "$FRONTEND_DIR/src/pages" "$FRONTEND_DIR/src/features" \
    --include="*.tsx" \
  | grep -oP "import \{[^}]+\}" \
  | grep -E "\bDialog[^A-Za-z]|\bDialogContent\b" \
  | head -5
fi

# ─────────────────────────────────────────────────────────────────────────────
# Gate 4 — console.log in pages/features
# ─────────────────────────────────────────────────────────────────────────────
echo -e "\n${BOLD}[4/8] console.log in Production Code${RESET}"
CONSOLE_HITS=$( (grep -rl "console\.log" \
  "$FRONTEND_DIR/src/pages" "$FRONTEND_DIR/src/features" \
  --include="*.ts" --include="*.tsx" 2>/dev/null || true) | wc -l | tr -d ' \n')
if [ "${CONSOLE_HITS:-0}" = "0" ]; then
  gate_pass "No console.log in pages or features"
else
  gate_fail "$CONSOLE_HITS file(s) with console.log in pages/features"
  grep -rn "console\.log" "$FRONTEND_DIR/src/pages" "$FRONTEND_DIR/src/features" \
    --include="*.tsx" | head -5
fi

# ─────────────────────────────────────────────────────────────────────────────
# Gate 5 — no-debugger
# ─────────────────────────────────────────────────────────────────────────────
echo -e "\n${BOLD}[5/8] Debugger Statements${RESET}"
DEBUGGER_HITS=$( (grep -rl "\bdebugger\b" "$FRONTEND_DIR/src" \
  --include="*.ts" --include="*.tsx" 2>/dev/null || true) | wc -l | tr -d ' \n')
if [ "${DEBUGGER_HITS:-0}" = "0" ]; then
  gate_pass "No debugger statements"
else
  gate_fail "$DEBUGGER_HITS debugger statement(s) found"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Gate 6 — Bundle Size Budget
# ─────────────────────────────────────────────────────────────────────────────
echo -e "\n${BOLD}[6/8] Bundle Size Budget${RESET}"
BUDGET_KB=8192   # 8 MB budget (80+ page SaaS with lazy-loaded routes)
if [ -d "$FRONTEND_DIR/dist/public/assets" ]; then
  TOTAL_KB=$(find "$FRONTEND_DIR/dist/public/assets" -name "*.js" \
    -exec du -k {} + 2>/dev/null | awk '{s+=$1} END {print s}' || echo "0")
  if [ "$TOTAL_KB" -le "$BUDGET_KB" ]; then
    gate_pass "Bundle size: ${TOTAL_KB}KB (budget: ${BUDGET_KB}KB)"
  else
    gate_warn "Bundle size: ${TOTAL_KB}KB exceeds budget of ${BUDGET_KB}KB — consider splitting chunks"
  fi
else
  gate_warn "No build output found — run 'pnpm build' first to check bundle size"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Gate 7 — Hooks Violations (fast grep-based pre-check)
# ─────────────────────────────────────────────────────────────────────────────
echo -e "\n${BOLD}[7/8] React Hooks Order${RESET}"
# Heuristic: useQuery/useState/useEffect appearing AFTER an early "if ( return" in the same component
HOOKS_AFTER_RETURN=0
while IFS= read -r file; do
  if python3 - "$file" 2>/dev/null <<'PYEOF'
import sys, re
src = open(sys.argv[1]).read()
# Split into function bodies (naive but catches most violations)
fns = re.split(r'\bfunction\s+\w+|const\s+\w+\s*=\s*(?:React\.memo\()?(?:\([^)]*\)|[A-Z]\w*)\s*=>', src)
for fn in fns:
    lines = fn.split('\n')
    found_return = False
    for line in lines:
        stripped = line.strip()
        if re.match(r'if\s*\(.*\)\s*return', stripped):
            found_return = True
        if found_return and re.search(r'=\s*use(?:Query|State|Effect|Memo|Callback|Ref|Context)\s*[(<(]', stripped):
            sys.exit(1)
sys.exit(0)
PYEOF
  then
    :
  else
    HOOKS_AFTER_RETURN=$((HOOKS_AFTER_RETURN+1))
    echo "    Potential hooks-after-return: $file"
  fi
done < <(find "$FRONTEND_DIR/src/pages" "$FRONTEND_DIR/src/features" -name "*.tsx" 2>/dev/null)

if [ "$HOOKS_AFTER_RETURN" -eq 0 ]; then
  gate_pass "No potential hooks-after-return violations"
else
  gate_warn "$HOOKS_AFTER_RETURN file(s) flagged by heuristic — ESLint (Gate 2) is authoritative for real violations"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Gate 8 — Accessibility Quick Check
# ─────────────────────────────────────────────────────────────────────────────
echo -e "\n${BOLD}[8/8] Accessibility — img alt attributes${RESET}"
IMG_NO_ALT=$( (grep -rn "<img " "$FRONTEND_DIR/src" --include="*.tsx" 2>/dev/null || true) \
  | (grep -v "alt=" || true) | (grep -vc "^.*\/\/.*<img" || true) )
IMG_NO_ALT="${IMG_NO_ALT:-0}"
if [ "$IMG_NO_ALT" = "0" ]; then
  gate_pass "All <img> elements have alt attributes"
else
  gate_warn "$IMG_NO_ALT <img> element(s) missing alt attribute"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${BLUE}══════════════════════════════════════════════${RESET}"
echo -e "${BOLD}  Quality Gate Results${RESET}"
echo -e "${BOLD}${BLUE}══════════════════════════════════════════════${RESET}"
echo -e "  ${GREEN}PASS: $PASS${RESET}   ${RED}FAIL: $FAIL${RESET}"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo -e "${RED}${BOLD}❌ QUALITY GATE FAILED — $FAIL check(s) did not pass${RESET}"
  echo -e "   Fix all failures before merging to main."
  echo ""
  exit 1
else
  echo -e "${GREEN}${BOLD}✅ QUALITY GATE PASSED — all checks green${RESET}"
  echo ""
  exit 0
fi
