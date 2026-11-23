# Security Invariants (must not weaken)

1. Strict tenant isolation + fail-closed RLS  
2. Tenant-scoped DB transactions + GUC containment  
3. Resource-level authorization  
4. Super Admin / Developer privilege separation  
5. Financial integrity + payment idempotency  
6. Confidential document access controls  
7. AI tenant isolation + RAG retrieval authorization  
8. Audit logging + revocation enforcement  

**V3 note:** RAG isolation properties from documented 029–030 are **UNAVAILABLE** in this object DB; do not claim PASS without recovered/rebuilt code + tests.
