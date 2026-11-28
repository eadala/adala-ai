# Acceptance Gate Matrix — Staging Asset 403 Recovery

Statuses: PASS | FAIL | BLOCKED | NOT RUN

Updated: 2026-11-28 (Asia/Riyadh) — CI green on PR #188 @ `fb6a6302`.

| Gate | Status | Evidence |
|------|--------|----------|
| G01 Root cause reproduced | PASS | Live prod probe: staging Origin → `CORS_ORIGIN_NOT_ALLOWED` JSON 403; differential harness reproduces baseline |
| G02 Application fix implemented | PASS | `corsOriginPolicy.ts` same-origin + `STAGING_CORS_DOMAINS`; early static retained |
| G03 Mock auth contract verified | PASS | Mock suite Layer-1 only; primary proof is CORS differential + real app |
| G04 Regression detects original defect | PASS | `test:frontend-static-cors` broken-baseline asserts 403 JSON |
| G05 Real application integration | PASS | `test:frontend-static-prod` boots real `app` |
| G06 Production-mode Docker artifact | PASS | CI `Docker — production Dockerfile` SUCCESS on PR #188 @ `fb6a6302` |
| G07 JS/CSS delivery verified | PASS (lab) / BLOCKED (live staging) | Lab harnesses PASS; live staging Traefik Basic Auth 401 |
| G08 Security boundary regression | PASS | evil Origin 403; `/.env` 404; API 401/403 |
| G09 Auth initialization verified | BLOCKED | Needs staging Basic Auth + browser after deploy |
| G10 Tenant isolation / RLS | PASS | CI Gate 8 SUCCESS; no RLS code weakened |
| G11 Staging resource isolation | BLOCKED | No Coolify/DB credential access from agent |
| G12 Required CI gates | PASS | PR #188 `✅ All Gates Passed` (Tests, Docker, TS, ESLint, Security, Tenant Isolation, DB Migrations, RG) |
| G13 Commit/PR traceability | PASS | Branch `cursor/staging-asset-403-recovery-da81`, PR #188, SHA `fb6a6302` |
| G14 Staging deployed revision | BLOCKED | Fix **not** on `develop` yet (`REVIEW_REQUIRED`); Coolify not redeployed |
| G15 Live browser bootstrap | BLOCKED | Traefik Basic Auth; undeployed fix |
| G16 Authenticated staging workflow | BLOCKED | No staging test user + undeployed |
| G17 No production modification | PASS | Zero production deploys/config changes |
| G18 Recovery docs completed | PASS | This directory + `scripts/staging/smoke-asset-delivery.mjs` |

**Decision:** STAGING PARTIALLY RECOVERED — BLOCKERS REMAIN

**Next owner actions (exact):**
1. Approve & merge PR #188 into `develop`.
2. Coolify staging redeploy of merged `develop` SHA; set `ALLOWED_ORIGINS=https://staging.adalahai.com`.
3. Run: `STAGING_BASIC_AUTH_USER=… STAGING_BASIC_AUTH_PASS=… node scripts/staging/smoke-asset-delivery.mjs`
4. Browser: Clerk login + dashboard (staging Clerk Dev user).
