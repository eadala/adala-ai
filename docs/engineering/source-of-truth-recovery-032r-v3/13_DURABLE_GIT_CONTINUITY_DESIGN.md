# 13 — Durable Git Continuity Design

## Per-phase artifact
Directive ID, branch, full commit SHA, tree SHA, parent evidence, migrations, tests, change manifest, backup verification, human approval.

## Durable preservation
After LOCAL-ONLY close: create `refs/backup/<phase>-<sha>` + Git bundle; store **outside** ephemeral VM (approved remote `refs/backup/*` or encrypted object store).

## Separation
Backup sync ≠ PR ≠ merge ≠ staging ≠ production. Backup must not auto-deploy.

## Verification
Phase “durably preserved” only when: off-VM backup exists, checksum verified, restore into disposable repo recovers exact SHA + ancestry, recovery report filed.

**Do not activate automation without authorization.**
