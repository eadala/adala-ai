# API IDOR / BOLA Audit

## Method

Source tracing of representative legal-core and operations routes + existing static isolation tests. Full HTTP multi-tenant harness was **not** executed end-to-end (Clerk + full schema fixture unavailable for complete matrix).

## Positive patterns (VERIFIED source samples)

- `cases.ts`: many selects/updates include `AND office_id = ${tenantId}`.
- Storage signed-url route: `requireAuthWithTenant` + `office_id` + ownership helper (static test).
- Messages / client-portal: fail-closed when `resolveTenantId` null (static tests).

## Confirmed failures

### F-TENANT-MOYASAR-001 (HIGH→CRITICAL integrity)

`modules/integrations/webhook.ts`:

- `officeId = body.metadata?.office_id`
- Optional signature skip
- `UPDATE payment_transactions ... WHERE id = ${txId}` **without office_id**
- Same for `gateway_payment_id` ref path

Static suite: `tenantMoyasarWebhookIsolation.static.test.ts` — 4/4 PASS (documents the gap).

## Negative matrix (desired) — status

| Case | Status |
|---|---|
| Cross-tenant case IDs | NOT_TESTED runtime (source often filters) |
| Cross-tenant client IDs | NOT_TESTED runtime |
| Cross-tenant document IDs | NOT_TESTED runtime |
| Cross-tenant invoices | NOT_TESTED runtime |
| Cross-tenant employees | NOT_TESTED runtime |
| Cross-tenant contracts | NOT_TESTED runtime |
| Cross-tenant payments | **FAILED** Moyasar path |
| Cross-tenant workflows | NOT_TESTED |

## Verdict

Cannot claim API_IDOR_BOLA PASS. Confirmed payment IDOR path + incomplete runtime coverage → **FAILED / UNVERIFIED residual**.
