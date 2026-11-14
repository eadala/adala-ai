# ARC Phase 2C-G Credential & Network Safety

## Controls

| Control | Implementation |
|---|---|
| Env validation | `validateOidcEnv` / `validateGithubEnv` |
| Secret redaction | `redactEnvSnapshot`, `redactSecrets`, config API |
| No secrets in git | Placeholder docs only; `.env` not committed |
| No secrets in logs | Audit metadata sanitization |
| Origin allowlists | `httpSafe.ts` GitHub `api.github.com`; Coolify allowlist |
| TLS | HTTPS required for live OIDC issuer/JWKS |
| Timeouts | 8s provider fetches; harness JWKS 8s |
| Fail-closed | Missing live config → BLOCKED_* |
| HMAC isolation | `ARC_OIDC_MODE=live` forces `allowDevHmac()===false` |
| Production IdP rejection | `clerk.adalah.ai` blocked in test validator |
| Mutation forbid | `ARC_GITHUB_ALLOW_MUTATION=true` rejected |

## Status

**PASS**
