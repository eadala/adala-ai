# Non-Production Backup Bucket Specification

**Status:** SPEC ONLY — do not create or attach until 010-B approval.

## Bucket

| Property | Spec |
|----------|------|
| Proposed name | `adala-backups-nonprod` (exact name subject to org naming) |
| Provider | Cloudflare R2 (preferred; aligns with existing `cloudflare_r2` provider) or S3-compatible equivalent |
| Environment | Non-production only; **never** share with production bucket |
| Public access | Disabled (no public ACL, no public bucket policy) |
| Prefix layout | `backups/full/` (logical dumps), `backups/tenants/{tenantId}/` (snapshots if used), `backups/evidence/` (optional drill metadata) |
| Object naming | `backups/full/full-{unixMs}.dump.enc` (matches `fullBackupKey()`) |
| Versioning | Recommended ON for non-prod drills |
| Object Lock / immutability | Optional for non-prod; if enabled use governance mode with short retention for cost control |
| CORS | Not required for server-side backup path |
| Lifecycle | See `04_RETENTION_AND_LIFECYCLE.md` |

## Network

- Application upload from non-prod runtime only (private credentials)
- No browser-direct public upload of backups
- Egress allowlist for non-prod runners if applicable

## Isolation rules

1. Separate account or at minimum separate bucket from production
2. Separate credentials from production
3. Synthetic / disposable data only for first drills
4. No production database dumps into non-prod bucket without legal/security approval

## Application config (activation-time env — not set in 010-A)

```
STORAGE_PROVIDER=cloudflare_r2
R2_BUCKET_NAME=adala-backups-nonprod
R2_ENDPOINT=<nonprod-endpoint>
R2_ACCESS_KEY_ID=<from-secret-store>
R2_SECRET_ACCESS_KEY=<from-secret-store>
ADALA_BACKUP_ARTIFACT_DIR=<local scratch before upload>
ADALA_BACKUP_RETENTION_DAYS=30
```

Local emulator remains available via `STORAGE_PROVIDER=local` for CI.
