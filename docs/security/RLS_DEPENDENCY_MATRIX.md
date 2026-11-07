# RLS Dependency Matrix (empty-tenant → fail-closed)

| Operation | Classification | Adaptation |
|-----------|----------------|------------|
| Office tenant API (`requireAuthWithTenant`) | SAFE | Sets office GUC; bypass off |
| Notifications / invitations | SAFE | Already query-scoped + tenant MW |
| Super Admin routes | REQUIRES ADAPTATION → **done** | `setBypassRlsSession` in `requireSuperAdmin` |
| Stripe webhook | REQUIRES ADAPTATION → **done** | bypass around `processWebhook` |
| requireAuth-only + tenant tables | HIGH RISK mitigated by deny default GUC | Still prefer requireAuthWithTenant |
| Cron / background jobs | UNKNOWN | Must set bypass or office GUC explicitly |
| vault/zta tables (056) | HIGH RISK remaining | Not changed in 059 |
| Table-owner DB role | HIGH RISK | No FORCE; document |

Empty→deny default middleware classifies most anonymous pool reuse as SAFE under 059.
