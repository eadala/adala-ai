# Engineering Governance — Adalah AI

Operational documents for GitHub, Cursor, release, and recovery.

| Document | Purpose |
|----------|---------|
| [BRANCHING_STRATEGY.md](./BRANCHING_STRATEGY.md) | Branch roles and naming |
| [CURSOR_DEVELOPMENT_WORKFLOW.md](./CURSOR_DEVELOPMENT_WORKFLOW.md) | Daily Cursor / agent procedure + pre-PR checklist |
| [RELEASE_MANAGEMENT.md](./RELEASE_MANAGEMENT.md) | SemVer, tags, RC identity, migration notes |
| [GITHUB_SECURITY_BASELINE.md](./GITHUB_SECURITY_BASELINE.md) | Protection, CODEOWNERS, Actions posture |
| [RECOVERY_AND_ROLLBACK.md](./RECOVERY_AND_ROLLBACK.md) | L1–L4 recovery matrix, RPO/RTO |
| [DEPLOYMENT_SAFETY.md](./DEPLOYMENT_SAFETY.md) | Coolify / push fail-closed rules |
| [PRODUCTION_BASELINE_VERIFICATION.md](./PRODUCTION_BASELINE_VERIFICATION.md) | How to prove deployed SHA |
| [COOLIFY_OPERATOR_CHECKLIST.md](./COOLIFY_OPERATOR_CHECKLIST.md) | Operator-only verification checklist |

## Scripts (read-only)

```bash
./scripts/release/verify-release.sh <ref>
./scripts/release/verify-release.sh --compare <from> <to>
./scripts/release/verify-release.sh --migrations <from> <to>
./scripts/release/verify-release.sh --expect-tree <ref> <tree>
./scripts/release/recovery-inspect.sh [known-good-ref]
./scripts/release/detect-sensitive-changes.sh [base] [head]
```

CI companion: `.github/workflows/governance-safety.yml` (does not deploy).
