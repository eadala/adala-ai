# P0 GUC Remediation Decision

## Options compared

| Option | Security | Compat | Complexity | Selected? |
|--------|----------|--------|------------|-----------|
| A — Harden cleanup only | Insufficient alone (clear may miss backend) | High | Low | Partial (fail-closed unbound query) |
| B — Transaction-local SET LOCAL only | Requires pinned tx for all queries | Medium | Medium | Not alone |
| **C — Pinned privileged/tenant DB scope + pool routing** | **High** — same client for GUC + queries; clear before release | High | Medium | **Yes** |
| D — Dedicated DB role | Needs approval / migration | Low now | High | No |

## Selected architecture (C + A hygiene)

1. **`withPinnedDbScope` / `withOfficeDbScope` / `withBypassDbScope`** — acquire one client, apply GUCs, ALS-bind, route `pool.query` to that client, await fail-closed, release once.
2. **`runWithOfficeDbScopeUntilResponse` / `runWithBypassDbScopeUntilResponse`** — hold pin for HTTP response lifetime (SA, office auth, tenant middleware).
3. **Stripe** — `runWithBypassDbScope` only **after** `constructEvent`.
4. **Unbound `pool.query`** — checkout begins/ends fail-closed so ambient queries cannot inherit sticky bypass.
5. **Setters** (`setBypassRlsSession` / `setOfficeTenantSession`) **require** an active pinned scope.

## Files changed

- `lib/db/src/gucContainment.ts` (new)
- `lib/db/src/index.ts`
- `artifacts/api-server/src/lib/tenantSession.ts`
- `artifacts/api-server/src/middlewares/requireAuth.ts`
- `artifacts/api-server/src/middlewares/tenantMiddleware.ts`
- `artifacts/api-server/src/services/stripeEventBuffer.ts`
- Tests + CI wiring

## Rejected

- Broad auth redesign, new DB role, FORCE RLS migration, modifying frozen RC `b3d9a0a`.
