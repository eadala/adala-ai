# Backup Transfer Plan — STOP BEFORE PUSH

| Field | Value |
|-------|-------|
| SOURCE_REPOSITORY | local `/agent/repos/adala-ai` |
| DESTINATION_REPOSITORY | `eadala/adala-ai-secure-backup` (**must exist + private verified**) |
| SOURCE_REF | `refs/backup/phase-031-8685f64a` → `8685f64a…` |
| DESTINATION_REF | `refs/heads/backup/phase-031-8685f64a` |
| SCOPE | Phase 031 ancestry only |
| EXCLUDES | contaminated HEAD, master checkpoint, baseline-capture, unreviewed forensic |
| EST_SIZE | ~39MB (clean bundle) |
| SECRET_SCAN | Phase 031 clean of confirmed secret |
| TRANSFER_AUTHORIZATION | **NO** |

## Exact commands (do not run until approved + dest private)

```bash
git remote add backup-origin git@github.com:eadala/adala-ai-secure-backup.git
# or HTTPS with non-exposed credential
git push backup-origin 8685f64a6ddb4d983f030b8c1b7b6e1607c6dc6b:refs/heads/backup/phase-031-8685f64a
git ls-remote backup-origin 'refs/heads/backup/phase-031-8685f64a'
```

Rollback: delete remote branch `backup/phase-031-8685f64a` only. Never touch public origin.

**BACKUP_READY_FOR_TRANSFER_APPROVAL** blocked until PRIVATE_REPOSITORY_VERIFIED.
