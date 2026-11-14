# ARC Live GitHub App Operator Guide

**Directive:** ARC-LIVE-HANDOFF-001  
**Scope:** Read-only GitHub App on a **dedicated test repository**  
**Forbidden:** Push, merge, release creation, settings changes, production Coolify, deployment

## 1. Create a dedicated test repository

Recommended: `eadala/adala-ai-arc-test` (empty or fixture commits only).  
Do **not** install the App on customer production-critical repos until a separate authorization exists.

## 2. Required repository permissions (justify each)

| Permission | Access | Why |
|---|---|---|
| **Contents** | read | Verify immutable commit / tree SHAs |
| **Metadata** | read | Required by GitHub for any installation |
| **Pull requests** | read | PR + review evidence (human review ≠ CI) |
| **Checks** | read | Check-run / required-check conclusions |
| **Actions** | read | Workflow run status |
| **Commit statuses** | read | Legacy status API fallback |

**Must remain unset / none:** Administration, Contents write, Pull requests write, Actions write, Secrets, Workflows write, Deployments write, Environments write.

## 3. App creation steps

1. GitHub → Settings → Developer settings → GitHub Apps → New GitHub App.
2. Name: `Adalah ARC Read-Only (Test)`.
3. Homepage URL: internal ops doc link (no public ARC exposure required).
4. Webhook: **inactive** (no deploy hooks).
5. Set permissions exactly as above (read-only).
6. Where can this App be installed? → **Only on this account** (or org with restricted installers).
7. Create App → generate and download private key **once** → store in secret manager immediately.
8. Note **App ID**.
9. Install App → select **only** `eadala/adala-ai-arc-test` → note **Installation ID**.

## 4. Token generation and expiration

ARC uses installation tokens (preferred over PATs):

1. Build short-lived App JWT (~10 minutes) with App ID + private key (`buildAppJwt`).
2. `POST https://api.github.com/app/installations/{installation_id}/access_tokens`
3. Use returned `token` until `expires_at` (~1 hour); renew; never write token to disk/git/logs.
4. Optional override: set `ARC_GITHUB_TOKEN` to a freshly minted installation token for a single validation window.

**Do not** use classic PATs with `repo` write scope.

## 5. Required environment variables (placeholders)

```bash
ARC_GITHUB_MODE=live
ARC_GITHUB_APP_ID=<numeric_app_id>
ARC_GITHUB_APP_INSTALLATION_ID=<numeric_installation_id>
ARC_GITHUB_APP_PRIVATE_KEY=<PEM_IN_SECRET_STORE>
# OR short-lived:
# ARC_GITHUB_TOKEN=<installation_token>
ARC_GITHUB_REPO_ALLOWLIST=eadala/adala-ai-arc-test
# Must be unset or false:
# ARC_GITHUB_ALLOW_MUTATION=
```

## 6. API connectivity checks (read-only)

After secrets are bound and live validation is authorized:

| Check | Expected |
|---|---|
| `GET /repos/eadala/adala-ai-arc-test` | 200; harness may report `VERIFIED_LIVE_TEST` |
| `GET /repos/evil/not-allowed` via ARC allowlist | Denied (`repository_not_allowlisted`) |
| Token appears in logs/API bodies | **Must not** — redacted |
| Any write API | Must not be called by ARC |

Endpoint inventory: `GITHUB_READONLY_ENDPOINTS` in `artifacts/arc-server/src/adapters/githubApp.ts`.

## 7. Failure handling

| Condition | Expected ARC result |
|---|---|
| Missing App/token | `BLOCKED_NO_CREDENTIALS` |
| Wrong allowlist / unauthorized repo | `UNAVAILABLE` / allowlist deny |
| Rate limit | `DEGRADED` + `rate_limited` |
| Timeout | `UNAVAILABLE` + `timeout` |
| Mutation flag true | Config validation **error**; refuse |

## 8. Revocation and rollback

1. Uninstall App from repository **or** suspend App in GitHub.
2. Delete/rotate private key in secret store.
3. Unset `ARC_GITHUB_MODE` / tokens on ARC host → fixture mode.
4. Confirm `GET /api/arc/healthz` shows live GitHub not CONFIGURED.
5. Re-run local `pnpm test` (fixtures) to confirm no regression.

## 9. Expected outcomes

| Step | Expected result |
|---|---|
| App installed on test repo only | Installation ID recorded |
| Secrets bound | Config API redacts values; `githubAppConfigPresent` may be true |
| Live harness (authorized) | `github.live` = `VERIFIED_LIVE_TEST` **or** explicit FAILED — never fixture labeled as live |
| Deploy/mutation | Still impossible via ARC |
