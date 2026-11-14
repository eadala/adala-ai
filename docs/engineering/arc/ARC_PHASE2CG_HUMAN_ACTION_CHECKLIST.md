# ARC Phase 2C-G Human Action Checklist

Tasks that **cannot** be completed safely by the agent without operator involvement:

## Identity (required for live OIDC)

- [ ] Create isolated OIDC application (not customer Clerk)
- [ ] Configure audience `adalah-arc` and RS256
- [ ] Enable MFA policy for ARC operators
- [ ] Provision operator accounts; record stable `sub` values
- [ ] Bind secrets in Cursor/secret store: `ARC_OIDC_ISSUER`, `ARC_OIDC_AUDIENCE`, `ARC_OIDC_JWKS_URL`, `ARC_OIDC_OPERATOR_ALLOWLIST`, `ARC_OIDC_SUBJECT_ROLE_JSON`
- [ ] Set `ARC_OIDC_MODE=live` and `ARC_ALLOW_DEV_HMAC=false` on the ARC test host
- [ ] Authorize which humans may be allowlisted
- [ ] Confirm issuer is not customer production IdP

## GitHub (required for live read-only)

- [ ] Create GitHub App with read-only permissions per `ARC_PHASE2CG_GITHUB_APP_SETUP.md`
- [ ] Prefer install on dedicated test repository
- [ ] Obtain App ID + installation ID
- [ ] Store private key in secret manager as `ARC_GITHUB_APP_PRIVATE_KEY`
- [ ] Set `ARC_GITHUB_REPO_ALLOWLIST` to installed repo only
- [ ] Set `ARC_GITHUB_MODE=live`
- [ ] Explicitly authorize live reads against chosen repository
- [ ] Confirm no write permissions granted

## Explicitly out of scope (do not do)

- [ ] ~~Connect production Coolify~~
- [ ] ~~Enable deployment execution~~
- [ ] ~~Push/merge this branch without review~~
- [ ] ~~Paste secrets into chat or git~~
- [ ] ~~Change Hetzner / production DB / customer app~~

## After secrets are bound

- [ ] Re-run `pnpm test` and `GET /api/arc/integration/harness`
- [ ] Accept only `VERIFIED_LIVE_TEST` for cases actually exercised live
- [ ] Keep production readiness **NO-GO** until separate deploy authority
