# Backup Architecture

## Strategy selected

**Logical backups via `pg_dump --format=custom` (`-Fc`).**

Rationale: smallest architecture matching local/dev topology and modular monolith; compatible with disposable restore verification; no new infrastructure required.

**Not claimed:** point-in-time recovery, continuous WAL archiving, or complete platform backup.

## State machine

`SCHEDULED → RUNNING → CAPTURED → UPLOADED → VERIFIED → COMPLETED`

Failures: `FAILED_CAPTURE | FAILED_UPLOAD | FAILED_VERIFICATION | EXPIRED`

COMPLETED is only set after format validation + SHA-256 checksum. Cron callback execution alone never marks COMPLETED.

## Implementation

- Module: `artifacts/api-server/src/reliability/backup/pgDumpBackup.ts`
- Cron wiring: `artifacts/api-server/src/cron/agentCron.ts` → `createLogicalBackup`
- Credentials: `PGPASSWORD` env to child process (not argv); never logged
- Overlap prevention: in-process `running` Set keyed by database name
- Artifacts: `ADALA_BACKUP_ARTIFACT_DIR` (local emulator path for tests)
- Optional upload adapter hook for private object storage (not contacted live)

## Retention / cost (proposal)

- Keep last N verified dumps + age-based EXPIRED marking (configurable)
- Estimate (assumption): 1 full dump/day × 30 days × avg DB size; object-storage lifecycle for cold tier
- No automated customer/legal document deletion introduced
