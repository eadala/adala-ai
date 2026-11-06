# Recovery Changelog

## 2026-11-07 — Branch `cursor/recovery-production-readiness-da81`

### Phase 0
- Branched from `origin/main` @ `c9667a0` (includes merged Migration 057 / PR #137).
- Documented initial state in `docs/recovery/INITIAL_PROJECT_STATE.md`.
- Abandoned incomplete `cursor/tenant-middleware-canonical-da81` workspace as recovery base (missing migrations).

### Phase 1A — Notification cross-tenant fix (P0)
- **Files:**
  - `artifacts/api-server/src/modules/operations/notifications.ts`
  - `artifacts/api-server/src/modules/financial/subscription.ts`
  - `artifacts/api-server/src/tests/notificationsTenantIsolation.test.ts` (new)
  - `artifacts/api-server/package.json` (`test:notifications-tenant`)
  - `.github/workflows/ci.yml` (wire test)
- **Change:** `requireAuthWithTenant` + `office_id` filters; omit unscoped `invitations`/`messages`; leaves via `employees` join.
- **Verification:** `test:notifications-tenant` PASS; `test:stage9-security` PASS.

### Phase 1B — Migration 057
- **Verified:** PR #137 MERGED; Runtime RLS DDL absent on main `isolation.ts`.
- **No code change.** Production apply still human-gated.

### Follow-up hardening (same recovery branch)
- **SEC-005:** `/rbac/invitations` scoped by `invited_by` (interim; no `office_id` yet).
- **SEC-007:** `/mediators/stats` → `requireSuperAdmin`.
- **SEC-008:** `integrationsRegistry` Stripe webhook path → `/api/stripe/webhook`.
- Test: `test:rbac-invitations` (CI-wired).

### Docs added
- `docs/security/SECURITY_AUDIT.md`
- `docs/deployment/PRODUCTION_ENVIRONMENT_REFERENCE.md`
- `docs/deployment/PRODUCTION_DEPLOYMENT_PLAN.md`
- `docs/database/DATABASE_RECOVERY_REPORT.md`
- `docs/architecture/FUTURE_EXTENSION_ARCHITECTURE.md`
- `docs/recovery/FINAL_GO_LIVE_DECISION.md`
