# RLS Policy Inventory

**Method:** Migration source inspection + isolated PG reproduction (agent VM PG 16).  
**Production catalog (`pg_policies`):** **NOT VERIFIED** (`DATABASE_URL` unset).

## Policy families (repo)

| Family | Owner migration | Fail-open empty tenant? | 059 action |
|--------|-----------------|-------------------------|------------|
| `rls_${table}` | 057 | Yes (`coalesce … = ''`) | **Replaced** → nullif + bypass |
| `vault_tenant_isolation` | 056 | Yes (OR empty/NULL) | **Skipped** — REQUIRES ADAPTATION |
| `zta_tenant_isolation_*` | 056 | Uses helper / similar | **Skipped** — REQUIRES ADAPTATION |

## FORCE RLS

057/059: **ENABLE only, no FORCE**. Table owner bypasses RLS unless FORCE — **UNKNOWN** whether production role is owner.

## Application role

`lib/db` uses `DATABASE_URL` Pool — role privileges **NOT VERIFIED** in prod.
