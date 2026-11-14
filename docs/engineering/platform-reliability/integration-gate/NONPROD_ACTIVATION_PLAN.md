# Non-Production Backup Storage Activation Plan

**Status:** PLAN ONLY — human approval required. No live storage contacted.

1. **Permissions:** dedicated non-prod R2 (or S3) bucket; write/list/get/delete limited to `backups/` prefix; no public ACL.
2. **Test bucket isolation:** `adala-backups-nonprod` separate from production.
3. **Credentials:** short-lived keys in secret store; never in git/logs/argv.
4. **Encryption:** SSE-C or provider SSE-S3/SSE-KMS as approved; document key custody.
5. **Retention:** e.g. 30 daily logical dumps + lifecycle expire; no customer document deletion.
6. **Restore procedure:** download → checksum → disposable `adala_restore_*` → validate → destroy target.
7. **Cleanup:** expire orphans under `backups/full/`; retain evidence logs.
8. **Cost estimate (assumptions):** 30 × 5 GB dumps ≈ 150 GB-month + egress on restore drills; refine after measuring dump size.
9. **Approvals required:** platform owner, security, finance (budget), legal (retention).
10. **Explicit non-goals:** production cutover, ARC deploy, PITR enablement.
