# ARC Phase 2C-G Security Tests

## Command

```bash
cd artifacts/arc-server && pnpm test && pnpm typecheck
```

## Results

Prior 92 tests retained; Phase 2C-G suite added. Aggregate: **104/104 PASS** (`pnpm test`). Typecheck PASS.

## 2C-G cases

- Harness fixture vs live classification
- Live OIDC without JWKS → BLOCKED + HMAC disabled
- Production customer IdP host rejected
- GitHub live without credentials → BLOCKED
- Mutation flag rejected
- Env redaction
- GitHub App permission/JWT builder (synthetic key)
- Harness/config HTTP endpoints
- Deploy execute still 403

## F-001 / F-002

Remain **CLOSED**.

## Status

**PASS**
