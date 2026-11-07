# Engineering Baseline — Adalah AI Recovery

**Generated:** 2026-11-07 02:45 Asia/Riyadh  
**Updated:** 2026-11-07 03:00 Asia/Riyadh — precision remediation pass  
**Evidence window:** Stage 1 read-only inspection before further remediation  
**Gate A:** Documented — remediation may proceed after this file lands on the recovery branch  
**Reference SHA (handoff):** `56e2815` — verified identical at start of precision pass

---

## 1. Git state (VERIFIED)

| Item | Value |
|------|--------|
| Branch | `cursor/recovery-production-readiness-da81` |
| HEAD SHA | `78f4c6f127ba07aeffb5e6dcbc8af581597820dd` |
| Tracking | `origin/cursor/recovery-production-readiness-da81` (clean, in sync) |
| Working tree | Clean — no uncommitted changes |
| Base | `origin/main` @ `c9667a0b3229ad371b7b0f99f0cf187bd99532e5` |
| Commits ahead of main | **2** |
| | `16f06f7` — notifications / plan-notifications tenant scope + recovery docs |
| | `78f4c6f` — invitations interim, mediators/stats SA, Stripe registry path |

**Unrelated local branch (not used):** `cursor/tenant-middleware-canonical-da81` @ `9e0fe9f` — diverged; missing migrations 003–057 in that lineage; do not merge blindly.

---

## 2. PR #138 (VERIFIED)

| Item | Value |
|------|--------|
| URL | https://github.com/eadala/adala-ai/pull/138 |
| State | **OPEN**, not draft |
| Base → Head | `main` ← `cursor/recovery-production-readiness-da81` |
| Mergeable | **MERGEABLE** |
| Title | fix(security): Master recovery — tenant-scope notifications for production launch |
| Body | Human/agent summary preserved; Cursor agent markers present |

---

## 3. PR #137 / Migration 057 (VERIFIED)

| Item | Value |
|------|--------|
| PR #137 | **MERGED** 2026-08-30 13:51 Asia/Riyadh |
| Merge commit | `c9667a0` (= current `origin/main`) |
| Migration file on branch | `artifacts/api-server/migrations/057_monitoring_isolation_rls_schema_authority.sql` **PRESENT** |
| Applied on production DB | **NOT VERIFIED** (agent `DATABASE_URL` unset) |

---

## 4. CI status on HEAD `78f4c6f` (partially VERIFIED)

Source: `gh pr checks 138` / Actions runs `42313008619` (push) and `42313014302` (pull_request) as of ~2026-11-07 02:45 Asia/Riyadh.

| Check | Result | Notes |
|-------|--------|-------|
| Tests — existing suite | **PASS** | Includes `test:notifications-tenant`, `test:rbac-invitations` |
| Gate 2 — ESLint | **PASS** | |
| Gate 3 — Build & Bundle | **PASS** | |
| Gate 4 — Security Scan | **PASS** | |
| Gate 6 — Accessibility | **PASS** | |
| Gate 7 — Architecture | **PASS** | |
| Gate 8 — Tenant Isolation | **PASS** | |
| Gate 9 — License | **PASS** | |
| Docker — production Dockerfile | **PASS** | |
| Gate 10 — Commit Convention | PASS on PR run / SKIPPED on push | Expected |
| **Gate 1 — TypeScript** | **PASS** on `56e2815` CI | Re-verify after tip |
| **Gate 5 — Dependency Audit** | **FAIL** on `56e2815`; **remediated locally** (orval≥8.21, proxy-addr≥2.0.8) | Push tip then re-check CI |
| DB Migrations — test:db-migrations | Was pending at baseline; re-check on tip | |

### 4.1 Gate 1 — TypeScript

TS2538 on `rbac.ts` fixed in `56e2815`. After lockfile refresh, `dotenv` declared on `@workspace/api-server` so `runSeed.ts` resolves (hoisting loss). Local typecheck **PASS**.

### 4.2 Gate 5 — Dependency Audit

