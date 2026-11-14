# Release Engineering

## Observed

| Item | Evidence |
|---|---|
| CI | `.github/workflows/ci.yml` — multi-gate: test, db-migrations, docker-production, typescript, lint, build, security, audit, a11y, architecture, **tenant-isolation**, license, commit-lint; summary requires docker-production success ([Release CI CD inventory](bc-e6b3372c-0e97-5259-8052-baa3d3d4acf8)) |
| Lockfile | `pnpm-lock.yaml`; CI/`infra/Dockerfile.*` use `--frozen-lockfile` |
| Root Coolify `Dockerfile` | Uses **`--no-frozen-lockfile`** — divergence from CI |
| Deploy | Coolify webhook / human-approved; **no GitHub CD deploy job** |
| ARC execute | `executeDeploy: false` / always 403 (docs + code constants; not re-probed) |
| Migrations | 001–061 + CI ephemeral PG; file≠prod-applied |
| Rollback | Documented Coolify prior image; RLS prefer forward-fix |

## Gaps

| ID | Sev | Finding |
|---|---|---|
| F-RELENG-001 | P1 | No canary / progressive delivery |
| F-RELENG-002 | P1 | No cosign/SLSA/SBOM; Coolify digests NOT_CONNECTED in ARC docs |
| F-RELENG-003 | P1 | DR restore drill / load Profiles B–E absent from CI |
| F-RELENG-004 | P1 | Root Dockerfile skips frozen lockfile vs CI |
| F-RELENG-005 | P2 | Feature flags plan-tied, not release canary |
| F-RELENG-006 | P2 | GHA dist upload is mutable artifact, not digest-pinned promote |

## Recommendation

Align Coolify image build with frozen lockfile; add restore-drill checklist job; keep auto-deploy **off**.
