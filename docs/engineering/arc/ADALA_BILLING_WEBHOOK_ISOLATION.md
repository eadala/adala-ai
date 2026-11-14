# Billing & Webhook Isolation

## Stripe

| Control | Status |
|---|---|
| Raw body + `stripe-signature` required | VERIFIED `app.ts` |
| Bypass only after verification (intended) | VERIFIED comments + buffer import |
| `clearTenantSessionFailClosed` in `finally` | VERIFIED — but pool pin FAILED |
| Live Stripe contact | NOT performed |

## Moyasar

| Control | Status |
|---|---|
| Signature mandatory always | **FAILED** — skipped if secret unset |
| Tenant from trusted mapping | **FAILED** — `body.metadata.office_id` |
| Update scoped by office | **FAILED** — ID-only WHERE |
| Replay / idempotency | NOT_TESTED |
| Live Moyasar | NOT performed |

Evidence: `tenantMoyasarWebhookIsolation.static.test.ts`.

## Async / retries

Stripe event buffer uses bypass GUC — subject to F-TENANT-POOL-001.

## Verdict

**BILLING_WEBHOOK_ISOLATION: FAIL** (Moyasar + pool containment).
