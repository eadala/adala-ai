# ARC Live Security Acceptance Criteria

**Directive:** ARC-LIVE-HANDOFF-001  
**Rule:** Live PASS requires authorized exercise against test services. Fixture PASS ≠ live PASS.

## Pass / fail matrix

| Criterion | PASS | FAIL |
|---|---|---|
| **OIDC identity validation** | Live JWT verifies: RS256, iss, aud, exp; harness `oidc.live` = `VERIFIED_LIVE_TEST` | Wrong iss/aud/sig/exp accepted; or fixture labeled as live |
| **MFA assurance** | With `ARC_OIDC_REQUIRE_MFA=true`, missing ACR → deny; MFA token accepted | MFA-disabled tokens accepted when MFA required |
| **Operator allowlisting** | Unknown `sub` → `not_allowlisted`; only listed subjects map to roles | Open allow / client role headers trusted |
| **GitHub repository restriction** | Only allowlisted repo readable; others denied | Wildcard allowlist or unauthorized repo readable |
| **Token permission scope** | App permissions read-only per guide; no write scopes | Write/admin/secret scopes granted |
| **Secret redaction** | Tokens/keys absent from logs, API config, evidence files after redact | Secrets visible in evidence/chat/git |
| **Provider outage behavior** | JWKS/GitHub timeout or 5xx → fail-closed / UNAVAILABLE/FAILED — not healthy | Outage treated as authenticated/healthy |
| **Deployment isolation** | Execute/webhook/job/internal deploy → 401/403; Coolify `executeDeploy=false`; AI cannot request/approve deploy | Any path initiates deploy or Coolify mutation |

## Gate classifications (harness)

| Result | Meaning | May claim live success? |
|---|---|---|
| `VERIFIED_FIXTURE` | Local fixture/synthetic | **No** |
| `VERIFIED_LIVE_TEST` | Authorized live test service exercised | Yes (test only) |
| `BLOCKED_NO_CREDENTIALS` | Missing secrets | No |
| `BLOCKED_NO_AUTHORIZATION` | Config/policy blocks | No |
| `FAILED` | Attempted and failed | No |

## Residual non-claims

- Not WORM audit.
- Not production Coolify verification.
- Not production deployment authorization.
- Customer IdP / customer Clerk reuse remains **out of policy**.

## Current acceptance (this handoff)

| Area | Status |
|---|---|
| Local/fixture controls | **PASS** (104/104) |
| Live OIDC | **PENDING** authorization + credentials |
| Live GitHub | **PENDING** authorization + credentials |
| Production readiness | **NO-GO** |