Critical advisories cleared locally (`CRITICAL=0`):

- `orval` upgraded `8.9.1` → `8.46.0` (devDependency `@workspace/api-spec`; build-time RCE class)
- `proxy-addr` forced `>=2.0.8` via root `pnpm.overrides` (express transitive)
- Root override also pins `orval: ">=8.21.0"`

Remaining: high/moderate advisories — **not** Gate 5 blockers.

---

## 5. Migration inventory (VERIFIED in repo)

| Item | Value |
|------|--------|
| SQL migration files | **55** under `artifacts/api-server/migrations/` |
| 053 | `053_security_centers_schema_authority.sql` PRESENT |
| 054 | `054_platform_runtime_schema_authority.sql` PRESENT |
| 055 | `055_platform_runtime_b2_schema_authority.sql` PRESENT |
| 056 | `056_rls_runtime_schema_authority.sql` PRESENT |
| 057 | `057_monitoring_isolation_rls_schema_authority.sql` PRESENT |
| Applied to production | **NOT VERIFIED** |
| Applied to agent DB | N/A — `DATABASE_URL` unset |

---

## 6. Environment inventory (agent VM)

| Secret / config | Agent status |
|-----------------|--------------|
| `DATABASE_URL` | **unset** |
| `CLERK_SECRET_KEY` | **unset** |
| `STRIPE_SECRET_KEY` | **unset** |
| `GEMINI_API_KEY` | **unset** |
| Coolify / Hetzner live access | **NOT AVAILABLE** |
| Production deploy authority | **BLOCKED by policy** (INV-009) |

Sanitized requirements: `docs/deployment/PRODUCTION_ENVIRONMENT_REFERENCE.md`.

---

## 7. Deployment definitions (repo-present)

| Artifact | Status |
|----------|--------|
| `Dockerfile` | PRESENT |
| `docker-compose.yml` | PRESENT |
| `infra/DEPLOYMENT_GUIDE.md` | PRESENT |
| `DEPLOY.md` | PRESENT |
| `docs/deployment/PRODUCTION_DEPLOYMENT_PLAN.md` | PRESENT (recovery) |
| Live Coolify/Hetzner config | **NOT VERIFIED** from agent |

---

## 8. Existing recovery / security docs on branch

| Doc | Present |
|-----|---------|
| `docs/recovery/INITIAL_PROJECT_STATE.md` | Yes |
| `docs/recovery/RECOVERY_CHANGELOG.md` | Yes |
| `docs/recovery/FINAL_GO_LIVE_DECISION.md` | Yes (**CONDITIONAL GO**) |
| `docs/security/SECURITY_AUDIT.md` | Yes |
| `docs/database/DATABASE_RECOVERY_REPORT.md` | Yes |
| `docs/architecture/FUTURE_EXTENSION_ARCHITECTURE.md` | Yes |
| `docs/security/ROOT_CAUSE_ANALYSIS.md` | **Missing** (Stage 2) |
| `docs/security/TENANT_AUTHORIZATION_MATRIX.md` | **Missing** |
| `docs/security/SECURITY_REGRESSION_REPORT.md` | **Missing** |
| `docs/database/MIGRATION_VERIFICATION.md` | **Missing** |
| `docs/database/BACKUP_RESTORE_DRILL.md` | **Missing** |
| `docs/integrations/STRIPE_WEBHOOK_VERIFICATION.md` | **Missing** |
| `docs/integrations/AI_AND_STORAGE_VERIFICATION.md` | **Missing** |
| `docs/deployment/PRODUCTION_RELEASE_RUNBOOK.md` | **Missing** |

---

## 9. Reported findings — revalidation status

