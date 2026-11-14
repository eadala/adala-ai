# Asynchronous Processing Reliability

## Inventory

| Job | Overlap guard | Retry policy (registry) | DLQ |
|---|---|---|---|
| agent-run | in-process Set | next cycle | No general DLQ |
| agent-daily-snapshot | in-process | next day | No |
| backup-tenant/full | in-process | ignore/continue | Partial (storage) |
| email-cron | in-process | next hour | No |
| log-rotation | in-process | none | N/A |
| monitoring | in-process | swallow errors | N/A |
| Stripe webhook | buffer + retries | 3× backoff → `stripe_dead_letters` | **Yes** |

Evidence: `cronOverlapGuard.ts` documents single-container assumption; `backgroundJobsRegistry.ts` retryPolicy strings; Stripe DLQ in migration 011 + `stripeEventBuffer.ts`.

## Findings ([Async backup cost lifecycle](bc-e224a8ab-4d49-57ca-8df5-870eef796b65))

| ID | Sev | Finding |
|---|---|---|
| F-ASYNC-001 | P1 | Overlap locks process-local — multi-replica duplicates |
| F-ASYNC-002 | P1 | Cron failures drop until next schedule (no catch-up/DLQ except Stripe) |
| F-ASYNC-003 | P1 | Stripe reconcile `setInterval` **not** wrapped in overlap guard |
| F-ASYNC-004 | P2 | Poison handling beyond Stripe not standardized |
| F-ASYNC-005 | P2 | Backup cron silently skips if object storage unset |

## Recommendation

Distributed cron locks before scale-out; wrap Stripe reconcile; keep Stripe DLQ pattern; outbox only where dual-write proven.
