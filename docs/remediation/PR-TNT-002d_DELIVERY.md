# PR-TNT-002d — Background Jobs & Billing Tenant Hardening

**Follow-up to:** PR-TNT-002 (Tenant Kernel)  
**Branch:** `cursor/pr-tnt-002d-tenant-cron-billing-da81`

---

## Technical Summary

Closed two remaining P1 tenant isolation gaps identified in the Principal Engineer audit:

1. **`emailCron.ts`** — Rewritten for per-office execution with `runAsSystemTenant()`. All queries scoped by `office_id`. Removed hard-coded `'default'` tenant.
2. **`billing.ts`** — Migrated tenant routes to `requireAuthWithTenant` + `getRequiredTenantId()`. Fixed cross-tenant leaks in ledger MRR, platform invoices, Stripe subscription listing, and billing alerts.

---

## Security Impact

| Before | After |
|--------|-------|
| Email cron sent cross-tenant reminders | Per-office SMTP + scoped queries |
| Billing overview aggregated all tenants' MRR | Tenant-scoped ledger |
| Platform invoices listed all tenants | `WHERE office_id = tenant` |
| Stripe subs/invoices listed globally | Filtered by `stripe_customer_id` |
| Pay/mark-overdue affected any invoice | Scoped to requesting tenant |

---

## Test Evidence

```bash
pnpm typecheck                                          # ✅
tenant-kernel.test.ts (includes 002d checks)          # ✅
platform-check.mjs Layer 9                            # ✅
```

---

## Merge Recommendation

Stack on PR #17 (PR-TNT-002). Safe to merge after kernel PR is approved.
