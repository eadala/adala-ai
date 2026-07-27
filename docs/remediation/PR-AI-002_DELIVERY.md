# PR-AI-002 — AI Gateway RBAC Enforcement

**Branch:** `cursor/pr-ai-002-ai-gateway-rbac-da81`  
**Phase:** Authorization Layer — AI Surface Hardening

## Problem

AI modules relied on `requireAuth` or `requireAuthWithTenant` only. Any authenticated tenant member could invoke LLMs, read cross-tenant agent logs, abuse credit deduction, and access unscoped analytics.

## Solution

Applied `requirePermission("ai:access")` across **14 tenant-facing AI modules** (~55 routes), aligned with the existing RBAC matrix (`firm_owner`, `office_manager`, `lawyer` have `ai:access`; `accountant` and below do not).

### Key hardening

| Area | Change |
|------|--------|
| **aiGateway.ts** | `requireAuthWithTenant` + `ai:access`; fail-closed tenant; `by-office` analytics → `requireSuperAdmin` |
| **Legacy routes** | `aiChat`, `aiAgents`, `commandCenter` migrated from `requireAuth` |
| **ai-agent** | Logs scoped via `office_members`; workflows scoped by `office_id` |
| **aiCredits** | `/ai-credits/deduct` → `requireSuperAdmin` only; `/office/ai-credits` tenant-scoped |
| **aiChat tasks** | Removed `office_id IS NULL` cross-tenant reads |

### Permission model

- Tenant AI routes: `ai:access`
- Platform admin AI ops: `requireSuperAdmin` (unchanged)
- Workflow builder: `ai:access` + existing `requireWorkflowAccess` grant layer

## Files Changed

- 14 modules under `artifacts/api-server/src/modules/ai/`
- `scripts/governance/platform-check.mjs` — Layer 9 AI RBAC checks
- `artifacts/api-server/src/tests/ai-gateway-rbac.test.ts`

## Verification

```bash
pnpm --filter @workspace/scripts exec tsx ../artifacts/api-server/src/tests/ai-gateway-rbac.test.ts
node scripts/governance/platform-check.mjs
```

## RBAC Matrix Reference

| Role | `ai:access` |
|------|-------------|
| firm_owner | ✅ (wildcard) |
| office_manager | ✅ |
| lawyer | ✅ |
| accountant | ❌ |
| trainee_lawyer | ❌ |
