# Adversarial Second-Pass Review

**Status:** INTERNAL second-pass (not an independent external security audit)

## Bypass review

| Surface | Finding | Disposition |
|---|---|---|
| HTTP authz | Real Express + middleware exercised | PASS |
| Forged x-tenant-id fallback | Was silent fall-through | CLOSED — throw PLATFORM_FORBIDDEN |
| Revoked users.office_id | Fail-open | CLOSED — require active membership |
| RLS FORCE residual | Owner bypass without FORCE | CLOSED via 061 on isolated DB |
| Pool GUC reuse | Session GUC persists without guard | Guard verified PASS |
| Cron privileged scope | Partial coverage | CLOSED — withSystemDbScope on agent/email/log/backup |
| WhatsApp ownership | Cross-phone status | CLOSED |
| Payments list | Soft assertion fixed | PASS |
| AI tools | Prompt cannot switch tenant | PASS (fixture) |
| Error disclosure | Arabic generic + codes | Acceptable; no foreign tenant payloads observed |
| Side channels | Pagination/search | No B leakage in harness |

## Evidence required for later external verification

1. Staging soak with migration 061 on staging clone.  
2. External firm replay of HTTP + RLS harnesses.  
3. Live-model red-team (out of scope here).  
4. Production role privilege audit (BYPASSRLS inventory).
