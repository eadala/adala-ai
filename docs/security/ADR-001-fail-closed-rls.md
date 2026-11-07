# ADR-001 — Fail-closed RLS vs empty `app.current_tenant`

**Status:** **Accepted & Implemented** (Migration **059** + app session helpers)  
**Date:** 2026-11-07 (Asia/Riyadh)  
**Evidence SHA tip:** see git log / PR #138  
**Related:** Root Cause B, Migrations 056/057/059

## Context

Migrations **056** and **057** encoded empty/missing tenant as allow:

```sql
OR coalesce(current_setting('app.current_tenant', true), '') = ''
OR current_setting('app.bypass_rls', true) = 'on'
```

Isolated reproduction (`adala_rls_repro`, role `adala_app`, PG 16):

| Scenario | Rows (fail-open 057) | Rows (fail-closed 059) |
|----------|----------------------|-------------------------|
| Missing tenant | 2 (A+B) | 0 |
| Empty `''` | 2 | 0 |
| `office-a` | 1 | 1 |
| `__unscoped__` sentinel | 0 | 0 |
| `bypass_rls=on` | 2 | 2 |

## Decision

**Option C — Combined defense-in-depth**

1. **Application:** Default session GUC to `__unscoped__` + `bypass_rls=off`; office routes set office id; Super Admin & signed Stripe webhook set `bypass_rls=on`; response finish restores deny sentinel (never `''`).
2. **Database:** Migration **059** replaces fail-open `rls_*` policies with `nullif` + bypass only. Skips vault/zta (056) for separate follow-up.
3. **No FORCE RLS** in 059 (table-owner semantics unchanged — document remaining risk if app connects as owner).

## Rejected alone

- **App-only sentinel without 059:** Fresh connections still fail-open under coalesce-empty until first middleware; policy itself remains unsafe.
- **Policy-only without app bypass:** Super Admin / webhooks / jobs break when empty OR removed.

## Rollback

- App: revert to previous middleware / clear-to-empty (not recommended).
- DB: restore prior `rls_*` policy defs from Migration 057 backup; no automatic down migration.

## Production

Apply **059** only after backup + approval. Coordinate deploy so app version with bypass + fail-closed clear is live **before or with** 059.
