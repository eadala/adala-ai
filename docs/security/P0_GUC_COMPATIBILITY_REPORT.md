# P0 GUC Compatibility Report

## Preserved

| Area | Status |
|------|--------|
| Public HTTP APIs | Unchanged |
| Migrations 058/059/060 | Untouched |
| App-level `WHERE` tenant filters | Unchanged (still primary for many routes) |
| Stripe signature gate | Still before any bypass |
| Super Admin Clerk check | Still before bypass scope |
| Deny sentinel `__unscoped__` | Preserved |

## Behavioral changes (intentional)

| Change | Impact |
|--------|--------|
| GUC setters require pinned scope | Callers must use `runWith*DbScope*` (middleware/Stripe updated) |
| HTTP auth holds one pool client until response end | Slightly higher pool occupancy under concurrency; default pool max usually sufficient |
| Unbound `pool.query` fail-closed checkout | Ambient queries no longer inherit sticky GUCs |

## Focused regressions run

| Test | Result |
|------|--------|
| guc-pool-containment-p0 | **PASS** |
| rls-fail-closed-059 | **PASS** |
| vault-rls-060 | **PASS** |
| notifications-tenant | **PASS** |

## Performance

No formal load bench in this hotfix. Pin-per-request adds one checkout hold for authenticated tenant/SA routes (same order as typical request-scoped connection patterns). No evidence of exhaustion in unit isolation with `max: 4`.
