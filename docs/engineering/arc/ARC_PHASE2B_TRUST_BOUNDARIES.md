# ARC Phase 2B Trust Boundaries

**Directive:** ARC-ENG-2B-001

## Boundaries

1. **Console** — untrusted; no secrets; no authorization decisions.
2. **ARC API** — sole PEP; Bearer credentials only; rejects `X-ARC-Role` / legacy tokens (F-001 closed).
3. **Identity** — OIDC/JWT (`jose`) preferred; HMAC only when `ARC_ALLOW_DEV_HMAC=true` and not production.
4. **Authorization data** — server-side subject→role map; never client role claims.
5. **Provider adapters** — read-only; credentials backend-only; fixed origins.
6. **Audit store** — append-only app path; isolated development SQLite.
7. **Customer app** — no dependency; ARC does not load tenant/case data (INV-006).
8. **Deployment execution** — unreachable for all roles including Platform Owner (INV-001).

## Failure containment

- Missing/invalid identity → 401/403 fail-closed (INV-002).
- Audit persist failure on critical mutations → fail-closed when `critical: true`.
- Auth denials still return 403 if durable audit is degraded (JSONL retained).
- Provider errors → typed UNAVAILABLE/UNVERIFIED; never fabricated VERIFIED SHA/digest (INV-005).

## Status

**PASS** (local verified) — see `ARC_PHASE2B_TEST_EVIDENCE.md`.
