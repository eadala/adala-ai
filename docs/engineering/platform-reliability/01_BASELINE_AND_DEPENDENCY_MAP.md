# Baseline and Dependency Map

## Repository identity

- Repo: `eadala/adala-ai`
- Working branch: `cursor/platform-reliability-p0-da81`
- SaaS assurance tip (resolved): `1f5534b9d769e74ba994224fa9b817a8acfda870`
- Tree at assurance tip: `9e677dfc241123ea122b93642cd82a36ddb53c06`
- Tenant security baseline: `d2f7e3695a3a1d37b9e091e4525deb18fa087c07`
- Ancestry: tenant baseline ⊆ assurance tip ⊆ reliability branch base

## P0 root causes (from SaaS-007)

| ID | Finding | Root cause |
|----|---------|------------|
| OPS-P0-01 | Full backup cron stats-only | Cron wrote inventory/stats; no restorable artifact |
| OPS-P0-02 | Restore unverified | No isolated restore verification path |
| OPS-P0-03 | Fake DR simulateRestoreTest | Unconditional success return |
| OPS-P0-04 | healthz ≠ readiness | Single probe conflated liveness and dependency readiness |

## Dependency inventory for recovery

| Dependency | In DB dump? | Recovery path |
|------------|-------------|---------------|
| PostgreSQL schema+data | Yes | pg_dump / pg_restore |
| Uploaded legal documents (object storage) | No | Separate object-storage backup |
| Encryption keys / secrets | No | Secure secret store restore (never in dump) |
| Clerk / IdP configuration | No | Provider console / IaC |
| Payment gateway config | No | Provider + secret store |
| Schema migrations | Code repo | Migration runner against restored DB |
| Application config | Partial | Env/secret store |

## Package / build

- Package manager: pnpm (pinned Dockerfile `9.15.9`)
- Lockfile: `pnpm-lock.yaml` at repo root
- Runtime: Node 22 Alpine multi-stage Dockerfile
