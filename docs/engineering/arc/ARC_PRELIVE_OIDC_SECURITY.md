# ARC Pre-Live OIDC Security Certification

**Code:** `artifacts/arc-server/src/lib/oidc.ts`, `identity.ts`, `integrationConfig.ts`  
**Tests:** phase2b / phase2c1 / phase2cg suites (subset of 104/104)

## Control matrix

| # | Control | Status | Notes |
|---|---|---|---|
| 1 | Exact issuer | PASS | `jwtVerify` issuer + claim fallback |
| 2 | Exact audience | PASS | audience option + claim check |
| 3 | JWT signature | PASS | `jose` RS256 |
| 4 | JWKS key selection | PASS | kid via JWKS; unknown kid fails |
| 5 | JWKS rotation | PASS | rotate/retain/drop tests |
| 6 | Expiration | PASS | ERR_JWT_EXPIRED / claim path |
| 7 | NBF | PASS | mapped to failure |
| 8 | Unsupported alg | PASS | HS256 rejected |
| 9 | Operator allowlist | PASS | `not_allowlisted` |
| 10 | Subject→role map | PASS | server JSON/map; not client roles |
| 11 | MFA ACR | CONFIGURATION_REQUIRED | enforced when `ARC_OIDC_REQUIRE_MFA=true`; IdP must emit ACR |
| 12 | Revocation | PASS (in-process) | subject/sid sets; distributed store future |
| 13 | Session invalidation | PARTIAL | sid revoke + IdP session revoke (config) |
| 14 | IdP outage | PASS | `jwks_outage` / fail-closed |
| 15 | HMAC isolation | PASS | live mode forces `allowDevHmac()===false`; issueDevCredential blocked |

## Customer boundary

- Customer Clerk host `clerk.adalah.ai` rejected by `validateOidcEnv` for test/live config.
- Customer `super_admin` not used.
- Client `X-ARC-Role` rejected (F-001 closed).

## Findings

| ID | Severity | Issue |
|---|---|---|
| F-PRELIVE-004 | INFORMATIONAL | Live JWKS URL requires https + config validation but is not cryptographically pinned to a hostname allowlist beyond production blocklist — operator must supply correct test IdP URL. |
| F-PRELIVE-005 | INFORMATIONAL | MFA assurance depends on IdP ACR contract (`CONFIGURATION_REQUIRED`). |

## Verdict

**PASS** for code-level OIDC security · Live IdP setup remains operator-gated.
