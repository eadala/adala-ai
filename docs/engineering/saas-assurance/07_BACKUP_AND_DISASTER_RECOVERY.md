# Backup & Disaster Recovery

## Configured vs verified

| Item | Status |
|---|---|
| Procedure doc `docs/database/BACKUP_RESTORE_DRILL.md` | EXISTS |
| Live backup mechanism / schedule / retention / encryption | **NOT VERIFIED** |
| Isolated restore drill | **NOT EXECUTED** |
| Measured RTO/RPO | **NOT APPLICABLE** (no drill) |
| App backup module `modules/platform/backup.ts` | Tenant JSON into `backup_jobs` / R2 — not PostgreSQL PITR |
| AgentCron tenant backup | Partial entity JSON (cases/clients/invoices caps) + optional encrypt |
| AgentCron **full** backup | **Stats/counts JSON only** — not a recoverable DB image ([Async backup cost lifecycle](bc-e224a8ab-4d49-57ca-8df5-870eef796b65)) |
| Infra `infra/backup/backup.sh` | `pg_dump \| gzip`, 7-day local retention — encryption not in script |
| DR UI `drCenter.simulateRestoreTest` | Always returns success with **simulated** steps — not a real restore |

## Proposed targets (for human approval)

| Metric | Proposal |
|---|---|
| RPO | ≤ 1 hour (DB); ≤ 24h acceptable only with explicit business sign-off |
| RTO | ≤ 4 hours to read-only restore clone validation |
| Drill cadence | Monthly isolated restore |
| Backup verify | Automated checksum + row-count smoke |

## Findings

| ID | Sev | Finding |
|---|---|---|
| F-DR-001 | **P0** | Isolated restore drill NOT EXECUTED — recoverability BLOCKED |
| F-DR-002 | **P0** | `runFullBackupCron` writes counts only → false DR confidence |
| F-DR-003 | **P0** | `simulateRestoreTest` always `success: true` without restoring data |
| F-DR-004 | **P1** | `deleteBackup` unused → R2 object retention unbounded |

**Release blockers for production GO:** F-DR-001, F-DR-002, F-DR-003. No restore into shared DBs under this directive.
