# IAM and Credential Handling (Draft)

**Status:** SPEC ONLY — no credentials issued in 010-A.

## Principle of least privilege

Non-prod backup identity may:

- `PutObject`, `GetObject`, `HeadObject`, `ListBucket` (prefix-limited), `DeleteObject` on `backups/*` only

Non-prod backup identity must **not**:

- Access production buckets
- Broad `s3:*` on `*`
- Manage IAM users/keys
- Disable encryption or public-access blocks

## Proposed policy shape (illustrative)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ListBackupPrefix",
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": ["arn:aws:s3:::adala-backups-nonprod"],
      "Condition": { "StringLike": { "s3:prefix": ["backups/*"] } }
    },
    {
      "Sid": "ObjectRWBackupsOnly",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:HeadObject"],
      "Resource": ["arn:aws:s3:::adala-backups-nonprod/backups/*"]
    }
  ]
}
```

(Adapt ARN/actions to Cloudflare R2 token model as applicable.)

## Credential lifecycle

1. Create non-prod token in provider console / Terraform (out of band)
2. Store in team secret manager under `adala/nonprod/r2-backup`
3. Bind to non-prod runtime only at 010-B
4. Rotate after first successful drill and on personnel change
5. Revoke immediately on leak suspicion

## Application rules (already aligned)

- `uploadBackup` / R2 provider use env credentials — never CLI argv in cron
- Local tests use `STORAGE_PROVIDER=local` without cloud secrets
