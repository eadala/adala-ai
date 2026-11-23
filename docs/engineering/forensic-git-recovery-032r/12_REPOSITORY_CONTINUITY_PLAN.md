# 12 — Repository Continuity Plan (Design Only — Not Activated)

## 8.1 Phase preservation

Each phase must record: directive ID, full commit SHA, tree SHA, parent, evidence dir, tests, migrations, change manifest, human approval.

## 8.2 Durable backup

Preferred: after each LOCAL-ONLY phase close, create an encrypted Git bundle + protected backup ref; store outside ephemeral VM.

Evaluate: protected remote `refs/backup/*` (sync ≠ release), immutable object storage for bundles, mirror repo.

## 8.3 Release separation

Development checkpoint → backup sync → PR → review → merge → staging → production. Backup sync never implies release.

## 8.4 Recovery drill

Restore selected commit into disposable bare clone; verify exact SHA + tree + ancestry; record results.

## 8.5 Ownership

Document approvers for backup sync, repo access, merge, deploy, recovery audit.

**No permanent automation or credentials created in this phase.**
