# F-TENANT-AI-CREDITS-001

**Initial severity:** CRITICAL  
**Remediation:** `requireAuthWithTenant`; charge `req.tenantId` only; ignore body officeId; GET uses tenant  
**Code:** `modules/ai/aiCredits.ts`  
**Original exploit reproduced:** YES (static body/default)  
**Post-fix exploit denied:** YES  
**Positive control:** PASS (static)  
**Concurrency/idempotency E2E:** NOT_TESTED (atomic UPDATE … AND balance >= debit added)  
**Closure:** **PARTIAL** → treat as **CLOSED** for cross-tenant charge vector; concurrent stress residual  
