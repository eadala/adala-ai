# 05 — Phase 031 Change Inventory

Phase 031 tip `8685f64a` vs true parent `b3d9a0af` (recovery-production-readiness).

## Commits (3)

1. `b514a888` — feat(legal-financial): Phase 031 product completion (local)
2. `751ac08b` — docs(031): record local HEAD/TREE
3. `8685f64a` — docs(031): align final decision SHAs

## Product deltas (35 files, +2184/−51)

| Area | Paths |
|------|--------|
| Fee agreements | `feeAgreements.ts`, mig `061` fee_* tables |
| Appointments | `calendar.ts` `client_visible` / office_id; portal reschedule/cancel |
| Lawyer correspondence | portal messages inbox + `/portal/case/:id/reply`; portal GET appointments/messages |
| Refunds | `fakePaymentTransport.ts`, `refundWorkflow.ts`; `financialCore` LIVE_REFUND_FORBIDDEN |
| Credit notes | 061 CREATE IF NOT EXISTS safety-net; refund linkage |
| Reconciliation | `reconciliation.ts` expenses.office_id harden |
| Period-close | design-only `08_PERIOD_CLOSE_DESIGN.md` |
| Auth test harness | `requireAuth.ts` ADALA_HTTP_SECURITY_TEST gate |
| Routes | `routes/index.ts` mounts |
| Tests | `phase031LegalFinancialProductHarness.ts` (16/16) |
| Docs | `docs/engineering/legal-financial-product-031/` |
| Deps | `@playwright/test` + lockfile |

## Not Phase 031 product (baseline inheritance)

The entire recovery schema-authority stack (migrations ≤060, RLS 056–060, etc.) is inherited from `b3d9a0af` and is **not** the LOCAL-ONLY 018–030 chain.

**Do not merge the complete Phase 031 branch blindly onto a recovered 030 tip** — port only the product delta listed above after G1/G2 pass.

JSON: `evidence/phase031-change-inventory.json`
