# ARC Backup Evidence

## Display fields

provider, last success, age, storage class, retention, integrity status, last isolated restore, RPO/RTO, operator, readiness.

## Rules

- Never store dump credentials or DB dumps in ARC.  
- readiness PASS only with verifiable restore-test evidence.  
- Schedule alone → FAIL/UNVERIFIED.  
- Phase 1 seed attestation: readiness **FAIL**.  

Operator package: `/tmp/security-integration/operator-evidence-package/POSTGRES_BACKUP_EVIDENCE_CHECKLIST.md` (companion).