| ID | Handoff claim | Revalidation |
|----|---------------|--------------|
| SEC-001 notifications | Fixed on branch | **VERIFIED** in code + `test:notifications-tenant` (local PASS; CI Tests suite PASS) |
| SEC-005 invitations | Interim `invited_by` | **VERIFIED** in code + `test:rbac-invitations`; **incomplete** vs office ownership (no `office_id`) |
| SEC-007 mediators/stats | Super Admin | **VERIFIED** in code + contract assert in `test:rbac-invitations` |
| SEC-008 Stripe path | `/api/stripe/webhook` | **VERIFIED** registry + `app.ts` handler path; live Dashboard config **NOT VERIFIED** |
| Migration 057 / #137 | Merged | **VERIFIED** merged; prod apply **NOT VERIFIED** |
| Production secrets | Human-gated | **VERIFIED** unset in agent |
| Backup restore | Outstanding | **NOT VERIFIED** / **BLOCKED** |
| Deploy | Needs approval | Policy **BLOCKED** |

---

## 10. Known defects / immediate release blockers

### P0 (security / data)

| ID | Status | Notes |
|----|--------|-------|
| Cross-tenant notification aggregator | **Mitigated on branch** | Live two-office E2E still NOT VERIFIED |
| Invitations lack `office_id` | **Interim control only** | Same-office admin who did not invite cannot manage invites; acceptance path needs Phase D RCA |
| Empty-tenant RLS bypass class | **Known architectural risk** | Must be covered in Stage 2 RCA; app must set `app.current_tenant` |

### P1 (release / CI / ops)

| ID | Status |
|----|--------|
| Gate 1 TypeScript — `rbac.ts:480` TS2538 | **FAIL — introduced by PR #138** |
| Gate 5 Dependency Audit — critical vulns | **FAIL — likely pre-existing** |
| DB Migrations CI job | Pending at baseline time |
| Prod migrations 053–057 confirmation | Human |
| Prod secrets + Stripe Dashboard webhook URL | Human |
| Backup restore drill | Human / isolated env |
| Explicit deploy approval | Human |

### P2+

Documented in prior audit; do not block Stage 2 security RCA.

---

## 11. Active test commands (recovery-critical)

```bash
pnpm --filter @workspace/api-server run test:notifications-tenant
pnpm --filter @workspace/api-server run test:rbac-invitations
pnpm --filter @workspace/api-server run test:stage9-security
pnpm --filter @workspace/api-server run test:monitoring-isolation-057
pnpm --filter @workspace/api-server run test:storage-signed-open
# Gate 1 equivalent:
(cd lib/db && pnpm exec tsc -p tsconfig.json)
(cd lib/api-zod && pnpm exec tsc -p tsconfig.json)
pnpm --filter @workspace/adala run typecheck
pnpm --filter @workspace/api-server run typecheck
```

---

## 12. Unverified claims (do not treat as PASS)

1. Production has applied migrations 053–057.  
2. Coolify production env matches `PRODUCTION_ENVIRONMENT_REFERENCE.md`.  
3. Stripe Dashboard points at `/api/stripe/webhook`.  
4. Live multi-tenant E2E isolation.  
5. Backup encryption / restore RTO/RPO.  
6. Gate 5 failure is non-blocking for launch (needs runtime reachability triage).  
7. Invitation acceptance cannot assign unauthorized office/role (Phase D).  

---

## 13. Immediate next engineering batches (after Gate A)

1. **Batch K1:** Fix `rbac.ts` TS2538 — restore Gate 1 green (scoped).  
2. **Batch B:** `docs/security/ROOT_CAUSE_ANALYSIS.md` for SEC-001/005/007/008 + empty-tenant RLS.  
3. **Batch C/D:** Authorization matrix + invitation ownership decision (schema migration proposal if required).  
4. **Batch F–H:** Stripe / storage / AI verification docs + code only if defects verified.  
5. **Batch Gate 5:** Triage critical advisories; upgrade only if justified and safe.

**No production deploy, migration apply, or secret injection without human approval.**

---

## Evidence sources

- `git status` / `git rev-parse HEAD` / `git log origin/main..HEAD`  
- `gh pr view 138` / `gh pr view 137` / `gh pr checks 138`  
- Local: `pnpm --filter @workspace/api-server run typecheck` (after lib builds)  
- Local: `pnpm audit --audit-level=critical`  
- Repo paths listed above
