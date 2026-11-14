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

## Findings

| ID | Sev | Finding |
|---|---|---|
| F-ASYNC-001 | P1 | Overlap locks not distributed — multi-replica → duplicate backups/emails/agents |
| F-ASYNC-002 | P1 | Most crons at-least-once without inbox/outbox; idempotency uneven |
| F-ASYNC-003 | P2 | Poison message handling beyond Stripe not standardized |
| F-ASYNC-004 | P2 | Job cancellation/timeouts not uniform |

## Recommendation

Before horizontal scale: Redis/PG advisory locks for cron; transactional outbox only where dual-write failure modes proven (payments/notifications). Do not add outbox globally by default.
