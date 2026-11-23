# Migration Ledger

## On current tip (verified)

Highest product migration file: `061_legal_financial_product_completion.sql` (Phase 031 forward-only on recovery base).

Present continuum through schema-authority / RLS: `043`–`060`, then `061`.

## Documented but unavailable here

Tracker/internal notes claim LOCAL-ONLY migrations approximately:

| ID range | Claimed phase | Availability |
|----------|---------------|--------------|
| 062–066 | 010–015 security/ops | Not in tip (may never have been on this recovery tip) |
| 068–071 | 023–026 finance/portal/audit | ABSENT |
| 072–075 | 027–030 AI/RAG | ABSENT |

**Collision risk:** If recovered chain already allocated `061+`, Phase 031’s `061_legal_financial…` must be remapped to a **new forward-only** ID after recovered max. Never rewrite applied history.

**No migration execution authorized by this program start.**
