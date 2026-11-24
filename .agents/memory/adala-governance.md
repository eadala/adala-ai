---
name: Adala Governance Framework
description: Frontend quality gate CI script, ESLint architecture lock, web vitals monitoring, and design system registry.
---

## Quality Gate Script (`scripts/governance/quality-gate.sh`)

The script uses `set -euo pipefail`. When `grep` finds no matches it exits with
code 1. In a pipeline `grep ... | wc -l | tr -d ' \n' || echo "0"`:
- With pipefail, grep's exit-1 propagates → `|| echo "0"` fires
- But `wc -l` already emitted "0" to the subshell capture
- Result: "00" (two zeros concatenated) → integer comparison fails

**Fix:** Always wrap grep in a subshell with `|| true`:
```bash
HITS=$( (grep -rl "pattern" dir --include="*.ts" 2>/dev/null || true) | wc -l | tr -d ' \n')
```

## Gate Summary (as of completion)
| Gate | Check | Status |
|------|-------|--------|
| 1 | TypeScript 0 errors | PASS (hard fail) |
| 2 | ESLint 0 errors | PASS (hard fail) |
| 3 | Architecture Lock — no Dialog/DialogContent in pages/features | PASS (hard fail) |
| 4 | No console.log in pages/features | PASS (hard fail) |
| 5 | No debugger statements | PASS (hard fail) |
| 6 | Bundle size ≤ 8MB (raised from 4MB for 80+ page SaaS) | PASS |
| 7 | React Hooks heuristic | WARN only (ESLint gate 2 is authoritative) |
| 8 | img alt accessibility | WARN only |

## ESLint Architecture Lock
`eslint.config.js` bans `Dialog` and `DialogContent` direct imports in
`src/pages/**` and `src/features/**`. Sub-components (DialogHeader/Title/Footer/
Description) are still allowed. Use `AdaptiveDialog` from adaptive/ instead.

**Why:** Prevents accidental use of non-RTL-safe raw Dialog in production pages.

## Metrics / Web Vitals
- `artifacts/adala/src/lib/web-vitals.ts` — `initWebVitals()` called from `main.tsx`
- `artifacts/api-server/src/routes/metrics.ts` — POST `/metrics/vitals` + GET summary
- Router registered at `/metrics` in `api-server/src/routes/index.ts`
- DB table `web_vitals` auto-created on first POST

## Design System Registry
- `src/components/design-system/registry.ts` — component catalog with categories
- `src/pages/platform/design-system.tsx` — live searchable registry page
- Route `/design-system` in App.tsx (ProtectedRoute, lazy loaded)
