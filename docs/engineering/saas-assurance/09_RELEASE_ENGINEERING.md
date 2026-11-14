# Release Engineering

## Observed

| Item | Evidence |
|---|---|
| CI | `.github/workflows/ci.yml` — tests on push/PR; frozen lockfile; extensive api-server schema/static tests |
| Lockfile | `pnpm-lock.yaml` present |
| Docker | root `Dockerfile`, `infra/Dockerfile.api`, `Dockerfile.web`, compose |
| Deploy docs | `DEPLOY.md` Coolify-oriented |
| ARC execute | Disabled per ARC docs (not re-tested) |
| Migrations | numbered SQL under `artifacts/api-server/migrations/` |
| Tenant isolation gate | `test:tenant-isolation-gate` exists locally; **not** wired into `ci.yml` yet |

## Gaps

| ID | Sev | Finding |
|---|---|---|
| F-RELENG-001 | P1 | No canary/staged rollout automation evidenced |
| F-RELENG-002 | P1 | Artifact provenance (SBOM/signed digests) not evidenced in CI |
| F-RELENG-003 | P1 | DR drill / load tests absent from CI gates |
| F-RELENG-004 | P2 | Feature-flag framework not clearly centralized |
| F-RELENG-005 | P2 | Migration expand/contract discipline uneven across 061-style DDL |

## Recommendation

Improve release **reliability evidence** (immutable tags, migration dry-run job, optional gate for `test:tenant-isolation-gate` on security branches). Do **not** activate auto-deploy under this directive.
