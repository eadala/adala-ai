# Phase 010-A — Scope and Gates

**Directive intent:** Non-production activation **preparation and approval** only.  
**Live services:** NOT CONTACTED  
**Deploy / push / merge:** NOT AUTHORIZED by this package alone  
**010-B:** Blocked until explicit human approval after 010-A sign-off

## In scope (010-A)

1. Freeze and cite 009 evidence
2. Non-prod backup bucket specification
3. Encryption and key-custody policy draft
4. Retention and lifecycle policy draft
5. IAM / credential handling draft
6. Restore runbook for non-prod
7. Cost model with explicit assumptions
8. Approval checklist (owners + blockers)
9. RPO decision worksheet (logical dump vs WAL/PITR) — decision, not implementation

## Out of scope (010-A)

- Uploading to real R2/S3
- Staging cluster cutover
- Production credentials
- Platform redesign / microservices
- Re-running full 009 suite (unless a change invalidates evidence)
- Claiming achieved RPO/RTO

## Exit criteria for 010-A

Return `PHASE_010A_SPECS_READY` only when:

1. Freeze SHA recorded
2. Bucket/IAM/encryption/retention/restore/cost docs complete
3. Approval matrix filled with roles (signatures may remain pending)
4. PITR need captured as open decision with options
5. 010-B entry conditions listed and blocked pending approval

Signatures themselves may remain pending; the package must be reviewable without live access.
