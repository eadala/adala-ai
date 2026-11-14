# Tenant Security Regression

## Command

```bash
cd artifacts/api-server && pnpm run test:tenant-isolation-gate
```

## Result

- Exit code: **0**
- Decision: **GATE_PASS**
- Required suites: http-adversarial, ai-runtime, rls-061, pool-guc, static-p0 — all ok
- `failedRequired`: []
- `skipped`: [] (gate-level)
- Note: suite-internal `AI_LIVE_MODEL` remains SKIPPED_BY_DESIGN; does not skip the required suite

No duplicate tenant tests created. No confirmed tenant-isolation regression.

Evidence: `evidence/tenant-isolation-gate.log`, `evidence/tenant-gate-summary.json`
