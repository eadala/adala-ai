# Non-Prod Restore Runbook (Draft for 010-B)

**Do not execute against production.** Disposable targets only (`adala_restore_*`).

## Preconditions

- [ ] 010-A approvals complete
- [ ] Non-prod bucket + credentials available
- [ ] Disposable Postgres restore host (not shared prod)
- [ ] `ADALA_RESTORE_ALLOW=1` set only for the drill session
- [ ] Synthetic source data preferred for first drill

## Procedure

1. **Select artifact** — latest successful `backups/full/full-*.dump.enc` from non-prod bucket (or synthetic upload from 010-B step 1).
2. **Download** to scratch path via `downloadBackup(key)`.
3. **Verify** SHA-256 / custom-format header (`verifyBackupChecksum`).
4. **Create disposable DB** matching `adala_restore_*` naming.
5. **`pg_restore`** into disposable DB.
6. **Validate** schema markers / row counts / integrity SQL.
7. **Record** duration, backup age, outcome (`PASS|FAIL`).
8. **Destroy** disposable DB and local scratch; retain evidence JSON only.
9. **Never** leave `ADALA_RESTORE_ALLOW=1` in standing production config.

## Failure handling

| Failure | Expected |
|---------|----------|
| Missing object | FAIL nonzero |
| Checksum mismatch | FAIL — quarantine key |
| Unsafe DB name | FAIL — abort |
| Partial restore | FAIL — drop disposable DB |

## Success criteria (010-B)

- Synthetic upload succeeds
- Download + checksum succeed
- Isolated restore `PASS`
- Evidence attached under phase-010b evidence (future)
