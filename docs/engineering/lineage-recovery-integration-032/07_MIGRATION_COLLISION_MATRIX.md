# 07 — Migration Collision Matrix

## On current recovery + 031 tip

| Migration | Owner | Notes |
|-----------|-------|-------|
| 001–060 | recovery-production-readiness | Present |
| **061** | Phase 031 product | `061_legal_financial_product_completion.sql` |
| 062+ | — | Absent on this tip |

## On missing LOCAL-ONLY 018–030 chain (from prior tracker notes)

Historical LOCAL-ONLY work referenced migrations through **~076** (RAG/provider phases). Exact files **not recoverable** here.

## Collision risk if 030 recovered

| Risk | Assessment |
|------|------------|
| 031’s `061` clashes with recovered `061–075` | **HIGH** if recovered chain already used 061+ |
| Required action | Do **not** overwrite. Allocate a new forward-only ID after recovered max; map 031→new ID |
| Period-close tables | Must remain absent (design gate) |

**MIGRATION_061_COLLISION:** UNRESOLVED_PENDING_030_RECOVERY  
**Mapping retained:** Phase 031 `061_legal_financial_product_completion.sql` → future remapped ID TBD after recovered tip known.
