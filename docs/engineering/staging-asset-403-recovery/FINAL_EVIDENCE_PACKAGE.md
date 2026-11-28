# FINAL EXECUTIVE EVIDENCE PACKAGE — Staging Asset 403 / CORS

**Directive:** ADALA-P0-STAGING-CLOSURE  
**Incident ID:** STAGING-ASSET-403-CORS-2026-11  
**Report time (Asia/Riyadh):** 2026-11-28

---

## A. Executive Decision

**STAGING PARTIALLY RECOVERED — EXTERNAL BLOCKERS REMAIN**

All independently executable engineering work for the CORS remediation is complete, tested, committed, and on PR #188. Live staging operational closure requires owner Approve/merge + Coolify redeploy + Traefik Basic Auth verification.

---

## B. Root Cause and Remediation

| Item | Detail |
|------|--------|
| Component | `evaluateCorsOrigin` / Express CORS middleware (`corsOriginPolicy.ts` ← `app.ts`) |
| Trigger | Vite `crossorigin` asset GETs send `Origin: https://staging.adalahai.com` |
| Failure | Origin absent from allowlist → `403` + `application/json` + `CORS_ORIGIN_NOT_ALLOWED` |
| Effect | JS/CSS fail → React/Clerk never init → indefinite loader |
| Live proof | Prod host + staging Origin → same JSON 403; production Origin → 200 |
| Fix | Explicit trusted-origin allowlist: production + staging domains + validated `ALLOWED_ORIGINS` |
| Explicitly removed | Host / `X-Forwarded-Host` reflection |

---

## C. Implementation Record

| Area | Files |
|------|-------|
| CORS policy | `artifacts/api-server/src/lib/corsOriginPolicy.ts` |
| Wiring | `artifacts/api-server/src/app.ts` (`parseAllowedOriginsEnv`) |
| Early static | `productionFrontendStatic.ts`, `publicFrontendAssetPath.ts` |
| Tests | `corsOriginPolicy.test.ts`, `frontendStaticCorsIncident.test.ts`, `frontendStaticDelivery.test.ts`, `frontendStatic.prodApp.*.ts` |
| CI | `.github/workflows/ci.yml` (`test:frontend-static*`) |
| Smoke | `scripts/staging/smoke-asset-delivery.mjs` |
| Docs | `docs/engineering/staging-asset-403-recovery/*` |

**Security impact:** Narrows trust to exact origins; does not weaken Clerk, CSRF, authz, tenant isolation, or RLS.

---

## D. Verification Evidence (executed locally)

| Command | Exit |
|---------|------|
| `pnpm --filter @workspace/api-server run test:cors-origin` | **0** |
| `pnpm --filter @workspace/api-server run test:frontend-static-cors` | **0** |
| `pnpm --filter @workspace/api-server run test:frontend-static` | **0** |
| `pnpm --filter @workspace/api-server run test:frontend-static-prod` | **0** |
| `pnpm --filter @workspace/api-server run test:stage9-security` | **0** |

Differential: broken baseline → staging Origin asset **403 JSON**; fixed → **200** JS/CSS MIME; evil Origin → **403**.

CI tip `2c54d9c0` (partial, concurrent with this tip's follow-up): Docker production Dockerfile **pass**, Tests **pass**, Gates 1–10 **pass**; DB Migrations **pending** at report draft time.

---

## E. Release Identity

| Item | Value |
|------|-------|
| Branch | `cursor/staging-asset-403-recovery-da81` |
| Tip SHA | see latest push after adversarial test commit |
| PR | https://github.com/eadala/adala-ai/pull/188 → `develop` |
| On develop? | **No** (`REVIEW_REQUIRED`) |
| Staging deployed SHA | **Unknown / not this fix** (Traefik 401) |
| Production mods | **0** |

---

## F. Acceptance Matrix G01–G21

| Gate | Status | Notes |
|------|--------|-------|
| G01 Root cause evidence | PASS | Live + differential |
| G02 Application remediation | PASS | Trusted-origin allowlist |
| G03 Explicit trusted-origin policy | PASS | Code + validated env |
| G04 Host/XF-Host reflection removed | PASS | No `requestPublicOrigin` trust path |
| G05 Original incident regression | PASS | `test:frontend-static-cors` |
| G06 Malicious-origin rejection | PASS | evil + lookalikes + OPTIONS |
| G07 Static asset delivery | PASS (lab) | MIME + missing 404 |
| G08 Authz preserved | PASS | API 401/403 in prod-app test |
| G09 Tenant/RLS preserved | PASS | No RLS edits; CI Gate 8 |
| G10 Docker artifact | PASS (CI) | Docker job pass on tip; local CLI BLOCKED |
| G11 Required CI | NOT RUN→pending | DB Migrations in progress; re-confirm after tip push |
| G12 Git durability | PASS | Remote branch pushed |
| G13 PR/integration traceability | PASS | PR #188 |
| G14 Staging deployment verified | BLOCKED | Needs merge + Coolify |
| G15 Deployed revision match | BLOCKED | Undeployed |
| G16 Live React bootstrap | BLOCKED | Traefik 401 |
| G17 Live Clerk login | BLOCKED | Traefik 401 |
| G18 Authenticated workflow | BLOCKED | No staging test user |
| G19 Staging resource isolation | BLOCKED | No Coolify DB access |
| G20 Rollback/continuity docs | PASS | Runbook + CONTINUATION |
| G21 Production mods = 0 | PASS | Verified |

---

## G. Security Assessment

**Resolved:** CORS staging Origin miss; Host reflection risk removed; wildcard/path ALLOWED_ORIGINS rejected; localhost gated out of production NODE_ENV.

**Unresolved / external:** Live Traefik verification; Coolify isolation attestation; authenticated staging E2E.

---

## H. Operator Handoff (exact)

### B-01 — Protected branch approval
- **Stage:** Integration  
- **Need:** Approve & merge PR #188 into `develop`  
- **Why blocked:** `reviewDecision=REVIEW_REQUIRED`  
- **Verify:** `gh pr view 188 --json mergedAt,mergeCommit`

### B-02 — Coolify staging redeploy
- **App:** `adala-ai-staging-isolated`  
- **After:** merge lands on `develop`  
- **Runtime env (non-secret):** `ALLOWED_ORIGINS=https://staging.adalahai.com`  
- **Also required (secrets — rotate if exposed):** staging `CLERK_SECRET_KEY`, Clerk Dev publishable via build arg `VITE_CLERK_PUBLISHABLE_KEY`, isolated `DATABASE_URL`  
- **Verify:** Coolify shows deployed commit = merge SHA; `GET /api/healthz` 200 behind Basic Auth

### B-03 — Live smoke + browser
```bash
STAGING_URL=https://staging.adalahai.com \
STAGING_BASIC_AUTH_USER='…' \
STAGING_BASIC_AUTH_PASS='…' \
node scripts/staging/smoke-asset-delivery.mjs
```
Then browser: React bootstrap + Clerk Dev login (no production credentials).

---

## I. Production Protection

**Production-impacting actions performed: ZERO.**

---

## J. Rollback

1. Coolify → previous staging image/SHA (do not call an unverified revision “known-good”).  
2. Or revert merge commit on `develop` and redeploy.  
3. Expect recurrence of staging Origin JSON 403 if rolled back without alternate allowlist.
