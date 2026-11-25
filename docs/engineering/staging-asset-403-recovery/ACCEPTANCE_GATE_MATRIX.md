# Acceptance Gate Matrix — Staging Asset 403 Recovery

Statuses: PASS | FAIL | BLOCKED | NOT RUN

| Gate | Status | Evidence |
|------|--------|----------|
| G01 Root cause reproduced | PASS | Live prod probe: staging Origin → `CORS_ORIGIN_NOT_ALLOWED` JSON 403; differential harness reproduces baseline |
| G02 Application fix implemented | PASS | `corsOriginPolicy.ts` same-origin + `STAGING_CORS_DOMAINS`; early static retained |
| G03 Mock auth contract verified | PASS | Mock suite documented as Layer-1 only; primary proof is CORS differential + real app |
| G04 Regression detects original defect | PASS | `test:frontend-static-cors` broken-baseline asserts 403 JSON |
| G05 Real application integration | PASS | `test:frontend-static-prod` boots real `app` |
| G06 Production-mode Docker artifact | BLOCKED | Docker CLI absent in this agent VM; CI `Docker — production Dockerfile` green on PR #188 for prior SHA — re-verify after new push |
| G07 JS/CSS delivery verified | PASS | Local harnesses; live staging BLOCKED (Traefik Basic Auth) |
| G08 Security boundary regression | PASS | evil Origin 403; `/.env` 404; API 401/403 |
| G09 Auth initialization verified | BLOCKED | Needs staging Basic Auth + browser |
| G10 Tenant isolation / RLS | PASS | Existing Gate 8 CI; no RLS code weakened |
| G11 Staging resource isolation | BLOCKED | No Coolify/DB credential access from agent |
| G12 Required CI gates | NOT RUN | Pending push of this commit; prior PR checks largely green |
| G13 Commit/PR traceability | PASS | Branch `cursor/staging-asset-403-recovery-da81`, PR #188 |
| G14 Staging deployed revision | BLOCKED | No Coolify access; Traefik 401 |
| G15 Live browser bootstrap | BLOCKED | Traefik Basic Auth |
| G16 Authenticated staging workflow | BLOCKED | No staging test user credentials |
| G17 No production modification | PASS | Zero production deploys/config changes |
| G18 Recovery docs completed | PASS | This directory |

**Decision while G14–G16 BLOCKED:** STAGING PARTIALLY RECOVERED — BLOCKERS REMAIN
