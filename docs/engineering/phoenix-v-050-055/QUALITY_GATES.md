# Phoenix V — Quality Gate Baseline

| Gate | Result | Notes |
|------|--------|-------|
| `pnpm --filter @workspace/api-server run typecheck` | **PASS** (after harness DOM fix + deps install) | CI previously failed on `document` in Playwright callback |
| `pnpm run typecheck:libs` | **PASS** (after `pnpm install`) | Prior FAIL was missing workspace node_modules |
| `test:ai-gateway-tenant` | PASS | |
| `test:ai-gateway-tenant-negative` | PASS | |
| `test:secure-rag` | PASS | |
| `test:tenant-isolation-local` | PASS | unit/schema isolation suite |
| Live disposable Postgres RLS harness | **BLOCKED** | `DATABASE_URL` unset; no docker postgres in session |
| Production build | NOT RUN this slice | |
| Public remote push of Phoenix V | **SKIPPED** | origin is public + contaminated ancestry |

## Machine-readable

```json
{
  "directive": "ADALA-MASTER-050-055-UNIFIED-EXECUTION",
  "api_server_typecheck": "PASS",
  "typecheck_libs": "PASS",
  "ai_gateway_tenant": "PASS",
  "ai_gateway_negative": "PASS",
  "secure_rag": "PASS",
  "tenant_isolation_local": "PASS",
  "live_rls_db": "BLOCKED",
  "public_push": "SKIPPED"
}
```
