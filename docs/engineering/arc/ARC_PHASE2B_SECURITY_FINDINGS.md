# ARC Phase 2B Security Findings

## Prior findings

| ID | Title | Status |
|---|---|---|
| F-001 | Forgeable X-ARC-Role | **CLOSED** (Phase 2A; regression green) |
| F-002 | AI deployment request | **CLOSED** (Phase 2A; regression green) |

## Phase 2B observations

| ID | Severity | Finding | Status |
|---|---|---|---|
| F-2B-001 | Info | Live OIDC IdP not wired | Open — reported UNVERIFIED |
| F-2B-002 | Info | Audit SQLite not WORM | Accepted limitation — documented |
| F-2B-003 | Info | GitHub/Coolify live production reads not performed | By design Phase 2B |
| F-2B-004 | Low | HMAC still enabled by default in non-prod | Mitigated by `ARC_ALLOW_DEV_HMAC` + production reject |

## Blocking findings

**None** for local Phase 2B acceptance criteria.

## Production readiness

**NO-GO** — control plane local-only; no production authority.
