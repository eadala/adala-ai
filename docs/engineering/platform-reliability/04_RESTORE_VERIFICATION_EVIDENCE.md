# Restore Verification Evidence

## Finding OPS-P0-02

- **Implementation:** `artifacts/api-server/src/reliability/dr/restoreVerify.ts`
- **Safeguards:** target DB name must match `adala_restore_`; blocklist for production-like names; `ADALA_RESTORE_ALLOW=1` required.
- **Flow:** checksum → CREATE disposable DB → `pg_restore` → extensions/schema checks → integrity marker SQL → DROP disposable DB.
- **Post-fix:** `ISOLATED_RESTORE` PASS (~35ms local synthetic); integrity marker `adala-reliability-008`.
- **Negatives:** corrupted artifact FAIL exit 5; missing artifact FAIL; `production_db` rejected.
- **Evidence:** `evidence/restore-record.json`, `evidence/harness-report.json`
- **Closure:** CLOSED (local)
