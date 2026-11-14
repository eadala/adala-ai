# ARC Live Validation Runbook

**Directive:** ARC-LIVE-HANDOFF-001  
**Mode:** Read-only · **Deploy:** never  
**Coolify production:** never

## Preconditions

1. Checklist sections B–D complete (`ARC_LIVE_INTEGRATION_CHECKLIST.md`).
2. Written live-validation authorization recorded.
3. Secrets bound via secret store / Cursor Secrets — **not** shell history if avoidable.
4. ARC server reachable locally (e.g. `ARC_PORT=8787`, loopback only).
5. `ARC_ALLOW_DEV_HMAC=false` when `ARC_OIDC_MODE=live`.

## Script (prepared — do not run live until authorized)

```bash
# From repository root
# 1) Unauthorized dry-run (safe now):
./artifacts/arc-server/scripts/arc-live-validation.sh

# 2) Only after approval:
export ARC_LIVE_VALIDATION_AUTHORIZED=true
# Load secrets from your secret manager into the environment (do not echo them)
# export ARC_OIDC_MODE=live
# export ARC_OIDC_ISSUER=...
# export ARC_OIDC_AUDIENCE=adalah-arc
# export ARC_OIDC_JWKS_URL=...
# export ARC_ALLOW_DEV_HMAC=false
# export ARC_GITHUB_MODE=live
# export ARC_GITHUB_REPO_ALLOWLIST=eadala/adala-ai-arc-test
# export ARC_GITHUB_APP_ID=...
# export ARC_GITHUB_APP_INSTALLATION_ID=...
# export ARC_GITHUB_APP_PRIVATE_KEY=...   # or ARC_GITHUB_TOKEN
export ARC_BASE_URL=http://127.0.0.1:8787
./artifacts/arc-server/scripts/arc-live-validation.sh
```

Evidence writes to `/tmp/arc-live-evidence/arc-live-validation-<UTC>.md` (override with `ARC_LIVE_EVIDENCE_DIR`).

## What the script does

| Step | Behavior |
|---|---|
| Auth gate | Exits without live calls unless `ARC_LIVE_VALIDATION_AUTHORIZED=true` |
| Regression | Runs `pnpm test` |
| Health/config/harness | GET only; redacts Bearer/ghp_ patterns |
| Deploy probes | POST deploy routes; **requires** 401/403 |
| Mutations | Not invoked |
| Coolify | Not contacted |

## Manual complementary checks (authorized window)

```bash
# Config must not echo secrets
curl -sS "$ARC_BASE_URL/api/arc/integration/config" | jq .

# Harness classifications
curl -sS "$ARC_BASE_URL/api/arc/integration/harness" | jq '.cases, .summary'

# Optional: authenticate with a short-lived operator access token from the TEST IdP
# curl -sS -H "Authorization: Bearer <TEST_ACCESS_TOKEN>" \
#   "$ARC_BASE_URL/api/arc/audit" | jq .
# Never commit or paste the token into tickets.
```

## Forbidden during validation

- `ARC_GITHUB_ALLOW_MUTATION=true`
- Any Coolify base URL pointing at production
- Enabling deployment execution
- Changing GitHub repository settings
- Marking fixture results as `VERIFIED_LIVE_TEST`

## This handoff status

Live script **prepared** and **dry-run verified** (authorization gate).  
**Live provider calls: NOT EXECUTED** (authorization pending).
