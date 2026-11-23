# Proposed Backup Architecture

## Recommended destination (preferred)

1. **Private** GitHub repository (new), e.g. `eadala/adala-ai-engineering-backup` — `private: true`
2. OR encrypted object storage for bundles only (separate approval)
3. Do **not** treat the current **public** `eadala/adala-ai` as the durable private backup unless the owner explicitly accepts public archival of these tips + large bundles

## Reference strategy (isolation from deploy/CI)

Push **custom refs** (not under `refs/heads/cursor/**`):

```
refs/backup/phase-031-8685f64a
refs/backup/master-032r-checkpoint
```

Optional annotated tags under `refs/tags/backup/...` only after confirming Coolify/tag hooks are off.

Avoid creating `refs/heads/cursor/backup-*` (matches CI `cursor/**`).

If a branch tip is required for GitHub UI:

```
refs/heads/backup/phase-031-8685f64a
refs/heads/backup/master-032r-checkpoint
```

These do **not** match the CI `cursor/**` filter. Still verify Coolify does not watch `backup/**`.

## Branch protection (private backup repo)

- Restrict force-push on `backup/**` and `refs/backup/*` (via rulesets if available)
- Require admin for deletion
- Disable GitHub Pages / Actions deploy environments if unused
- Limit write access to owners only

## Independent Git bundles (already local)

| Artifact | SHA-256 | Notes |
|----------|---------|-------|
| `.../phase-031-8685f64a.bundle` | `6238eeb67de5b3d553c69094a78a8a81992d98972467f5e63c3b3b8cf888b25f` | Phase 031 |
| `.../master-032r-checkpoint.bundle` | `febaa7d93202ea4fabbc90baee2d80b0b89452c3e853ef64ccdf01595397d8c2` | Master 032R tip through `04e4e234` pre-bundle-file |

Store checksums beside bundles off-VM after approval.

## Explicit non-claims

- Does **not** restore Phase 018–030 missing objects.
- Local bundle presence ≠ off-environment durable backup until transferred under authorization.
