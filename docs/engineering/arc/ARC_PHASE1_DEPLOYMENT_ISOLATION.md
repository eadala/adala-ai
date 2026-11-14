# ARC Phase 1 Deployment Isolation

## Invariant

ARC Phase 1 must be incapable of initiating production-changing deployment via any reachable path.

## Enforcement boundaries (VERIFIED)

| Layer | Control | Status |
|-------|---------|--------|
| Network | `app.listen(port, "127.0.0.1")` | Present |
| Provider capability | `executeDeploy: false` always | Present |
| Coolify HTTP mutate | No POST/PUT/PATCH deploy methods exist | Present |
| Route | `POST /deployments/execute` → always HTTP 403 | Present |
| Env kill-switch | Even `ARC_ENABLE_DEPLOYMENT_EXECUTION=true` → still 403, **no provider call** | Present |
| CLI | No deploy CLI entrypoint beyond server start | Present |
| Jobs/webhooks | None implemented | N/A |
| Frontend | No execute button wiring to succeed | Insufficient alone; backed by server |

## Adversarial scenario results

| # | Scenario | Result |
|---|----------|--------|
| 1 | Unauthenticated execute | **401** |
| 2 | Unauthorized role (auditor without forge) | Would 403 on roles; with forge see F-001 |
| 3 | Forged operator roles | Reaches handler; **still 403 disabled** |
| 4–5 | Forged/client approvals | Cannot cause Coolify deploy (no execute body) |
| 6 | Direct API bypass UI | Same 403 |
| 7 | Direct adapter | No deploy method to invoke |
| 8–11 | Missing/wrong SHA/digest/evidence | Policy blocks `deploymentAllowed`; execute unused |
| 12–13 | Expired/self-approval | validateApprovalAttempt rejects |
| 14–15 | Duplicate/concurrent request | 202 only; no execute |
| 16–17 | Webhook replay/signature | **NOT_RUN** — no webhook surface |
| 18–19 | Provider weirdness / missing creds | UNAVAILABLE/UNVERIFIED typed |
| 20 | Unexpected config enabling deploy | Env true still **no provider call** |

## Conclusion

**DEPLOYMENT_EXECUTION_ISOLATION: PASS** for Phase 1 production-changing operations.

Caveat: Authorization forge (F-001) is **HIGH** for future phases but does not yield a deploy today.
