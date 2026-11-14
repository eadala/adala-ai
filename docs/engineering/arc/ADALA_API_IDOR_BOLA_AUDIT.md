# API IDOR / BOLA Audit

## Method

Source tracing of representative legal-core and operations routes + existing static isolation tests. Full HTTP multi-tenant harness was **not** executed end-to-end (Clerk + full schema fixture unavailable for complete matrix).

## Positive patterns (VERIFIED source samples)

- `cases.ts`: many selects/updates include `AND office_id = ${tenantId}`.
- Storage signed-url route: `requireAuthWithTenant` + `office_id` + ownership helper (static test).
- Messages / client-portal: fail-closed when `resolveTenantId` null (static tests).

## Confirmed failures

### F-TENANT-MOYASAR-001 (CRITICAL integrity)

`modules/integrations/webhook.ts` — body `office_id`, optional signature skip, UPDATE without `office_id`.  
Static suite: `tenantMoyasarWebhookIsolation.static.test.ts` — 4/4 PASS (documents the gap).

### F-TENANT-OFFICE-IDOR-001 (CRITICAL)

`marketplace/office.ts` `/office/my/:officeId/*` — `requireAuth` only; path office trusted (services/team/orders/reviews/articles/domains).

### F-TENANT-PAYMENTS-LIST-001 (CRITICAL/HIGH)

`GET /payments/transactions` — unscoped `SELECT * FROM payment_transactions LIMIT 200`.

### F-TENANT-RESOLVER-TRACE-001 (HIGH)

`resolveTenantWithTrace` trusts `x-tenant-id` without membership.

### F-TENANT-BRANDING-001 (HIGH)

Query/path tenant without ownership checks.

## Negative matrix (desired) — status

| Case | Status |
|---|---|
| Cross-tenant case IDs | NOT_TESTED runtime (source often filters) |
| Cross-tenant client IDs | NOT_TESTED runtime |
| Cross-tenant document IDs | NOT_TESTED runtime |
| Cross-tenant invoices | NOT_TESTED runtime |
| Cross-tenant employees | NOT_TESTED runtime |
| Cross-tenant contracts | NOT_TESTED runtime |
| Cross-tenant payments | **FAILED** Moyasar + payments list |
| Cross-tenant workflows | **FAILED** AI workflows unscoped |
| Cross-tenant marketplace office | **FAILED** office IDOR |

## Verdict

**API_IDOR_BOLA_SECURITY: FAIL** — multiple confirmed source-level IDOR/BOLA paths.
