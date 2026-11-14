# ARC Pre-Live Executive Decision

**Directive:** ARC-SEC-PRELIVE-002  
**Decision:** **PRELIVE_GO**

## Meaning

ARC is **safe to proceed to the next human-controlled setup stage** (create isolated IdP app, create read-only GitHub App, bind secrets in a secret store).

This decision **does not** authorize:

- Live validation execution  
- Production Coolify / infrastructure access  
- Deployment execution  
- Customer data access  

## Gates satisfied

1. Repository integrity verified (`e702ae82` / `bc6c6e0b`; ancestry from `e82ed25c`).  
2. Tests **104/104** + typecheck PASS.  
3. No CRITICAL; no unresolved blocking HIGH.  
4. Deployment execution demonstrably disabled (capability + HTTP).  
5. External scripts read-only / auth-gated.  
6. Credential handling secure for handoff scope.  
7. Network destinations restricted in adapters.  
8. Identity fail-closed.  
9. GitHub permissions read-only (spec).  
10. Mock ≠ live (`VERIFIED_LIVE_TEST=0`).  
11. No production systems contacted in this audit.  
12. Operator actions documented.

## Conditions

- Remediate **F-PRELIVE-001** before granting **live validation** authorization.  
- MFA ACR remains configuration-dependent.  
- Production readiness remains **NO-GO**.

## Next recommended action

Human operators execute setup per `ARC_PRELIVE_OPERATOR_ACTIONS.md` and `ARC_LIVE_INTEGRATION_CHECKLIST.md`; return for live-validation authorization review after F-PRELIVE-001 fix.
