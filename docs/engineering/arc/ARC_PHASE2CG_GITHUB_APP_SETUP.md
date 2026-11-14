# ARC Phase 2C-G GitHub App Setup

**Read-only.** Prefer a dedicated test repository (e.g. `eadala/adala-ai-arc-test`).

## Permission justifications

| Permission | Access | Justification |
|---|---|---|
| Contents | read | Immutable commit/tree verification |
| Metadata | read | Required by GitHub for installations |
| Pull requests | read | Human review evidence |
| Checks | read | Required-check / workflow conclusions |
| Actions | read | Workflow run status |
| Commit statuses | read | Legacy status fallback |

**Must remain unset:** Administration, Contents:write, Pull requests:write, Actions:write, Secrets, Workflows write, Deployments:write.

## Environment placeholders

| Variable | Purpose |
|---|---|
| `ARC_GITHUB_MODE` | `live` to enable live reads |
| `ARC_GITHUB_APP_ID` | Numeric App ID |
| `ARC_GITHUB_APP_INSTALLATION_ID` | Installation on allowlisted repo |
| `ARC_GITHUB_APP_PRIVATE_KEY` | PEM private key (secret store only) |
| `ARC_GITHUB_TOKEN` | Optional short-lived installation token override |
| `ARC_GITHUB_REPO_ALLOWLIST` | Exact `owner/name` list (no `*`) |
| `ARC_GITHUB_ALLOW_MUTATION` | Must be unset/false |

## Token acquisition architecture

1. Operator stores App private key in secret manager.
2. ARC builds short-lived App JWT (RS256, ~10 min) — `buildAppJwt`.
3. `POST /app/installations/{id}/access_tokens` exchanges JWT for installation token.
4. Token used only for allowlisted GET endpoints; never logged (`redactSecrets`).
5. Renew before `expires_at`; never persist token to disk/git.

Code: `artifacts/arc-server/src/adapters/githubApp.ts`

## Endpoint inventory

See `GITHUB_READONLY_ENDPOINTS` in that module (repos, commits, check-runs, pulls, reviews, actions/runs, releases).

## Human checklist

1. Create GitHub App (org or personal) with **read-only** permissions above.
2. Do **not** enable webhook deployment or repository administration.
3. Install on **test** repository only (preferred) or explicitly authorized read-only on `eadala/adala-ai` with separate sign-off.
4. Copy App ID + installation ID into secret store.
5. Store private key PEM as `ARC_GITHUB_APP_PRIVATE_KEY`.
6. Set allowlist to the installed repo only.
7. Run harness after secrets are bound — do not paste secrets into chat/docs.

## Status

**CONFIGURATION READY** · **LIVE VERIFICATION BLOCKED** until operator installs App + binds secrets  
This phase did **not** create or install an App.
