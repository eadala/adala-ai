# ARC Phase 2C-1 Identity Validation

**Directive:** ARC-ENG-2C1-001

## Verified facts (fixture)

- RS256 verification via `jose`.
- Exact issuer + audience checks.
- Expiration / nbf handling.
- JWKS rotation: prior kid verifies until dropped; unknown kid → `unknown_kid`.
- Server-side subject→role map (never customer `super_admin` / client role claims).
- Explicit operator allowlist (`ARC_OIDC_OPERATOR_ALLOWLIST`).
- Revocation of subject / session (`revokeOperator` / `revokeSession`).
- MFA design: optional `ARC_OIDC_REQUIRE_MFA` + required ACR `urn:adalah:acr:mfa`.
- Live mode without `ARC_OIDC_JWKS_URL` → **BLOCKED** (`liveOidcStatus`).
- Provider JWKS outage classifies as `jwks_outage` (fail-closed).

## Live identity integration

**BLOCKED** — no authorized isolated test IdP credentials in environment (`ARC_OIDC_JWKS_URL` unset; Cursor app secrets empty). Fixture validation preserved.

## Assumptions

- Dedicated ARC operator application would use separate audience `adalah-arc` (not customer SPA).
- MFA ACR values are contractual with the chosen IdP.

## Evidence

`artifacts/arc-server/src/tests/phase2c1-integration.test.ts` · `pnpm test` → suite PASS

## Status

**PASS** (fixture/security controls) · **BLOCKED** (live OIDC)
