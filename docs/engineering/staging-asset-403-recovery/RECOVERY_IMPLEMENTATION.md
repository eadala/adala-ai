# Staging Asset 403 — Recovery Implementation

## Primary fix (application integrity)

Update `corsOriginPolicy.ts` to:

1. Allow **same-origin** (`Origin` === request public origin from Host / `X-Forwarded-Host` + proto).
2. Explicitly allow **`STAGING_CORS_DOMAINS`** (`https://staging.adalahai.com`).
3. Keep rejecting unknown Origins (including `evil.example`) with `CORS_ORIGIN_NOT_ALLOWED`.
4. Reject Host header injection (`/`, whitespace, etc.) when deriving public origin.

## Defense-in-depth (security boundary)

Retain early allowlisted static delivery before Clerk + SPA after `/api`:

| File | Role |
|------|------|
| `publicFrontendAssetPath.ts` | Strict `/assets/*` + root file allowlist |
| `productionFrontendStatic.ts` | Early gated static + missing-asset 404; late SPA |
| `app.ts` | Early assets before Clerk; SPA after `/api` |

## Test layers

| Layer | Script | Proves |
|-------|--------|--------|
| 1 Unit | `test:frontend-static`, `test:cors-origin` | Allowlist predicates + CORS policy |
| 2 Differential | `test:frontend-static-cors` | Broken baseline 403 JSON vs fixed 200 MIME |
| 2 Real app | `test:frontend-static-prod` | Actual `app.ts` production chain + PUBLIC_DIR |
| 3 Docker | CI `docker-production` | Image builds (local Docker unavailable in this agent VM) |

## Security impact

* Does **not** disable Clerk, RLS, Traefik Basic Auth, or CORS for APIs.
* Does **not** allow arbitrary Origins.
* Same-origin allowance is Host-bound; staging domain is explicit.
* `.env` / sensitive paths remain 404.

## Operator env (still recommended)

Set Coolify staging `ALLOWED_ORIGINS=https://staging.adalahai.com` even with code allowlist (defense in depth / other preview hosts).
