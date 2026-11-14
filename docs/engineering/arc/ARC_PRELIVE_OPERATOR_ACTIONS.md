# ARC Pre-Live Operator Activation Package

**Authorization granted by PRELIVE_GO:** human **setup preparation** only.  
**Not granted:** live validation, deployment, production access.

## Identity provider (isolated test)

1. Create dedicated OIDC app (Clerk/Auth0/Keycloak) — **not** customer Adalah Clerk.  
2. Configure issuer, audience `adalah-arc`, RS256, JWKS HTTPS.  
3. Enforce MFA; enroll operators; record `sub` values.  
4. Bind secrets: `ARC_OIDC_*`, `ARC_ALLOW_DEV_HMAC=false`.  
5. Verify config probe shows unblocked readiness **without** classifying as live success until runbook authorized.  
Guides: `ARC_LIVE_OIDC_OPERATOR_GUIDE.md`, `ARC_PHASE2CG_IDENTITY_SETUP.md`.

## GitHub App (read-only, test repo)

1. Create App with Contents/Metadata/PR/Checks/Actions/Statuses **read**.  
2. Install **only** on `eadala/adala-ai-arc-test` (or approved test repo).  
3. Store App ID, installation ID, private key in secret manager.  
4. Set `ARC_GITHUB_REPO_ALLOWLIST` exactly; never `*`.  
5. Revocation: uninstall App + rotate key.  
Guide: `ARC_LIVE_GITHUB_APP_OPERATOR_GUIDE.md`.

## Activation controls

| Control | Requirement |
|---|---|
| Human approvals | Written approval for IdP, App install, later live window |
| Authorized endpoints | Loopback ARC API GETs + deploy probe POSTs expecting 403 |
| Expected outputs | Harness classifications; `VERIFIED_LIVE_TEST` only after live exercise |
| Rollback | Unset live modes; revoke IdP users; uninstall App |
| Immediate termination | Any write scope on GitHub App; any deploy 2xx; secret leakage; Coolify prod contact |

## Before LIVE validation authorization

1. Remediate **F-PRELIVE-001** (BASE_URL allowlist + curl timeouts).  
2. Complete checklist B–D.  
3. Set `ARC_LIVE_VALIDATION_AUTHORIZED=true` only for the approved window.
