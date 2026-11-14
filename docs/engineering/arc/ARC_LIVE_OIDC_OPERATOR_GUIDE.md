# ARC Live OIDC Operator Guide

**Directive:** ARC-LIVE-HANDOFF-001  
**Audience:** Platform operator configuring an isolated test identity provider for ARC  
**Authorization:** Live verification requires separate written approval. Do not paste secrets into chat or git.

## 1. Supported identity provider

Use **one** of:

| Provider | Suitability | Notes |
|---|---|---|
| **Clerk — new dedicated application** | Preferred if team already uses Clerk | Must be a **separate** application from customer-facing Adalah AI |
| Auth0 — dedicated tenant or API | Suitable | Separate API audience `adalah-arc` |
| Keycloak — dedicated realm | Suitable | Self-hosted test realm only |

**Forbidden:** Reusing the customer Adalah AI Clerk application, customer `super_admin` roles, or tenant RBAC claims as ARC authorization.

## 2. Required OIDC capabilities

- OpenID Connect discovery or explicit issuer + JWKS URL
- Access tokens signed with **RS256** only (reject HS256)
- Stable `sub` claim per operator
- Configurable **audience** (`aud`)
- Optional but required for ARC live gate: MFA reflected in `acr` / IdP policy
- HTTPS JWKS with key rotation (`kid`)
- Short-lived tokens (recommended ≤ 1 hour)

## 3. Step-by-step setup (Clerk example)

1. In Clerk Dashboard, create application: `Adalah ARC Operators (Test)`.
2. Do **not** enable this app for the customer legal CMS SPA.
3. Configure JWT template / API with:
   - Audience: `adalah-arc`
   - Algorithm: RS256
4. Copy:
   - Issuer → `ARC_OIDC_ISSUER` (e.g. `https://<test-instance>.clerk.accounts.dev`)
   - JWKS → `ARC_OIDC_JWKS_URL` (issuer + `/.well-known/jwks.json` or Clerk JWKS URL)
5. Enforce MFA for all users in this application.
6. Create operator users only (no customer accounts).
7. For each operator, record the stable subject identifier (`sub`).
8. Decide ARC roles server-side (never from client headers):

| Example subject | ARC role |
|---|---|
| `user_…_alice` | `platform_owner` |
| `user_…_releaser` | `release_manager` |
| `user_…_reviewer` | `independent_reviewer` |
| `user_…_auditor` | `read_only_auditor` |

Map in `ARC_OIDC_SUBJECT_ROLE_JSON` and allowlist in `ARC_OIDC_OPERATOR_ALLOWLIST`.

9. Store values in Cursor Secrets / secret manager — **never** in repository files.

## 4. Exact environment variables (placeholders)

```bash
ARC_OIDC_MODE=live
ARC_OIDC_ISSUER=https://<TEST_IDP_HOST>
ARC_OIDC_AUDIENCE=adalah-arc
ARC_OIDC_JWKS_URL=https://<TEST_IDP_HOST>/.well-known/jwks.json
ARC_OIDC_OPERATOR_ALLOWLIST=<sub1>,<sub2>
ARC_OIDC_SUBJECT_ROLE_JSON={"<sub1>":"platform_owner","<sub2>":"independent_reviewer"}
ARC_OIDC_REQUIRE_MFA=true
ARC_OIDC_REQUIRED_ACR=urn:adalah:acr:mfa
ARC_OIDC_CLOCK_SKEW_SEC=30
ARC_ALLOW_DEV_HMAC=false
```

**Hard rules**

- `ARC_ALLOW_DEV_HMAC` **must** be `false` in live mode (ARC refuses HMAC substitution).
- Issuer must **not** be customer production IdP host `clerk.adalah.ai` (test validator blocks it).
- Audience must be dedicated `adalah-arc`, not the customer SPA client id.

## 5. Token expiration and revocation

| Control | Operator action | ARC behavior |
|---|---|---|
| Expiration | Configure IdP token TTL ≤ 1h | JWT `exp` enforced |
| Session revoke | Disable user / revoke sessions in IdP | Next request fails signature/claims or allowlist |
| ARC revoke | Call ops revoke (subject/sid) for emergency | `revoked` fail-closed |
| Clock skew | Keep NTP healthy | ±30s default |

## 6. Safe credential storage

- Store issuer/audience/JWKS URL and allowlist in secret manager or Cursor Secrets.
- Never commit `.env` with live values.
- Never paste tokens or private keys into Slack/chat/PRs.
- Rotate IdP secrets if exposure is suspected.

## 7. Live verification procedure (after authorization)

See `ARC_LIVE_VALIDATION_RUNBOOK.md`. Expected gates:

- Config probe: `liveOidcGate` progresses past `BLOCKED_NO_CREDENTIALS`
- Harness case `oidc.live` → `VERIFIED_LIVE_TEST` only if JWKS reachable and authorized
- Bearer token from test IdP authenticates an allowlisted operator
- Forged `X-ARC-Role` still → 403 (`role_header_forbidden`)

## 8. Expected outcomes

| Step | Expected result |
|---|---|
| Dedicated app created | Separate from customer Clerk |
| Env bound | `GET /api/arc/integration/config` shows redacted live-ready (no secret values) |
| MFA on | Tokens without required ACR rejected when `ARC_OIDC_REQUIRE_MFA=true` |
| Allowlist | Unknown `sub` → `not_allowlisted` |
| Live validation authorized + run | `oidc.live` = `VERIFIED_LIVE_TEST` or explicit `FAILED` with reason — never silent HMAC fallback |
