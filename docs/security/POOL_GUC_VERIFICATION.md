# Connection Pool × Tenant GUC Verification

**Date:** 2026-11-07 (Asia/Riyadh)  
**Environment:** Isolated PostgreSQL 16, database `adala_rls_repro`, role `adala_app` (NOSUPERUSER, NOBYPASSRLS)  
**Access layer under test:** `pg.Pool` (same library as `lib/db` → `drizzle(pool)`)  
**Policy:** Migration 059-style fail-closed + FORCE enabled on repro table

## Application pattern (code)

- `set_config(..., is_local=false)` session GUCs via `db.execute` (`tenantSession.ts`).
- Per-request: middleware deny-default; office / SA / Stripe elevate; `res.on("finish")` / Stripe `finally` → `clearTenantSessionFailClosed()`.
- Drizzle does **not** pin a client for the full request: each `db.execute` may checkout a different pool connection.

## Results

| ID | Scenario | Result | Status |
|----|----------|--------|--------|
| T1 | Same held client: set office-a → SELECT | 1 row | **PASS** |
| T3 | Concurrent held clients Office A vs B | A=`a`, B=`b` | **PASS** |
| T4 | Bypass on then off, same client | 2 → 0 | **PASS** |
| T5 | Bypass set, release, reuse same backend **without** clear | 2 rows | **FAIL** (sticky session GUC) |
| T7 | Exception after bypass, no clear, reuse | 2 rows | **FAIL** without finally |
| T6/T8 | Cross-checkout / clear may hit different backends | Non-deterministic | **LIMITATION** |
| Cross A/B held | set on A does not affect B | A=1, B=0 | Expected |

## Interpretation

1. **When a client is held** for set+query+clear, tenant isolation and bypass cleanup work.
2. **Without clear**, bypass (and office GUC) **leak on connection reuse** — proven.
3. App mitigations (`finish` / Stripe `finally`) reduce risk; they are **best-effort** under pooled short checkouts because clear may not touch the backend that still holds bypass.
4. Application `WHERE office_id = …` remains the **primary** authorization layer; RLS GUCs are defense-in-depth, not a single point of trust under the current pool model.

## Production implication

| Classification | Verdict |
|----------------|---------|
| Concurrent Office A/B with held semantics | **PASS** (isolated) |
| Bypass cleanup reliability under pool | **PASS WITH LIMITATIONS** |
| Unexpected global BYPASSRLS role attribute | Separate catalog check — **NOT VERIFIED** on prod |
| Code change required before merge? | **No** (known architecture; redesign = client pinning / transaction-local GUCs — needs approval) |
| Production blocker? | **No** for merge if app WHERE + finish clear remain; **CONDITIONAL** for go-live — recommend short maintenance / low traffic during 059/060 cut + monitor |

## Recommended follow-up (human-approved only)

- Pin one pool client per request for GUC set → queries → clear, **or**
- Use `set_config(..., true)` inside an explicit transaction wrapping the request/job, **or**
- `pool.on('connect')` deny-default + discard on release.

Do **not** implement without explicit approval (scope: connection lifecycle redesign).
