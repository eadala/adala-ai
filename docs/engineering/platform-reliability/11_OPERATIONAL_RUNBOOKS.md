# Operational Runbooks (Local / Pre-Prod)

## Run local reliability harness

```bash
cd artifacts/api-server
# Requires local PostgreSQL; adala_app CREATEDB recommended for disposable DBs
pnpm run test:platform-reliability
```

## Manual logical backup

Set `DATABASE_URL` and `ADALA_BACKUP_ARTIFACT_DIR`, then invoke `createLogicalBackup` (or wait for cron with wiring).

## Isolated restore drill

Set:

- `ADALA_BACKUP_ARTIFACT_DIR`
- `ADALA_RESTORE_DATABASE_URL` (must be `…/adala_restore_*`)
- `ADALA_RESTORE_ADMIN_URL`
- `ADALA_RESTORE_ALLOW=1`

Then call DR test endpoint or `verifyIsolatedRestore`.

## Probe checks

- Liveness: `GET /api/healthz` → 200
- Startup: `GET /api/startupz` → 200 after boot
- Ready: `GET /api/readyz` → 200 only when DB+config+startup OK
