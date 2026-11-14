# ARC Phase 2C-G Identity Provider Setup

**Directive:** ARC-ENG-2CG-001  
**Audience:** Operator configuring an *isolated* OIDC test tenant for ARC  
**Secrets:** Never commit. Placeholder names only.

## Recommendation

Use a **dedicated** standards-compliant OIDC application (Clerk *new* application, Auth0 tenant, or Keycloak realm) that is **not** the customer-facing Adalah AI Clerk instance.

| Criterion | Requirement |
|---|---|
| Separation | Separate application / audience from customer SPA |
| Algorithm | RS256 only |
| MFA | Enforceable via ACR / IdP policy |
| Operators | Explicit subject allowlist |

Reusing customer `super_admin` or tenant roles is **forbidden**.

## Exact ARC configuration

| Variable | Example placeholder | Purpose |
|---|---|---|
| `ARC_OIDC_MODE` | `live` | Enable live JWKS path |
| `ARC_OIDC_ISSUER` | `https://<test-idp-host>/oauth` | Trusted issuer |
| `ARC_OIDC_AUDIENCE` | `adalah-arc` | Exact audience (not customer SPA) |
| `ARC_OIDC_JWKS_URL` | `https://<test-idp-host>/.well-known/jwks.json` | Key rotation endpoint |
| `ARC_OIDC_OPERATOR_ALLOWLIST` | `oidc\|op_alice,oidc\|op_bob` | Explicit subjects |
| `ARC_OIDC_SUBJECT_ROLE_JSON` | `{"oidc\|op_alice":"platform_owner"}` | Server-side role map |
| `ARC_OIDC_REQUIRE_MFA` | `true` | Require ACR match |
| `ARC_OIDC_REQUIRED_ACR` | `urn:adalah:acr:mfa` | Contractual ACR value |
| `ARC_OIDC_CLOCK_SKEW_SEC` | `30` | Clock skew |
| `ARC_ALLOW_DEV_HMAC` | `false` | **Required false in live mode** |

## IdP console checklist (human)

1. Create isolated application named e.g. `Adalah ARC Operators (Test)`.
2. Set application audience / API identifier to `adalah-arc`.
3. Enable RS256 access tokens; disable HS256.
4. Publish JWKS URL; confirm TLS.
5. Configure MFA policy for all ARC operators.
6. Create operator users; collect stable `sub` values.
7. Populate allowlist + role JSON on ARC host env (secret store).
8. Set `ARC_ALLOW_DEV_HMAC=false`.
9. Confirm issuer host is **not** customer production IdP (`clerk.adalah.ai` blocked in test validator).

## Runtime behavior

- Signature, iss, aud, exp, nbf, kid via JWKS (`jose`).
- Revocation: in-process subject/session revoke APIs (distributed store = future).
- Session expiration: JWT `exp` enforced; short-lived tokens recommended (≤1h).
- Live without JWKS → `BLOCKED_NO_CREDENTIALS`.
- **HMAC never substitutes** when `ARC_OIDC_MODE=live`.

## Status

**CONFIGURATION READY** (documented) · **LIVE VERIFICATION** awaits operator credentials
