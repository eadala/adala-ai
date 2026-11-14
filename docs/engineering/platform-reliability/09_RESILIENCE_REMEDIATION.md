# Resilience Remediation

## Scoped change

`artifacts/api-server/src/recovery/retry.engine.ts`

- Full-jitter exponential backoff
- Idempotent flag (non-idempotent skips retry)
- Existing `withTimeout` retained

## Evidence

Harness `RETRY_JITTER_BOUNDED` PASS.

## Not done (intentionally)

No new queues, circuit-breaker mesh, or microservices. Further resilience only where reproduced failures exist.
