# Final Release Candidate Security Closure

Evidence time: 2026-11-13 (Asia/Riyadh). **No push of RC, merge, or production change.**

## Decision

**RC_SECURITY_READY_FOR_REVIEW**

Technical P0 GUC containment is integrated into the local candidate and validated on disposable PostgreSQL. Production upgrade remains blocked separately by Coolify identity / backups / independent review.

## Candidate identity

| Field | Value |
|---|---|
| Prior RC (pre-GUC) | HEAD `5ca2a2e931b859ed36b51eed75fd3e03cda509c7` TREE `bd9e3750…` |
| **Closed RC (with GUC)** | HEAD `8f3c79357808f7c8d149e265e0f2bd4bb2d43422` TREE `14a92d2c3c96256910a581bf919df49d9e905452` |
| Branch (local only) | `cursor/rc-guc-closure-da81` @ `/tmp/security-integration/rc-guc-wt` |
| Remote push of RC | **Not pushed** |
| Frozen RC tree | `cd84a7f277c481dc5c96d707dde4e78d7f18e713` unchanged |

## PR #139 analysis

| Item | Finding |
|---|---|
| Head | `ad113dc56b09…` base recovery branch |
| Invariant | Pin PoolClient per ALS scope; route pool.query; fail-closed GUCs on release; request-lifetime office/bypass |
| RLS | Complements FORCE RLS; stops sticky bypass/tenant across pool reuse |
| Migrations for GUC helpers | None required in #139 itself |
| Compatibility | develop RC lacked `tenantSession.ts` / used inline `set_config` — **ported** onto RC |
| Stripe | Bypass scope after `constructEvent` |

## Disposable PostgreSQL GUC/RLS results

PostgreSQL 16 `adala_rls_repro`, role `adala_app` (NOBYPASSRLS), FORCE RLS fail-closed, fixtures office-a/b.

Harness exit **0**:

- Baseline sticky bypass leak PASS (count=2)
- T1 privileged→normal reuse PASS (0)
- T2 Office A/B PASS
- T3 exception safety PASS
- T6 concurrency PASS
- T7 empty/`__unscoped__` PASS
- Unbound after privileged PASS
- Nested BEGIN/ROLLBACK PASS

## Other validation

| Check | Result |
|---|---|
| Cohesion guards (17) | PASS exit 0 |
| GUC runtime | PASS exit 0 |
| `tsc` worktree | BLOCKED (missing `@types/node` typeRoots) |
| Monorepo build / audit / full suite | NOT_RUN |
| Migrations 058–060 on disposable | NOT_RUN (recommended before prod with recovery track) |

## Production identity / backups

**UNVERIFIED** (Coolify inaccessible).

## Remaining non-code blockers for production upgrade

1. Independent review of closed RC  
2. Coolify SHA/digest/branch/Auto Deploy attestation  
3. Backup/restore proof  
4. CI typecheck/build green on pushed branch  

## Next safe action

Authorize a human-reviewed push of `cursor/rc-guc-closure-da81` (or equivalent) as a PR to `develop` — Auto-merge OFF; no Coolify deploy until identity + backup gates clear.
