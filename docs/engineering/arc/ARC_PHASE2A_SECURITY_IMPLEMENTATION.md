# ARC Phase 2A Security Implementation

**Directive:** ARC-SEC-REMEDIATION-002  
**Branch:** `cursor/arc-phase2a-security-foundation-da81`  
**Baseline audited commit:** `9f92831db981668168f3adab435fcbaffc5c514c`  
**Audit docs parent tip:** `336e03f235bffec321560826a62c4bc80588745d`

## Changes (application)

| Module | Change |
|--------|--------|
| `lib/identity.ts` | **New** — HMAC Bearer credentials; role from server registry only |
| `lib/permissions.ts` | **New** — deny-by-default permission matrix; `deployment:execute` never granted |
| `lib/auth.ts` | Rewrite — reject `X-ARC-Role` / legacy `X-ARC-Token`; `requirePermission` |
| `lib/store.ts` | Durable append-only `audit.jsonl` |
| `routes/api.ts` | Permission-gated mutators; AI denied; execute hard-disabled |
| `app.ts` | CORS allowlist; Phase 2A headers |
| `tests/phase2a-security.test.ts` | **New** regression suite |
| `tests/security-gates.test.ts` | Updated to Bearer auth |

## Non-changes

- Customer `artifacts/adala`, `artifacts/api-server`, migrations, GitHub workflows: **unchanged**
- Coolify `executeDeploy`: remains `false`
- No push / deploy / production access

## Local validation

```
pnpm --filter @workspace/arc-server run typecheck  # 0
pnpm --filter @workspace/arc-server run test        # 40 pass
pnpm --filter @workspace/arc-console run typecheck  # 0
```

Smoke: AI deploy request → 403; forged X-ARC-Role → 403 `role_header_forbidden`.
