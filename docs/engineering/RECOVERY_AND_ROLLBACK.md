# Recovery and Rollback — Adalah AI

## Recovery matrix

| Layer | What is restored | Mechanism | Status |
|-------|------------------|-----------|--------|
| L1 Git source | Code, history, tags | Protected branches + annotated tags + optional mirror | Partial — tags/process documented; prod SHA UNVERIFIED |
| L2 Application | Running container/app | Coolify redeploy previous image/SHA | Operator checklist — UNVERIFIED live |
| L3 PostgreSQL | Tenant data | Backups + restore drill | See `docs/database/BACKUP_RESTORE_DRILL.md` — often UNVERIFIED |
| L4 Infrastructure | VM / disk | Hetzner snapshots | UNVERIFIED without operator evidence |

## Objectives (targets — tune with ops)

| Metric | Target (initial) | Notes |
|--------|------------------|-------|
| RPO | ≤ 24h (DB) | Until verified backup cadence exists, treat as **UNVERIFIED** |
| RTO | ≤ 4h (app rollback without DB reverse) | DB reverse migrations may exceed RTO |
| Backup ownership | Platform owner + Coolify/Hetzner operator | Named in ops runbook |
| Restore authorization | Explicit human approval | No autonomous destructive restore |

## Application rollback (no DB reverse)

1. Identify last **known-good deployed SHA** (Coolify / host evidence — not a guess).
2. Redeploy that image/SHA via Coolify manual deploy.
3. Verify health endpoints and auth smoke checks.
4. Record incident + SHA in release notes.

```bash
./scripts/release/recovery-inspect.sh <known-good-sha>
```

## Rollback that touches migrations

If the bad release added migrations:

1. **Stop.** Do not `migrate down` in production without DBA review.
2. List migrations introduced since known-good:

```bash
./scripts/release/verify-release.sh --migrations <known-good> <bad>
```

3. Prefer forward-fix migrations over destructive rollback.
4. Restore from backup only with authorization + isolated restore test first when possible.

## Git revert (source only)

```bash
git revert --no-edit <sha>   # on a short-lived branch
# PR → develop or main per policy
```

Never force-push to rewrite shared history to “undo” a release.

## What this framework does **not** do

- Does not execute production backup restore.
- Does not drop databases.
- Does not change Coolify Auto Deploy.
- Does not claim current production SHA without independent verification.
