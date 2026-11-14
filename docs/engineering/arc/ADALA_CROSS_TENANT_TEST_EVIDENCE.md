# Cross-Tenant Test Evidence

## Existing baseline

| Suite | Result |
|---|---|
| ARC `pnpm test` | **129/129 PASS** (includes F-PRELIVE-001) |
| Prior api-server static tenant/RLS tests | Present in tree (not all re-executed this turn) |

## New evidence this audit

| ID | Command | Result |
|---|---|---|
| RLS same-connection matrix | `psql "$DATABASE_URL"` adversarial SQL | PASS deny A↔B read/update/delete; empty/missing/sentinel 0 |
| Pool bypass leak | `node artifacts/api-server/src/tests/tenantPoolGucContainment.adversarial.mjs` | **FAIL control** — CONFIRM leak (`bypass_rls=on`, n=2) |
| Moyasar static | `pnpm exec tsx --test src/tests/tenantMoyasarWebhookIsolation.static.test.ts` | 4/4 PASS (gap documented) |

## Actor matrix coverage

| Actor | Confidentiality | Integrity | Notes |
|---|---|---|---|
| Tenant A vs B (DB RLS pinned) | PASS | PASS | Same connection |
| Tenant A vs B (pooled GUC) | **FAIL** | **FAIL** | F-TENANT-POOL-001 |
| Unauthenticated | PARTIAL | PARTIAL | Health public; APIs require auth (source) |
| Revoked user | NOT_TESTED | NOT_TESTED | Cache TTL residual |
| Low-privilege customer | NOT_TESTED | NOT_TESTED | |
| Tenant owner | NOT_TESTED E2E | NOT_TESTED E2E | |
| Platform SA | Intentional bypass | Intentional | VERIFIED design |
| ARC operator | Separate | Deploy denied | VERIFIED |
| AI agent | Partial gateway | ARC non-authority | UNVERIFIED E2E |
| Webhook identity | Stripe OK design | Moyasar FAIL | |

## Positive control

Legitimate same-tenant SELECT under `office-a` returned 1 row — PASS.
