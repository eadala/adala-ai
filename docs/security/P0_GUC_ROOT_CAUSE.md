# P0 GUC Root Cause — Privileged Context Leak on Pool Reuse

**Date:** 2026-11-07 (Asia/Riyadh)  
**Frozen RC:** `b3d9a0afd1b45486296910827824363bd9ed6810`  
**Hotfix branch:** `cursor/security-p0-guc-containment-da81`

## Reachable failure path

1. Application uses `pg.Pool` + Drizzle (`lib/db`) — each `db.execute` / `pool.query` is a short checkout.
2. `set_config('app.bypass_rls','on', false)` is **session-scoped** on the PostgreSQL backend.
3. Privileged code (`setBypassRlsSession`) ran `set_config` on checkout A, then released A **without** guaranteed same-connection clear.
4. A later ordinary checkout reusing backend A inherited `bypass_rls=on`.

## Evidence (isolated, real `pg.Pool`)

| Step | Result |
|------|--------|
| Baseline: set bypass, release, reuse same `pg_backend_pid` | `count(*)=2` (all offices) |
| After containment scopes | bypass scope sees 2; next unbound query sees `0` |

Command: `pnpm --filter @workspace/api-server run test:guc-pool-containment-p0`

## Classification

| Kind | Verdict |
|------|---------|
| Theoretical PG behavior | Session GUCs stick — confirmed |
| Reachable application vulnerability | **Yes** — drizzle short checkout + session `set_config` |
| Already mitigated before hotfix | Partially (finish/`finally` clear) — **not connection-accurate** |
| Unverified prod role BYPASSRLS | Separate catalog risk — NOT VERIFIED |

## Affected execution boundary

`@workspace/db` pool + `tenantSession` GUC helpers + SA/office middleware + Stripe `bufferAndProcess` after signature verify.
