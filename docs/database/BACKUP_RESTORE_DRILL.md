# Backup / Restore Drill — Production Preflight

**Status:** Procedure prepared. Live mechanism and drill = **NOT VERIFIED** from agent (no production backup access).

| Item | Status |
|------|--------|
| Backup mechanism (Coolify/Hetzner/pg_dump) | **NOT VERIFIED** |
| Frequency / retention / encryption | **NOT VERIFIED** |
| Isolated restore drill | **NOT EXECUTED** |
| RTO / RPO measured | **NOT APPLICABLE** (no drill) |

## Backup source (human fill)

| Field | Value |
|-------|-------|
| Source system | Coolify scheduled job / Hetzner snapshot / `pg_dump` cron _(circle one)_ |
| Location | _(bucket/path — no secrets)_ |
| Encryption | at-rest key custody _(name of KMS/secret, not value)_ |
| Retention | _(e.g. 7/30/90 days)_ |
| Last successful backup timestamp (Asia/Riyadh) | _(operator)_ |

## Isolated restoration procedure (never overwrite production)

1. Provision a **new** PostgreSQL instance (staging / ephemeral VM).
2. Restore latest backup into that instance only:

```bash
# Example shapes — adapt to actual backup format after human identifies source.
# Custom format:
pg_restore --clean --if-exists --no-owner --dbname="$RESTORE_DATABASE_URL" /path/to/backup.dump
# Plain SQL:
psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -f /path/to/backup.sql
```

3. **Data integrity checks** (on restore clone):

```sql
SELECT current_database(), now() AT TIME ZONE 'Asia/Riyadh';
SELECT COUNT(*) AS offices FROM offices;
SELECT COUNT(*) AS cases FROM cases;
SELECT COUNT(*) AS clients FROM clients;
SELECT COUNT(*) AS invitations FROM invitations;
-- Migration inventory (adjust ledger table to prod reality):
-- SELECT * FROM schema_migrations ORDER BY 1;
```

4. Run read-only RLS inventory on clone: `scripts/db/prod-rls-role-inventory.sql`.
5. Optional: point a **staging** API at the clone; smoke login (no production secrets reuse in unsecured env).
6. Record wall-clock restore duration (**RTO**) and backup age (**RPO**).

## Recovery / rollback strategy

| Event | Action |
|-------|--------|
| Bad app deploy, DB unchanged | Redeploy previous Coolify image/tag |
| Failed migration mid-apply | Stop; DBA decide forward-fix vs restore **clone lessons** then plan; production restore only with explicit approval |
| Post-059/060 app regression | Forward-fix app; avoid reversing RLS policies |
| Data corruption suspicion | Restore to isolated clone first; cutover only with approval |

## Required human actions

1. Identify backup store and encryption key custody.  
2. Execute isolated restore drill; attach evidence (timestamps Asia/Riyadh, row counts).  
3. Confirm retention meets policy.  

**Recoverability remains BLOCKED until a successful isolated drill is evidenced.**
