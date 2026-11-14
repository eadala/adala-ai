# F-PRELIVE-001 Executive Decision

**Directive:** ARC-SEC-FIX-003  
**Decision:** Accept remediation — **F-PRELIVE-001 CLOSED**

## Scope of closure

Network destination hardening for the ARC live-validation script and shared validator. Local fixtures remain usable. Staging allowlist exists as an explicit future policy but is **not** activated for production observation.

## Still NOT granted

- Live validation authorization  
- Production observation  
- Deployment execution  
- Coolify / Hetzner / customer access  

## Prelive readiness

**PRELIVE_GO remains valid** for human setup preparation; live validation still requires separate human authorization after secrets are bound.

## Production readiness

**NO-GO**

## Next recommended action

Operators continue IdP/GitHub App setup; when ready, request live-validation authorization (still subject to human approval). Do not set `ARC_LIVE_VALIDATION_AUTHORIZED=true` without that approval.
