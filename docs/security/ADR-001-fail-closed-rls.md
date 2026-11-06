# ADR-001 — Fail-closed RLS vs empty `app.current_tenant`

**Status:** Proposed — **not implemented** in this recovery batch  
**Date:** 2026-11-07 (Asia/Riyadh)  
**Related:** Root Cause B, Migrations 056/057

## Context

Migrations **056** and **057** deliberately encode:

```sql
OR coalesce(current_setting('app.current_tenant', true), '') = ''
OR current_setting('app.bypass_rls', true) = 'on'
```

`app.ts` clears the session GUC to `''` after each response for pool hygiene. Combined with `requireAuth`-only handlers, empty tenant becomes fail-**open** under RLS.

## Decision (this recovery)

**Do not** rewrite applied 056/057 policies in PR #138 without:

1. Isolated database verification of every table with `rls_*` / `vault_*` / `zta_*`.
2. Explicit Super Admin / cron / Stripe webhook / heal paths setting `app.bypass_rls=on` (not empty tenant).
3. Human approval for production migration apply.

Changing `app.ts` clear from `''` to a deny sentinel **without** the above breaks Super Admin and any job that currently relies on empty-tenant OR-bypass.

## Interim controls (implemented / retained)

- Application query scoping + `requireAuthWithTenant` on verified aggregators (SEC-001).
- Invitation office ownership via Migration **058** + API filters (SEC-005).
- Contract tests for notifications / invitations.
- Document empty-tenant as known defense-in-depth gap until 059+.

## Future migration sketch (approval required)

New migration (e.g. **059**): replace empty-tenant OR with require `bypass_rls=on` for privileged access; DROP/CREATE policy only after readiness inventory; pair with app changes setting bypass for SA/system roles and a non-empty deny sentinel on request finish.

## Rollback

N/A — ADR only; no schema change from this document.
