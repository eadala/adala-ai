# ARC Phase 2B Identity Security

## Architecture

- Library: `jose` (RS256 only).
- Modes: `ARC_OIDC_MODE=fixture` (default) | `live`.
- Live requires `ARC_OIDC_JWKS_URL`; otherwise `live_unconfigured`.
- Claims validated: signature, iss, aud, exp, nbf, alg allowlist, kid via JWKS.
- Role mapping: `ARC_OIDC_SUBJECT_ROLE_JSON` / built-in `oidc|<id>` map — **not** token `role` claims.
- HMAC adapter: development-only; rejected when `ARC_ENV=production` or `ARC_ALLOW_DEV_HMAC=false`.

## Required claims (fixture/live JWT)

`sub`, `iss`, `aud`, `iat`, `exp` (+ `nbf`/`sid` when present).

## Verified tests

Missing identity, invalid signature, expired, wrong issuer, wrong audience, unsupported alg, forged role header, AI escalation — covered in `phase2b-security.test.ts`.

## Live integration

**UNVERIFIED** — no production Clerk ARC application wired in this phase.

## Status

**PASS** (fixture) · **UNVERIFIED** (live OIDC)
