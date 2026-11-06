# Security Regression Report

**Date:** 2026-11-07 (Asia/Riyadh)  
**Branch tip at report:** includes Stage 1 baseline + Gate 1 TS fix (see git log)

| Test | Command | Result | Evidence |
|------|---------|--------|----------|
| Notifications tenant contract | `pnpm --filter @workspace/api-server run test:notifications-tenant` | **PASS** | Local + CI Tests suite |
| RBAC invitations / stripe path / mediators | `pnpm --filter @workspace/api-server run test:rbac-invitations` | **PASS** | Local + CI Tests suite |
| Stage 9 HEAL / SPA guard | `pnpm --filter @workspace/api-server run test:stage9-security` | **PASS** | Local prior + CI suite |
| Gate 8 Tenant Isolation (CI job) | CI workflow | **PASS** on PR #138 | `gh pr checks` |
| TypeScript Gate 1 | CI + local after lib build | **FAIL** before TS2538 fix; **PASS** expected after fix commit | `rbac.ts` index type |
| Live Office A/B HTTP isolation | Manual/E2E | **NOT EXECUTED** | No Clerk credentials |
| Stripe webhook signature live | Stripe test mode | **NOT EXECUTED** | No Stripe secret |
| Storage signed-url live R2 | Integration | **NOT EXECUTED** | No R2 secrets |
| Backup restore | Isolated drill | **NOT EXECUTED** | No prod backup access |

**Do not treat unexecuted rows as PASS.**
