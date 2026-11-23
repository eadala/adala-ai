# 13 — Continuous Engineering Preservation Protocol

Each future phase checkpoint records:

Phase ID, Branch, Commit SHA, Tree SHA, Parents, Migrations, Tests, Security findings, Approval, Backup ref, Bundle checksum, Off-env backup status, Restore verification status.

## Status vocabulary

| Status | Meaning |
|--------|---------|
| LOCAL_CHECKPOINT_VERIFIED | Local ref + optional local bundle restore OK |
| EXTERNAL_BACKUP_VERIFIED | Private remote/object store holds objects; checksums match |
| DISASTER_RECOVERY_TESTED | Off-environment restore into disposable repo verified |

Do not mark EXTERNAL or DR from local-only evidence.
