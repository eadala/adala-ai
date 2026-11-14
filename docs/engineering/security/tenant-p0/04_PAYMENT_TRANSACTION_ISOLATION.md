# F-TENANT-PAYMENTS-LIST-001

**Initial severity:** CRITICAL/HIGH  
**Remediation:** `WHERE office_id = ${officeId}` before LIMIT; deny missing tenant  
**Code:** `modules/financial/payments.ts` GET `/payments/transactions`  
**Original exploit reproduced:** YES (static unscoped SELECT)  
**Post-fix exploit denied:** YES  
**Positive control:** PASS (scoped query)  
**Database isolation:** PARTIAL (app WHERE; RLS depends on GUC pin residual)  
**Regression tests:** PASS static  
**Closure:** **CLOSED** at app layer  
