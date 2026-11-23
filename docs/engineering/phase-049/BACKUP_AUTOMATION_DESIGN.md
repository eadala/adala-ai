# Phase 049 — Backup Automation Design

## Goals

Preserve engineering milestones outside ephemeral Cursor workspaces without autonomous production deployment.

## Layers

### Layer 1 — Local checkpoint

`scripts/engineering/checkpoint-verify.sh <milestone> [ref]`

- Dirty-tree warning, commit/tree SHAs, shallow-repo fail, path heuristics (`.env`, `baseline-capture.txt`, keys).

### Layer 2 — Clean backup artifact

`scripts/engineering/milestone-preserve.sh <milestone> [ref]`

- Creates `refs/backup/milestones/<id>-<sha12>`
- Writes Git bundle under `docs/engineering/continuity/artifacts/`
- SHA-256 sidecar + `backup-integrity.sh` restore into disposable bare repo
- Excludes contaminated blob OID `3f1a3e36c8b6ace9e1bf1b6c072951f8a8f6f925`

### Layer 3 — Off-environment preservation (gated)

`scripts/engineering/remote-backup-push.sh <commit> <dest-branch>`

- Requires `ALLOW_REMOTE_BACKUP=1`
- Destination default: `adalahai/adala-ai-private-recovery-2026`
- Verifies private, no webhooks, no Actions workflows
- Refuses `backup/phase-031-clean` overwrite
- Single ref push only (no `--force` / `--mirror` / `--all`)
- Contaminated object reachability check

**Authorization:** Phase 049 does **not** enable unattended remote push. Owner must separately authorize each external transfer.

### Layer 4 — Independent restore verification

`backup-integrity.sh` performs local independent restore into a temp bare repo.

Remote restore for new milestones: only after a successful authorized push.

### Layer 5 — Failure handling

- Preserve original work; never delete local artifacts on failure.
- Never overwrite Phase 031 verified ref.
- Report exact human intervention needed (auth scope, privacy, contamination).

## Retention

- Verified milestone bundles and manifests under `docs/engineering/continuity/artifacts/` are retention-protected engineering evidence.
- Phase 031 remote branch is immutable recovery evidence.
