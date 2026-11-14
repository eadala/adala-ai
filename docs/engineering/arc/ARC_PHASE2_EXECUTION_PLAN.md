# ARC Phase 2 Execution Plan

**Do not implement in this audit.** Small independently reviewable PRs.

| PR | Scope | Depends | Threats | Controls | Acceptance | Tests | Complexity | Rollback |
|----|-------|---------|---------|----------|------------|-------|------------|----------|
| **PR-01** Identity | Replace header mock with Clerk/OIDC or signed operator sessions; remove `X-ARC-Role` override | — | F-001 | Verified IdP subject→role map | No header role escalation | Token forgery suite | M | Revert auth module; keep kill-switch |
| **PR-02** AuthZ | RBAC middleware on every mutating route; deny-by-default | PR-01 | F-002 | Permission matrix | ai_agent/auditor cannot request deploy | Matrix tests | M | Feature flag enforce |
| **PR-03** Durable audit | Postgres/sqlite append-only audit table; no update/delete API | — | F-004 | Insert-only + hash chain optional | Survives restart | Restart integrity test | M | Keep dual-write briefly |
| **PR-04** Evidence/policy | Persist gate evidence; expire; bind release+env+digest; wire execute to policy | PR-03 | TOCTOU | Deterministic eval | Same input→same decision | Property tests | M | Policy version pin |
| **PR-05** Approvals | Durable approvals; revocation; concurrency locks | PR-01–04 | SoD bypass | Unique (request,actor); invalidate on SHA change | Self-approve impossible | Concurrency tests | M | Disable grant API |
| **PR-06** GitHub RO | Formalize token scopes; pagination; rate limit; cache TTL | PR-01 | Over-permission | Allowlisted API paths | Fixture+live contract | Mock server | S | Disable live mode |
| **PR-07** Coolify RO | Real read-only client; allowlisted endpoints; redaction | PR-01 | Secret leak/SSRF | Fixed base URL allowlist | VERIFIED_STAGING reads | Mock+staging | M | Mock fallback |
| **PR-08** Monitoring | Probe scheduler with TTL/stale; incidents CRUD | PR-03 | Alert storms | Cooldown | STALE ≠ VERIFIED | Clock tests | S | Stop scheduler |
| **PR-09** Regression | Cover F-001/F-002 gaps; kill-switch; CORS | all | Regressions | CI required | All HIGH gaps closed | Expand suite | S | — |
| **PR-10** Staging docs | Staging ARC deploy runbook; training | PR-01–09 | Ops error | Checklists | Staging acceptance signed | Manual | S | Tear down staging |

## Suggested order

PR-01 → PR-02 → PR-03 → PR-04 → PR-05 → PR-09(partial) → PR-06 → PR-07 → PR-08 → PR-09(full) → PR-10

## Out of Phase 2

Production Coolify execute, Auto Deploy changes, customer data access.
