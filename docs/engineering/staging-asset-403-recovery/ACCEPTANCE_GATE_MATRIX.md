# Acceptance Gate Matrix — Staging Asset 403 Recovery

Statuses: PASS | FAIL | BLOCKED | NOT RUN

Updated: 2026-11-28 (Asia/Riyadh) — trusted-origin allowlist (no Host reflection).

| Gate | Status | Evidence |
|------|--------|----------|
| G01 Root cause reproduced | PASS | Live prod probe + `test:frontend-static-cors` broken baseline |
| G02 Application fix implemented | PASS | Explicit `STAGING_CORS_DOMAINS` + validated `ALLOWED_ORIGINS`; no Host trust |
| G03 Mock auth contract verified | PASS | Layer-1 only; primary = CORS differential + real app |
| G04 Regression detects original defect | PASS | Broken baseline → 403 JSON; fixed → 200 MIME |
| G05 Real application integration | PASS | `test:frontend-static-prod` |
| G06 Production-mode Docker artifact | BLOCKED (local) / PASS (prior CI @ fb6a6302) | Docker CLI absent in agent VM; re-confirm on new tip CI |
| G07 JS/CSS delivery verified | PASS (lab) / BLOCKED (live) | Lab MIME OK; staging Traefik 401 |
| G08 Security boundary regression | PASS | evil Origin 403; no Host reflection; `/.env` 404; API gated |
| G09 Auth initialization verified | BLOCKED | Needs merge + deploy + Basic Auth + browser |
| G10 Tenant isolation / RLS | PASS | No RLS/tenant edits; prior CI Gate 8 green |
| G11 Staging resource isolation | BLOCKED | No Coolify DB access |
| G12 Required CI gates | NOT RUN | Pending push of hardened tip; prior tip All Gates Passed |
| G13 Commit/PR traceability | PASS | PR #188 → develop |
| G14 Staging deployed revision | BLOCKED | Not on develop; `REVIEW_REQUIRED` |
| G15 Live browser bootstrap | BLOCKED | Traefik + undeployed |
| G16 Authenticated staging workflow | BLOCKED | No staging test user + undeployed |
| G17 No production modification | PASS | Zero prod changes |
| G18 Recovery docs completed | PASS | This directory |

**Decision:** STAGING PARTIALLY RECOVERED — BLOCKERS REMAIN

**Owner (exact):** Approve+merge #188 → Coolify redeploy → `scripts/staging/smoke-asset-delivery.mjs` with Basic Auth → Clerk login check.
