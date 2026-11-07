# Migration 059/060 Compatibility Matrix (A–D)

**Date:** 2026-11-07 (Asia/Riyadh)  
**Evidence DB:** PostgreSQL 16, `adala_rls_repro`, role `adala_app` (NOSUPERUSER, NOBYPASSRLS)  
**Policies under test:** 057-style fail-open `rls_*`, 059 fail-closed `rls_*`, 056 vault+zta, 060 vault fail-closed

## Combinations

| ID | App | Database | Security | Authorized office workflow | Failure modes | Deploy implication |
|----|-----|----------|----------|----------------------------|----------------|--------------------|
| **A** | Existing (empty/`''` clear) | Existing 057 fail-open | **FAIL** — empty tenant sees all rows | Works (including unsafe empty-all) | Cross-tenant leak on unscoped requests | Do not ship as end state |
| **B** | Updated (deny `__unscoped__`, bypass after SA/webhook verify) | Existing 057 fail-open | **PASS** for deny sentinel (0 rows); office match still works | Office-scoped OK; SA/webhook need bypass GUC honored by policy (057 already has `bypass_rls`) | Legacy empty-OR still present if any path still clears to `''` | **Safe app-first** for rls_* if finish never clears to `''` |
| **C** | Updated | 059 (+ 060 for vault) | **PASS** — empty/NULL/`__unscoped__` → 0; office → 1; bypass → all | Office + SA + signed webhook OK | Owner role without FORCE still sees all (prod attribute **UNKNOWN**) | Target end state |
| **D** | Existing (empty clear) | 059 only | **Security PASS** (empty → 0 under 059) | Any workflow that relied on empty=all **breaks** (returns 0) | Operational breakage, not leak | **Avoid** DB-before-app unless downtime accepted; prefer app then 059 |

### Vault/ZTA (056 → 060)

| Scenario | Empty tenant rows | Notes |
|----------|-------------------|-------|
| zta alone (NULLIF) | 0 | Already fail-closed |
| zta + vault fail-open (056) | **2** (OR of PERMISSIVE) | Verified undercut |
| After 060 vault fail-closed | **0** | Smallest fix; 056 untouched |

## Role / FORCE semantics (isolated)

| Actor | RLS enforced? | Result |
|-------|---------------|--------|
| `adala_app` NOBYPASSRLS | Yes | Subject to policies |
| Table owner without FORCE | **No** | Sees all rows |
| FORCE ROW LEVEL SECURITY on table | Yes even for owner | Enforced |

**Production:** app role attributes + FORCE inventory = **NOT VERIFIED** from agent (human preflight).

## Session GUC / pooling

- App uses `set_config(..., false)` (session-scoped) + request middleware deny-default + `res.on("finish")` / Stripe `finally` → `clearTenantSessionFailClosed()`.
- Transaction-local (`is_local=true`) clears on COMMIT (repro confirmed).
- Session clear after bypass confirmed in single-backend repro.
- **Remaining risk:** pool connection mismatch if GUCs set on connection A and queries run on B — mitigated by per-request set + finish clear, but not proven under production pool size. Prefer monitoring + optional future transaction-local privileged blocks.

## Safest release sequence (evidence-backed)

1. Deploy **updated application** (fail-closed GUC + SA/webhook bypass after auth/verify) — combination **B**.
2. Preflight 059 → apply **059**.
3. Preflight 060 → apply **060**.
4. Smoke tenant isolation + SA + Stripe signed webhook.
5. Do **not** apply 059/060 before the app that never clears tenant to `''` and that sets bypass only after SA/webhook verify.

## Rollback / forward-fix

- App rollback after 059/060: empty clear becomes deny (security OK, possible workflow empty-results) — forward-fix app preferred over reversing policies.
- Do not reverse 056/059/060 without DBA plan; vault/zta historical 056 stays as applied history.
