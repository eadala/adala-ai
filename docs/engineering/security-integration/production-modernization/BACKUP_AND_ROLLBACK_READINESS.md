# Backup and Rollback Readiness

## Production backup evidence

| Item | Status |
|---|---|
| Frequency / last success / retention / off-server / encryption | **UNVERIFIED** |
| Last restore drill | **UNVERIFIED** (docs mark often UNVERIFIED) |
| RPO/RTO | Treat as **UNVERIFIED** until operator attests |

## Rollback layers

| Layer | Method | Limitation |
|---|---|---|
| Application / container | Coolify redeploy previous image | Needs known prior digest |
| Git | Revert PR commits on branch then redeploy | Does not undo DB DDL/data |
| Schema | Forward-fix migrations preferred | 053–057 may be hard to reverse |
| Data | Restore from backup only with human approval | Requires proven backup |

**Do not assume git rollback restores DB state.**
