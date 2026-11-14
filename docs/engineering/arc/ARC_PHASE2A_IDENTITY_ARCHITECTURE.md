# ARC Phase 2A Identity Architecture

## Model

1. **Authentication:** `Authorization: Bearer <hmac-token>`
2. **Token payload:** `{ sub, iat, exp, v }` only — **no role claim**
3. **Authorization:** `sub` → `OPERATOR_REGISTRY[sub].role` → permission matrix
4. **Rejected:** `X-ARC-Role`, legacy `X-ARC-Token` / `X-ARC-Operator` as auth

## Local/test issuer

`POST /api/arc/dev/issue-token` `{ operatorId }`

- Available only when `ARC_ENV` ≠ `production`
- Signs with `ARC_IDENTITY_SECRET` (≥16 chars) or local-only default secret
- Production config: issuer returns **403** `production_blocks_dev_issuer`

## Future production

Replace registry + HMAC with verified IdP (Clerk/OIDC) mapping `sub` → ARC role in server config. Never accept browser role headers.

## Fail closed

Missing/invalid/expired/forged credentials → 401/403. No anonymous mutating operations.
