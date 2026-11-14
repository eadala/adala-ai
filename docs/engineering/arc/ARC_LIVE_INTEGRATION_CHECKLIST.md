# ARC Live Integration Checklist

**Directive:** ARC-LIVE-HANDOFF-001  
**Baseline:** `e82ed25c` / tree `29cda42e` (Phase 2C-G)

Legend: **Done (automated)** · **Approval** · **External config** · **Credentials** · **Live verify**

---

## A. Automated and already completed

| Action | Expected result | Evidence |
|---|---|---|
| Phase 2C-G baseline locked | HEAD/tree match | git rev-parse |
| Security suite | **104/104 PASS** | `cd artifacts/arc-server && pnpm test` |
| F-001 closed | `X-ARC-Role` → 403 `role_header_forbidden` | phase2a tests |
| F-002 closed | AI lacks deploy/approve | permissions + tests |
| Deploy execution disabled | All roles 403 on execute | routes + tests |
| Coolify mutations unavailable | `executeDeploy: false` | coolify adapter |
| Integration harness | Gate labels fixture ≠ live | `/api/arc/integration/harness` |
| HMAC blocked under live OIDC mode | `allowDevHmac()===false` when mode=live | identity.ts + 2CG tests |
| Operator guides published | Docs present under `docs/engineering/arc/` | this package |

---

## B. Requires operator approval

| Action | Expected result |
|---|---|
| Approve use of dedicated test IdP (not customer Clerk) | Written approval recorded |
| Approve GitHub App install on **test** repo only | Written approval recorded |
| Approve **live validation window** (date/time, operator names) | `ARC_LIVE_VALIDATION_AUTHORIZED=true` only after approval |
| Confirm production Coolify remains out of scope | Acknowledgement |
| Confirm no deploy enablement | Acknowledgement |

---

## C. Requires external account configuration

| Action | Expected result |
|---|---|
| Create Clerk/Auth0/Keycloak **dedicated** ARC test app | Issuer + JWKS URLs available |
| Enforce MFA on that app | MFA required for operators |
| Create operator users; capture `sub` | Allowlist inputs ready |
| Create GitHub App (read-only perms) | App ID available |
| Create/select `eadala/adala-ai-arc-test` | Repo exists |
| Install App on that repo only | Installation ID available |
| Disable App webhooks / write perms | Confirmed in GitHub UI |

---

## D. Requires credentials (secret store only)

| Action | Expected result |
|---|---|
| Bind `ARC_OIDC_*` + `ARC_ALLOW_DEV_HMAC=false` | Config probe not `BLOCKED_NO_CREDENTIALS` for OIDC |
| Bind `ARC_GITHUB_APP_*` or installation token + allowlist | GitHub live gate unblocked |
| Confirm secrets absent from git/chat/logs | `git grep` clean; config API redacted |

**Never** place real values in markdown, fixtures, or PRs.

---

## E. Requires live verification (only after B+C+D)

| Action | Expected result |
|---|---|
| Run runbook with `ARC_LIVE_VALIDATION_AUTHORIZED=true` | Evidence report file written |
| OIDC live case | `VERIFIED_LIVE_TEST` **or** documented `FAILED` |
| GitHub live case | `VERIFIED_LIVE_TEST` **or** documented `FAILED` |
| Allowlist deny still works | Unauthorized repo denied |
| Deploy still disabled | Execute → 403 |
| Classify results honestly | No fixture marked as live |

Until E is authorized and executed: **LIVE_INTEGRATION_AUTHORIZATION: PENDING**
