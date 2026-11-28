# RLS and Pool Containment Validation

## Static architecture — VERIFIED

| Control | Location | Observation |
|---|---|---|
| Session GUC set | `requireAuth.ts` | `set_config('app.current_tenant', …, false)` — **session-scoped** |
| Middleware GUC | `tenantMiddleware.ts` | `set_config(..., false)` |
| Clear on exit | `app.ts` | clears `app.current_tenant` to `''` (best-effort) |
| RLS enable/force | `security/rls-migration.ts`, `monitoring/isolation.ts`, `dataVault.ts` | ENABLE/FORCE RLS + bypass GUC patterns |
| Baseline SQL | `artifacts/api-server/migrations/001_tenant_isolation.sql`, `lib/db/drizzle/0000_baseline.sql` | Present |

## Adversarial tests (required by mandate)

| Test | Result |
|---|---|
| 1 Missing tenant | **NOT_RUN** (no disposable DB) |
| 2 Invalid tenant | **NOT_RUN** |
| 3 Office A then B on reused connection | **NOT_RUN** — critical for session GUC `false` |
| 4 Concurrent cross-office | **NOT_RUN** |
| 5 Privileged then ordinary query | **NOT_RUN** |
| 6 Rollback + reuse | **NOT_RUN** |
| 7 Unscoped query attempts | **NOT_RUN** |
| 8 Unauthorized service-role | **NOT_RUN** |

## Related open fix

PR **#139** (`ad113dc56b09…`) — P0 GUC containment on recovery base. Must be validated on its own stack; **not** included in cohesion integration candidate.

## Gate G6

**NOT_RUN** → cannot PASS. Blocks production authorization; does not by itself invalidate cohesion static merge readiness.
