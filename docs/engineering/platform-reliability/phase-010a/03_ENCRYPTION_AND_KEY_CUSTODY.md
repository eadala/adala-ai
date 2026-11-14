# Encryption and Key Custody (Draft)

**Status:** POLICY DRAFT — legal/security approval required before 010-B.

## Goals

1. Backup artifacts encrypted at rest in non-prod object storage
2. No plaintext secrets inside dump payloads
3. Credentials never on argv, in git, or in application logs
4. Key access auditable and revocable

## Layers

| Layer | Mechanism | Notes |
|-------|-----------|-------|
| Transport | TLS to R2/S3 endpoint | Required |
| At-rest (provider) | SSE-S3 or SSE-KMS / R2 server-side encryption | Prefer provider SSE for non-prod simplicity |
| At-rest (app-level) | Optional envelope encryption before upload | Only if policy requires app-managed keys; adds key-rotation complexity |
| Filename suffix `.enc` | Intent marker used by `fullBackupKey()` | Does **not** by itself prove encryption |

## Recommended non-prod default

- **Provider SSE** enabled on bucket
- Application uploads raw `pg_dump -Fc` bytes over TLS
- No SSE-C unless operations team already runs customer-managed key process

## Key custody

| Item | Owner | Rule |
|------|-------|------|
| R2 access keys | Platform / SecOps | Stored only in approved secret manager; rotate ≤ 90 days |
| KMS key (if used) | SecOps | Separate from production key material |
| Break-glass | On-call lead | Dual control; logged |
| Developer laptops | N/A | No long-lived non-prod backup keys on developer machines for routine work |

## Forbidden

- Committing keys or dump files
- Logging `R2_SECRET_ACCESS_KEY` / `PGPASSWORD`
- Sharing production encryption keys with non-prod
- Embedding DB passwords inside backup object metadata

## Verification (010-B)

1. Upload synthetic object
2. Confirm bucket default encryption active (provider console / API head)
3. Download and checksum — does not prove encryption alone; pair with provider encryption status evidence
