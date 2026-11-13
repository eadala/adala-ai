# Cumulative Integration Test Report

## Integration candidate

- Branch (local): `cursor/security-integration-validation-b19`
- Final HEAD: `5abb1d03def2027896691dad93f85dd6134bee4f`
- Final TREE: `168a55b43e139b67d7ff7687c624dff6a5518015`
- Applied: #164 + #166–#182 (18/18, zero conflicts)

## A. Static validation

| Check | Command / method | Result |
|---|---|---|
| Merge apply | sequential `git merge` | **PASS** |
| TypeScript `tsc` | attempted via workspace tsconfig against worktree | **BLOCKED** (`Cannot find type definition file for 'node'` / incomplete type roots) |
| Lint (full) | not run monorepo-wide | **NOT_RUN** |
| Build | not run | **NOT_RUN** |
| Dependency audit | `pnpm audit` | **NOT_RUN** |
| Per-PR CI | GitHub rollup SUCCESS×12 each | **PASS** (individual, not cumulative) |

## B. Security validation

| Check | Result |
|---|---|
| Cohesion guard tests batch8–19 | **PASS** exit 0 (12 files) |
| Batch19 static A/B/C | See BATCH19 doc — A/C PASS; B residual remediated |
| RLS / pool adversarial | **NOT_RUN** |
| Autopilot task-scope guard | **PASS** on remediation branch |
| JLWM prod seed guard | **PASS** on remediation branch |

### Guard test command (integration tree)

```bash
cd /tmp/security-integration/integration-wt
node --test artifacts/api-server/src/tests/tenantCohesionBatch{8,9,10,11,12,13,14,15,16,17,18,19}.test.mjs
# → tests 12 / pass 12 / fail 0 / exit 0
```

## C–E. Business / reliability / regression

| Category | Result |
|---|---|
| Case/client/contract/document/payment E2E | **NOT_RUN** |
| Idempotency / concurrency | **NOT_RUN** |
| Existing full regression suite | **NOT_RUN** (env incomplete for full api-server test matrix) |

## Limitations

Disposable PostgreSQL was not provisioned in this cloud environment for adversarial RLS/pool tests. Cumulative green CI on the combined tree was not obtained (integration branch not pushed; full install/tsc blocked).
