# 07 — Backup Content Inventory

## Existing bundles (do not delete)

| Artifact | Size | SHA-256 | On public main tip |
|----------|------|---------|-------------------|
| phase-031 bundle | ~39MB | `6238eeb6…888b25f` | NO |
| master-032r checkpoint bundle | ~78MB | `febaa7d9…8c2` | NO |

Reachable blob payload (approx): ~316MB with bundles; ~195MB excluding `.bundle` files.

## Recommended trustworthy scope (smallest complete)

1. `refs/backup/phase-031-8685f64a` → `8685f64a`  
2. Tip of secure-recovery-038 docs + master program ancestry (checkpoint)  
3. Engineering evidence under `docs/engineering/{forensic-git-recovery-032r,source-of-truth-recovery-032r-v3,master-program-032r-037,safe-github-backup-038,secure-recovery-038}` **after scrub**  
4. Required source for Phase 031 product files + migrations through `061`

## Explicit exclusions / scrub before transfer

- `docs/engineering/forensic-git-recovery-032r/evidence/baseline-capture.txt` (token/JWT-shaped content)  
- Claim of Phase 018–030 history (**objects absent**)  
- Optional: omit embedding large `.bundle` blobs into git push; transfer bundles via encrypted channel separately

**BACKUP_ESTIMATED_SIZE:** ~40–80MB lean refs without re-pushing nested bundles; up to ~120MB+ if both bundles included; full object closure larger (~195–316MB blob payload).
