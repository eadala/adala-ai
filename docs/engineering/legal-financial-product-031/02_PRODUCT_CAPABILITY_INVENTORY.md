# 02 — Product Capability Inventory

| Capability | Status |
|------------|--------|
| Fee agreements | IMPLEMENTED_LOCAL (061 + feeAgreements.ts) |
| Fee authz | Tenant + financial roles + forgery deny |
| Client appointments | IMPLEMENTED_LOCAL (events.client_visible + portal reschedule/cancel) |
| Lawyer correspondence | IMPLEMENTED_LOCAL (portal inbox + reply) |
| Refunds | IMPLEMENTED_FAKE_TRANSPORT |
| Credit notes | EXISTING_PLUS_REFUND_LINK (061 safety-net CREATE IF NOT EXISTS) |
| Period close | DESIGN_ONLY — DESIGN_READY_FOR_APPROVAL |
| Reconciliation | EXISTING_VERIFIED (expense office_id hardened) |
