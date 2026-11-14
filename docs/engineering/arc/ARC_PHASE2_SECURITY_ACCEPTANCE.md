# ARC Phase 2 Security Acceptance Criteria

Phase 2 development may start under **CONDITIONAL_GO** only if:

1. Phase 1 remains ACCEPT_WITH_CONDITIONS (no CRITICAL).  
2. PR-01/PR-02 land before any non-loopback bind or shared hosting.  
3. `executeDeploy` remains false until a **later** phase with separate production auth.  
4. F-001 and F-002 closed with regression tests (PR-09).  
5. Durable audit (PR-03) before claiming compliance evidence.  
6. Coolify live reads limited to staging first (PR-07 → VERIFIED_STAGING).  
7. No production deploy orchestration in Phase 2 scope.

## Explicit non-acceptance for production

Meeting Phase 2 acceptance ≠ production readiness. Production remains **NO-GO** until the separate production release process (SHA, digest, backup restore, independent review, staging acceptance, human deploy auth) completes.
