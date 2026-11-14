# CI Security Gate

**Command:** `pnpm run test:tenant-isolation-gate`  
**Script:** `src/tests/runtime/runTenantIsolationGate.mjs`  
**Machine-readable output:** `evidence/gate-report.json`

## Behavior

- Uses isolated DB URLs only (`adala_tenant_runtime`, `adala_rls_061`).  
- Fails nonzero on required suite failure.  
- Reports skipped separately (`skipped` array).  
- Does not modify production deployment workflows.  
- Does not activate automatic deployment.

## Gate run

`decision: GATE_PASS`  
`failedRequired: []`  
Suites: http-adversarial, ai-runtime, rls-061, pool-guc, static-p0 — all ok.
