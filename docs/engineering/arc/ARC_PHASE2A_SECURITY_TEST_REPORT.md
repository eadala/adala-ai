# ARC Phase 2A Security Test Report

**Environment:** local workspace  
**Command:** `pnpm --filter @workspace/arc-server run test`  
**Exit code:** **0**  
**Counts:** tests **40** · pass **40** · fail **0** · skip **0**

Suites:

1. `phase2a-security.test.ts` — F-001/F-002 + mandated negatives  
2. `security-gates.test.ts` — prior policy suite on Bearer auth  

## Required scenario coverage

| # | Scenario | Result |
|---|----------|--------|
| 1 | Forged X-ARC-Role | PASS 403 |
| 2 | Missing auth | PASS 401 |
| 3 | Invalid auth | PASS 401 |
| 4 | Expired auth | PASS 401 |
| 5 | AI deploy request | PASS 403 |
| 6 | AI approval | PASS 403 |
| 7 | AI policy modify | PASS 403 |
| 8 | Human self-approval path | PASS 403 |
| 9 | Legacy escalation headers | PASS 401/403 |
| 10 | Direct execute (owner) | PASS 403 |
| 11 | Execute all roles | PASS 403 |
| 12 | Missing gates | PASS allowed=false |
| 13 | Invalid release | PASS 404 |
| 14 | Concurrent approvals | PASS 201×2 |
| 15 | Audit persist restart | PASS |
| 16 | Audit modification | PASS 403 |
| 17 | Prod blocks dev issuer | PASS 403 |
| 18 | Coolify no mutate | PASS |

## Non-regression

- arc-console typecheck exit 0  
- No customer application file diffs  
