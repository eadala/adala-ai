# P0 GUC Regression Evidence

**Test:** `pnpm --filter @workspace/api-server run test:guc-pool-containment-p0`  
**Environment:** PostgreSQL 16, `adala_rls_repro`, role `adala_app` (NOBYPASSRLS), FORCE RLS on repro table

## Results

| ID | Scenario | Before (unsafe) | After (contained) |
|----|----------|-----------------|-------------------|
| T1 | Privileged → normal reuse | count=2 | count=0 |
| T2 | Office A → B → A | N/A | A=1,B=1,A=1 |
| T3 | Exception after bypass | leak=2 | count=0 |
| T6 | Concurrent A/B scopes | N/A | 1 / 1 |
| T7 | Empty / `__unscoped__` | N/A | 0 |
| Unbound query | After bypass scope | sticky risk | bypass=`off`, count=0 |
| Baseline | Sticky without containment | **FAIL (2)** | Used to prove reachability |

## Authorization ordering contracts

- Stripe: `constructEvent` before `runWithBypassDbScope` / `setBypassRlsSession`
- SA / office: pinned scope via `runWith*DbScopeUntilResponse`
- Unscoped `setBypassRlsSession` throws (requires pin)

## Related contracts still PASS

- `test:rls-fail-closed-059`
- `test:vault-rls-060`
- `test:notifications-tenant`
