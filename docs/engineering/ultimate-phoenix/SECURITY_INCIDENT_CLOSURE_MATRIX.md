# Security Incident Closure Matrix

| Item | Status | Evidence |
|------|--------|----------|
| Affected public repo | CONFIRMED | `eadala/adala-ai` visibility=public |
| Contaminated OID | CONFIRMED | `3f1a3e36c8b6ace9e1bf1b6c072951f8a8f6f925` |
| Reachable from tip ancestry | CONFIRMED | `git rev-list --objects HEAD` |
| Present in tip **tree** | ABSENT | Redacted in Phase 049 |
| Credential class | CONFIRMED | Historical `ghs_` (GitHub App installation token) |
| Credential currently usable | UNKNOWN | Owner must verify revocation/expiry — **do not test by using it** |
| Additional secret patterns in tip tree | CLEAN | Heuristic scan 0 hits |
| Additional secret patterns in reachable history | HISTORICAL_ONLY | Same forensic path |
| CI triggered by public Phase 049 push | CONFIRMED | Actions run on `9eb558cd` |
| Production deploy from that push | NOT_OBSERVED | No deploy job evidence |
| Public history rewrite | NOT_EXECUTED | Requires explicit owner approval |
| Private Phase 031 backup intact | VERIFIED_PASS | `8685f64a` / `ea8b8e85` |
| Owner credential remediation | BLOCKED_ON_OWNER | See `CREDENTIAL_REMEDIATION_OWNER.md` |

## Remaining P0 owner actions

1. Revoke/rotate exposed installation token.
2. Audit GitHub activity after exposure.
3. Authorize (or deny) public history rewrite.
4. Authorize private remote preservation of clean-tree milestones only.
