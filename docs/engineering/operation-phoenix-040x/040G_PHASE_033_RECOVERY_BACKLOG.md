# 040G — Phase 033 Recovery Backlog (not authorized to implement)

## Capability matrix (current tip code inspection)

See `evidence/capability-matrix.json`.

| # | Capability | Class |
|---|------------|-------|
| 1 | Auth/Clerk | VERIFIED_PRESENT |
| 2 | Multi-tenant authz | VERIFIED_PRESENT |
| 3 | PostgreSQL RLS | VERIFIED_PRESENT |
| 4 | GUC containment | VERIFIED_PRESENT |
| 5 | Super Admin | VERIFIED_PRESENT |
| 6 | Legal cases | VERIFIED_PRESENT |
| 7 | Client portal | VERIFIED_PRESENT |
| 8 | Financial ledger | VERIFIED_PRESENT |
| 9 | Stripe/Moyasar | PARTIALLY_IMPLEMENTED |
| 10 | AI gateway isolation | PARTIALLY_IMPLEMENTED |
| 11 | RAG authorization | **VERIFIED_MISSING** |
| 12 | Audit logging | PARTIALLY_IMPLEMENTED |
| 13 | Storage authz | PARTIALLY_IMPLEMENTED |
| 14 | Migrations | PARTIALLY_IMPLEMENTED (max 061; 062–075 absent) |
| 15 | API tests | PARTIALLY_IMPLEMENTED (not re-run) |
| 16 | Browser E2E | UNKNOWN |
| 17 | Deploy safety | PARTIALLY_IMPLEMENTED |
| 18 | Monitoring | PARTIALLY_IMPLEMENTED |

## P0 backlog candidates (post-backup)

1. Durable private backup + DR of Phase 031 (040C–E).  
2. Credential rotation completion (040A).  
3. RAG/authorization reconstruction only if product-required — after inventory, not “replay phases”.  
4. Migration collision plan: if recovered history later appears with 061+, remap Phase 031 file forward-only.  
5. Re-run API/tenant/RLS harness on integrated tip before any Phase 033 coding authorization.

**Phase 033 not started.**
