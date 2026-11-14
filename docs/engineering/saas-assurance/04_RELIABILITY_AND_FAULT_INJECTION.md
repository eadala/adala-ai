# Reliability & Fault Injection

## Dependency failure surfaces

| Dependency | Code touchpoint | Observed resilience |
|---|---|---|
| PostgreSQL | `lib/db` pool | No connectionTimeoutMillis; refuse fails fast locally |
| Clerk | `app.ts` clerkMiddleware | Auth path; outage behavior not fault-injected here |
| Stripe | webhook + DLQ (`stripeEventBuffer.ts`) | DLQ exists (good); retries documented |
| AI providers | ai modules | Timeout/circuit incomplete vs uniform policy |
| R2/S3 | storage | Not fault-injected |
| WhatsApp/Email | integrations/cron | Async; rate-limit behavior unverified |
| Cron workers | colocated | Overlap skip in-process only |

## Local fault evidence

`evidence/fault-db-refuse.json`: connection to `127.0.0.1:1` → `ECONNREFUSED` in ~2.25ms. Demonstrates refuse path; **does not** prove app-level timeout budgets or graceful degradation UX.

## Retry engine review

`artifacts/api-server/src/recovery/retry.engine.ts`:

- Bounded retries (default 3) — good
- Exponential backoff capped 30s — good
- **No jitter** (confirmed NO_JITTER)
- **No idempotency gate** — callers must ensure safety
- Uses `console.warn` not structured logger

| ID | Sev | Finding |
|---|---|---|
| F-REL-001 | P1 | Missing jitter → synchronized retry storms under shared outages |
| F-REL-002 | P1 | No standard circuit breaker/bulkhead for AI/payment HTTP clients |
| F-REL-003 | P0 | `/api/healthz` always 200 without DB — orchestrators may route traffic to broken instances (`app.ts:52`) |
| F-REL-004 | P2 | `withTimeout` races without cancel of underlying work |

## Principles for remediation

Classify operations idempotent vs not; never blind-retry payments/legal record creates; add readiness distinct from liveness.
