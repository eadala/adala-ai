# Batch 19 / PR #182 Security Verification

**PR:** #182 `b62d2b8a97e0` (`cursor/platform-cohesion-batch19-da81`)  
**Method:** Static source inspection of PR head + guard test `tenantCohesionBatch19.test.mjs`  
**Runtime adversarial DB tests:** NOT_TESTED (no disposable DB in this run)

## A — Collection payments (`finance-center.ts`)

| ID | Check | Result | Evidence |
|---|---|---|---|
| A1 | `INSERT INTO revenues` stamps `office_id` | **PASS** | Diff adds `office_id` column + `${tenantId}` value |
| A2 | Fail-closed if tenant missing | **PASS** | `if (!tenantId) return res.status(403)` |
| A3 | Invoice ownership scoped before update | **PASS** | `WHERE id=${id} AND office_id=${tenantId}` |
| A4 | Cross-office case/invoice reference | **PASS** (static) | Payment path loads invoice by tenant; cannot update foreign invoice |
| A5 | Missing tenant context | **PASS** (static) | 403 before INSERT |
| A6 | Duplicate/retry/idempotency | **NOT_TESTED** | No unique constraint / idempotency key verified in this run |
| A7 | Concurrent collections | **NOT_TESTED** | Requires disposable DB |

## B — Autopilot tasks (`caseAutopilot.ts`)

| ID | Check | Result | Evidence |
|---|---|---|---|
| B1 | Task INSERT stamps `office_id` | **PASS** | `INSERT INTO tasks (office_id, case_id, …)` |
| B2 | Task INSERT stamps `case_id` | **PASS** | Same INSERT |
| B3 | Events query scoped | **PASS** | `events … AND office_id = ${tenantId}` |
| B4 | Tasks *context fetch* scoped | **FAIL on #182** → remediated | #182 still had `OR case_title IS NOT NULL` unscoped; fixed in `cursor/security-autopilot-task-scope-da81` (`4821321e`) |
| B5 | Background tenant propagation / retries | **NOT_TESTED** | No job runner exercise |

## C — AI case-brief contract counts (`ai-engine.ts`)

| ID | Check | Result | Evidence |
|---|---|---|---|
| C1 | Contracts COUNT uses `office_id` | **PASS** | `FROM contracts WHERE case_id = ${id}::uuid AND office_id = ${tenantId}` |
| C2 | Case ownership checked | **PASS** | `FROM cases WHERE id = ${id} AND office_id = ${tenantId}` |
| C3 | Missing tenant → 403 | **PASS** | `if (!tenantId) return res.status(403)` |
| C4 | Two-office exact count adversarial | **NOT_TESTED** | Requires disposable DB with seeded offices |
| C5 | Cache tenant isolation | **NOT_APPLICABLE** | No cache layer observed on this route |

## Guard test

```
node --test artifacts/api-server/src/tests/tenantCohesionBatch19.test.mjs
→ exit 0 (on integration tree and PR head)
```

## Verdict

Reported Batch19 fixes **A** and **C** are **statically verified PASS**.  
**B** insert/events PASS; residual tasks context leak fixed out-of-band.  
Hypothesis “inventing-default FREE class cleared” for these three paths: **SUPPORTED** (static), not proven by runtime adversarial tests.
