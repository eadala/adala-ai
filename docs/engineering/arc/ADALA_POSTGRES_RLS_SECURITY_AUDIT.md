# PostgreSQL RLS & Connection Pool Security Audit

## Migrations

| Migration | Intent | Status |
|---|---|---|
| 056 | Vault/ZTA RLS + FORCE on listed tables | VERIFIED file; historical empty-OR fail-open documented |
| 057 | Monitoring isolation; **fail-open empty tenant OR** | VERIFIED file |
| 058 | Invitations office_id authority | VERIFIED file present |
| 059 | Replace fail-open `rls_*` with nullif + bypass; **no FORCE** | VERIFIED file + static tests |
| 060 | Fail-closed vault policies | VERIFIED file + static tests |

## Application GUC helpers

`tenantSession.ts`: `__unscoped__`, `setOfficeTenantSession`, `setBypassRlsSession`, `clearTenantSessionFailClosed`.  
`set_config(..., false)` = **session** scope.

`lib/db`: `pg.Pool` shared drizzle pool — **no per-request connection binding**.

## Same-connection adversarial results (local `adala_rls_repro`)

| Test | Result |
|---|---|
| Tenant A reads B | DENY (0 rows) — PASS |
| Tenant A updates B | 0 rows — PASS |
| Tenant A deletes B | 0 rows — PASS |
| Missing / empty / `__unscoped__` | 0 rows — PASS |
| `bypass_rls=on` | sees all — PASS (privileged) |

## Pool containment (CRITICAL)

Command:

```bash
node artifacts/api-server/src/tests/tenantPoolGucContainment.adversarial.mjs
```

Result: after `setBypassRlsSession`-equivalent on a connection and `release()`, subsequent `pool.query` still had `bypass_rls=on` and **count=2 (all tenants)**.

**F-TENANT-POOL-001 CRITICAL** — app middleware `setFailClosedTenantSession` / `clearTenantSessionFailClosed` also use unscoped `db.execute` (random pool connection), so clear may miss the contaminated connection.

## FORCE coverage

059/060 intentionally omit FORCE. Table owners bypass RLS. Production role ownership NOT_TESTED this audit.

## Raw SQL / security-definer

Not exhaustively enumerated — residual UNVERIFIED.

## Follow-up ([Audit Postgres RLS GUC](bc-620965e9-c610-5ca6-959b-5dcfba1d095d))

| Item | Status |
|---|---|
| FORCE only on 056 ZTA (~27 tables) | FAILED (partial) |
| Cron/jobs lack tenant/bypass GUC | FAILED (F-TENANT-CRON-GUC-001) |
| ZTA-only policies lack `bypass_rls` (SA sees 0 under FORCE) | FAILED for privileged ops |
| `adala_tenant_ok` helper not in migrations | NOT_TESTED |
| Prod role inventory | NOT_TESTED this session (local repro DB used for pool leak only) |
