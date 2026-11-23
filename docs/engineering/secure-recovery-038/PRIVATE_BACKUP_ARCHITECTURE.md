# 08 — Private Backup Architecture

## Proposed destination (does not exist yet)

| Field | Proposal |
|-------|----------|
| Owner/name | `eadala/adala-ai-secure-backup` |
| Visibility | **private** (must verify before transfer) |
| Remote name | `backup-origin` (separate from `origin`) |
| Access | Owner + designated maintainers only; MFA required (human ops) |
| Integrations | None — no Coolify, no Pages, no packaging publish |
| Retention | Keep backup branches/tags indefinitely until formal retention policy signed |

## Ref mapping (deployment-isolated)

Prefer GitHub **branches** (widely supported) under `backup/`:

| Source | Destination branch |
|--------|--------------------|
| `refs/backup/phase-031-8685f64a` | `backup/phase-031-8685f64a` |
| secure-recovery-038 tip | `backup/master-032r-checkpoint` |

Avoid `cursor/**` (CI filter on public repo). Private backup repo should have **Actions disabled** or empty workflows.

Custom `refs/backup/*` may be pushed if destination accepts; branches are the portable fallback.

**PRIVATE_VISIBILITY_VERIFIED:** NO (repo not created)
