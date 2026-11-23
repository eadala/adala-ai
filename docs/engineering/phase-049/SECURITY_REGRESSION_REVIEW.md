# Phase 049 — Security Regression Review

## Scope reviewed

AI gateway tenant resolution, docker-compose local password defaults, backup automation scripts.

## Findings

| ID | Severity | Finding | Disposition |
|----|----------|---------|-------------|
| S-049-01 | P0 | AI gateway previously fell back to `userId` / `"unknown"` for office scoping (cache + analytics filter risk) | **FIXED** via `aiGatewayTenant.ts` + gateway wiring; unit tests pass |
| S-049-02 | P1 | Hardcoded `adala_pass` in compose | **MITIGATED** for local defaults via env substitution; still a local-dev default — never for production |
| S-049-03 | P2 | Remote backup script could be misused if `ALLOW_REMOTE_BACKUP=1` set casually | Controls: private check, webhook/workflow refusal, immutable Phase 031, contamination OID check, no force |
| S-049-04 | P1 | RAG runtime still missing while schema exists — risk of partial/unscoped future implementation | **OPEN** — deferred; do not ship RAG without authz design |
| S-049-05 | P2 | Full tenant/RLS harness not re-executed in this session | **OPEN / BLOCKED** on available test DB infra |
| S-049-06 | P0 | Gateway used `requireAuth` (no `tenantId`) + checked unset `req.isAdmin` | **FIXED** — `requireAuthWithTenant`; `isAiGatewayAdmin` reads `isSuperAdmin`; reject `platform`; cache-stats SA-only |
| S-049-07 | P0 | Tip tree still contained contaminated forensic `baseline-capture.txt` blob `3f1a3e36…` | **FIXED** — content redacted (new OID); clean-tree orphan bundles exclude ancestral contamination; tip ancestry history not rewritten |

## Unresolved P0 in implemented scope

**None** remaining for the code changed in Phase 049.

## Residual P1 (product / next milestone)

- RAG authorization reconstruction (if product-required).
- Re-run API/tenant/RLS integration harness on tip before any production authorization.
