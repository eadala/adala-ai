# Backup / Restore Drill

| Item | Status |
|------|--------|
| Backup mechanism (Coolify/Hetzner/pg_dump) | **NOT VERIFIED** |
| Frequency / retention / encryption | **NOT VERIFIED** |
| Isolated restore drill | **NOT EXECUTED** |
| RTO / RPO measured | **NOT APPLICABLE** (no drill) |

## Required human actions

1. Identify backup store and encryption key custody.  
2. Restore latest backup to an **isolated** PostgreSQL instance (never overwrite production).  
3. Verify schema (053–057 objects) + sample office rows.  
4. Point a staging app at the restore and smoke-test login.  
5. Record wall-clock restore duration (RTO) and backup age (RPO).

**Recoverability is BLOCKED until a successful isolated drill is evidenced.**
