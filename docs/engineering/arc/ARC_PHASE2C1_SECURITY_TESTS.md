# ARC Phase 2C-1 Security Tests

## Command

```bash
cd artifacts/arc-server && pnpm test && pnpm typecheck
```

## Results

| Suite | Result |
|---|---|
| Phase 2A remediation | PASS |
| Phase 2B control plane | PASS |
| Phase 1/2A policy gates | PASS |
| Phase 2C-1 integration | PASS |
| **Total** | **92/92 PASS** |
| Typecheck | PASS |

## 2C-1 cases covered

Invalid issuer/audience, expired token, invalid signature, JWKS rotation, revoked operator, allowlist, MFA ACR, forged roles, AI escalation, unauthorized repo, token leakage, timeout, rate limit, stale/distinct release facts, deployment denial, audit redaction/restart.

## F-001 / F-002

Remain **CLOSED** (regression within suite).

## Status

**PASS**
