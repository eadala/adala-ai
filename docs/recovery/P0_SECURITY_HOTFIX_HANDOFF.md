# P0 Security Hotfix Handoff — GUC Containment

**Date:** 2026-11-07 (Asia/Riyadh)

## A. Baseline

| Field | Value |
|-------|--------|
| Frozen RC SHA | `b3d9a0afd1b45486296910827824363bd9ed6810` |
| Frozen branch | `cursor/recovery-production-readiness-da81` (untouched by this hotfix) |
| Hotfix branch | `cursor/security-p0-guc-containment-da81` |
| Hotfix SHA | `7fffe90` (update if amended) |
| Recovery PR | #138 (not auto-merged; not modified by force) |

## B. Root Cause

Reachable session-GUC leak on `pg.Pool` reuse after privileged `set_config(..., false)`. Evidence: `docs/security/P0_GUC_ROOT_CAUSE.md`.

## C. Selected Correction

Pinned DB scopes + pool.query routing + fail-closed unbound checkouts. Decision: `docs/security/P0_GUC_REMEDIATION_DECISION.md`.

## D. Security Verification

| Check | Result |
|-------|--------|
| Failing-before baseline | **PASS** (count=2) |
| Passing-after containment | **PASS** (T1–T7) |
| Pool reuse / concurrency / exception | **PASS** |
| Stripe ordering | **PASS** (scope after `constructEvent`) |
| SA / office pin for request lifetime | **PASS** (contract) |

## E. Compatibility

See `docs/security/P0_GUC_COMPATIBILITY_REPORT.md`. No API contract breaks intended.

## F. Remaining Risks

| Risk | Status |
|------|--------|
| Production role / FORCE inventory | **NOT VERIFIED** |
| Live multi-office E2E | **NOT VERIFIED** |
| Backup restore drill | **BLOCKED** until evidenced |
| Pool sizing under pin-per-request | Monitor after deploy |
| PR #138 DB Migrations on frozen tip | Independent of this hotfix |

## G. Release Recommendation

| Decision | Verdict |
|----------|---------|
| Hotfix merge readiness | **READY** after tip CI green on hotfix branch (human merge) |
| Stack onto / vs replace #138 | Human choice — **do not** force-push frozen RC |
| Production readiness | **CONDITIONAL GO** — still requires role inventory, backup drill, app→058→059→060, secrets |

**Agent will not merge, deploy, or apply production migrations.**
