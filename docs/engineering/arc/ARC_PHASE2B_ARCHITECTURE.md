# ARC Phase 2B Architecture

**Directive:** ARC-ENG-2B-001 · **Revision:** 2.0  
**Classification:** Internal — Security-Critical Engineering  
**Production authority:** NONE · **Release state:** PRODUCTION NO-GO

## Verified facts

- ARC remains a modular monolith under `artifacts/arc-server` + `artifacts/arc-console`.
- Logical flow: Console (untrusted) → Backend API → Identity → Authorization → Services → Read-only adapters → Evidence/Audit storage.
- Phase 2A HEAD baseline `df7a79eb9ad7bceb20831282a71659e43c7515a6` / tree `eba15e8163eafba8091842054a1b0f30ae652434` verified before Phase 2B work.
- Deployment execution remains hardcoded `false` (INV-001).

## Trust & failure containment

| Boundary | Enforcement |
|---|---|
| Authentication | Server JWT/OIDC or explicit HMAC-dev adapter |
| Authorization | Central `roleHasPermission` PEP; deny-by-default |
| Providers | Allowlisted origins; GET-only; no user URLs |
| Persistence | Isolated SQLite audit DB + JSONL; no production DB |
| Network | Loopback console CORS allowlist |
| Deployment | All execute paths return 403 |

## Assumptions

- Local OIDC fixture stands in for live IdP until operator configures `ARC_OIDC_JWKS_URL`.
- Coolify production API is intentionally unreachable in Phase 2B.

## Limitations

- Live OIDC with Clerk/enterprise IdP: **UNVERIFIED**.
- SQLite audit is not WORM; DB-admin tampering remains possible (detectable via hash chain).

## Acceptance status

**PARTIAL → PASS (local architecture)** — contracts implemented and tested locally; live provider identity UNVERIFIED.
