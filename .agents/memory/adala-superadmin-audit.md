---
name: Adala SuperAdmin Enterprise Hardening
description: Complete unification of SA auth layer — all 37 legacy isSuperAdmin removed, rate limiting, 19-test suite
---

## The Rule
Single Source of Truth for SA auth: `checkIsSuperAdmin(userId)` and `requireSuperAdmin` from `requireAuth.ts`.
Never write local isSuperAdmin/guard/adminOnly functions in individual route files.

## Canonical Pattern
```typescript
import { requireSuperAdmin } from "../../middlewares/requireAuth";
const adminOnly = requireSuperAdmin;  // aliased for clarity
```
Or for context functions (getAdminUser/getMgmtUser):
```typescript
import { checkIsSuperAdmin } from "../../middlewares/requireAuth";
const isSA = await checkIsSuperAdmin(auth.userId);
```

**Why:** 37 files had divergent implementations — VITE_ env, PLATFORM_OWNER_EMAIL only,
SYNC JWT, DB users table. Each broke in a different way when SA was revoked mid-session.

## Rate Limiting (built into requireSuperAdmin)
- >5 failed SA attempts/IP in 60s → 5-min block → HTTP 429 + Retry-After
- Every failure logged to audit_logs (SA_ACCESS_DENIED)
- `getSaRateLimitStats()` exported from requireAuth.ts for dashboards

## Tests
`src/tests/superAdminAuth.test.ts` — 19/19 pass. Run: `npx tsx src/tests/superAdminAuth.test.ts`

## Circular Dependency Exception
`tenantMiddleware.ts` has its own `isSuperAdminUser` — this is INTENTIONAL.
requireAuth.ts imports from tenantMiddleware.ts, so tenantMiddleware cannot import back.
Its logic mirrors checkIsSuperAdmin exactly (acceptable local copy for architectural reasons).

## Files Fixed (37 total)
Batches: aiCommandCenter, devCommander, agentRuntime, hosting, platformCommand,
studio, deploymentCenter, homeCms, admin, planCms, tenantDebug, dataVault,
demo-sync, managedIntegrations, investorMetrics, launchGate, goLiveMetrics,
productionLaunch, certification, branches, engineering (special: +engineering_access),
infrastructure, aiChat (inline SYNC), billing (inline PLATFORM_OWNER),
client-auth/client-portal/storage (context fns: checkIsSuperAdmin),
aiWorkflowBuilder (local fn removed), developer, monitoring×6,
documentCenter, messages, bankruptcyDemo, jlwm/index
