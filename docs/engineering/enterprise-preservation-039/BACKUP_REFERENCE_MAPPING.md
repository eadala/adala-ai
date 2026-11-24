# Backup Reference Mapping (Gate D)

| Source | Destination (private repo) |
|--------|----------------------------|
| `refs/backup/phase-031-8685f64a` | `refs/heads/backup/phase-031-8685f64a` |
| Sanitized future checkpoint (after scrub) | `refs/heads/backup/master-checkpoint` |

**Forbidden names:** `main`, `develop`, `feature/**`, `hotfix/**`, `release/**`, `cursor/**`

Do not push `refs/backup/master-032r-checkpoint` until ancestry no longer reaches CONFIRMED_SECRET blob (filtered export or new scrubbed tip without that commit in ancestry).
