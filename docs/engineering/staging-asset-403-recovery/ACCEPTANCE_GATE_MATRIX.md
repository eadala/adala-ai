# Acceptance Gate Matrix G01–G21

Statuses: PASS | FAIL | BLOCKED | NOT RUN  
Tip: `551feac2` (Asia/Riyadh 2026-11-28)

| Gate | Status | Evidence |
|------|--------|----------|
| G01 Root cause established | PASS | Live prod Origin probe + differential harness |
| G02 Application remediation | PASS | Trusted-origin allowlist in `corsOriginPolicy.ts` |
| G03 Explicit trusted-origin policy | PASS | Code + validated `ALLOWED_ORIGINS` |
| G04 Host/XF-Host reflection removed | PASS | No Host-based grant path |
| G05 Original incident regression | PASS | `test:frontend-static-cors` before/after |
| G06 Malicious-origin rejection | PASS | evil + lookalikes + OPTIONS preflight |
| G07 Static asset delivery | PASS (lab) | MIME + 404; live BLOCKED Traefik |
| G08 Authn/authz preserved | PASS | API 401/403 in real-app test |
| G09 Tenant/RLS preserved | PASS | No RLS edits; CI Gate 8 |
| G10 Docker artifact | PASS (CI @ 2c54d9c0) | Docker job pass; local CLI absent; tip CI re-running |
| G11 Required CI | NOT RUN | Tip `551feac2` CI in flight after push |
| G12 Git durability | PASS | Remote `cursor/staging-asset-403-recovery-da81` |
| G13 PR/integration traceability | PASS | PR #188 → develop |
| G14 Staging deployment | BLOCKED | Needs merge + Coolify (`ADALA_STAGING_CD_ACTIVE` or manual) |
| G15 Deployed revision match | BLOCKED | Undeployed |
| G16 Live React bootstrap | BLOCKED | Traefik Basic Auth 401 |
| G17 Live Clerk login | BLOCKED | Traefik 401 |
| G18 Authenticated workflow | BLOCKED | No staging test user |
| G19 Staging resource isolation | BLOCKED | No Coolify DB attestation |
| G20 Rollback/continuity docs | PASS | Runbook + FINAL_EVIDENCE_PACKAGE |
| G21 Production mods = 0 | PASS | Zero prod changes |

**Decision:** STAGING PARTIALLY RECOVERED — EXTERNAL BLOCKERS REMAIN
