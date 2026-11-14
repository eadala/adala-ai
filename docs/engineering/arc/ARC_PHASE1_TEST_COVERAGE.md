# ARC Phase 1 Test Coverage

**Suite:** `artifacts/arc-server/src/tests/security-gates.test.ts`  
**Reproduced:** 19 pass / 0 fail / 0 skip (exit 0)

## Invariant → test map

| Invariant | Covered by test? | Gap |
|-----------|------------------|-----|
| Unauth deploy request | Yes (#1) | |
| Self-approval reject | Yes (#2) | |
| Expired approval | Yes (#3) | |
| SHA mismatch | Yes (#4) | |
| Digest mismatch | Yes (#5) | |
| Missing backup | Yes (#6) | |
| Missing restore | Yes (#7) | |
| Unverified prod SHA | Yes (#8) | |
| Missing independent review | Yes (#9) | |
| Concurrent requests | Yes (#10) | |
| Execute disabled | Yes (#11–13, #15, #20) | |
| Provider UNVERIFIED | Yes (#14) | |
| Audit append | Yes (#16) | Not restart durability |
| Cross-role approve request | Partial (#17 auditor) | ai_agent request **not** asserted → **GAP** (F-002) |
| AI approve reject | Yes (#18) | |
| Secret non-leak in JSON | Yes (#19) | |
| Role header non-elevation | **No** | **GAP** (F-001) |
| Kill-switch env still no Coolify call | **No automated** | Manual curl only |
| Webhook signature | N/A | No surface |
| All-gates-PASS → allow | **No** | Happy-path allow never reachable in Phase 1 execute |
| Evidence cross-release mix | **No** | Phase 2 |
| Evaluator exception | **No** | Phase 2 |
| Frontend UNVERIFIED labels | **No** | No FE tests |

## Coverage assessment

The 19 tests are **security-meaningful negative tests**, not mere happy paths. Gaps above must enter PR-09 before production integration.
