# Database and RLS Release Validation

## Migration sequence (repo)

Present under `artifacts/api-server/migrations/`: `001`, `005`, `007`, `008`, `024`, **053–057** (security/RLS/platform runtime). Historical note: 053–060 family — **053–057 VERIFIED in tree**; 058–060 **not found** in this workspace listing.

## Compatibility

| Item | Status |
|---|---|
| Main tip includes 053–057 | VERIFIED (main message history / files) |
| Prod applied revision | **UNVERIFIED** |
| Cohesion RC adds numbered migrations | No dedicated 058+ in selected PRs |
| Rollback of runtime DDL | Limited — git revert ≠ DROP |

## Adversarial suite (disposable DB)

| Test | Result |
|---|---|
| Office A/B isolation, missing/invalid tenant, pool reuse, concurrent, privileged, rollback, jobs | **NOT_RUN** |

**Blocker:** No disposable PostgreSQL (`DATABASE_URL` unset; no docker DB provisioned in this run).

## GUC / pool

`requireAuth` still uses `set_config(..., false)` on develop/RC until #139 lands. **G9 remains NOT_RUN / FAIL for full containment claim.**
