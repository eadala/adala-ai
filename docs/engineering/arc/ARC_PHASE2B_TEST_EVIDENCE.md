# ARC Phase 2B Test Evidence

## Command

```bash
cd artifacts/arc-server && pnpm test && pnpm typecheck
```

## Results (local)

| Suite | Result |
|---|---|
| Phase 2A security remediation | PASS |
| Phase 1 / 2A policy gates | PASS |
| Phase 2B trusted control plane | PASS |
| **Total** | **67/67 PASS** |
| Typecheck `arc-server` | PASS |

## Coverage highlights

- Identity: missing/invalid/expired/wrong iss/aud/unsupported alg/forged role/AI escalation
- Audit: durable restart, concurrent writes, update rejection, redaction, chain verify
- Providers: Coolify fixture modes, mutation forbid, SSRF denial
- Evidence/approval: missing evidence BLOCKED, artifact mismatch, owner bypass deny
- Deployment isolation: HTTP execute, webhook, job, internal paths → 403
- Phase 2A regression retained (F-001/F-002 closures)

## Customer application

Not modified. ARC isolated under `artifacts/arc-*`.

## Status

**PASS** (local isolated resources only)
