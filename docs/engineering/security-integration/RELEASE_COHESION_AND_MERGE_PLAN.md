# Release Cohesion and Merge Plan

**No merge into `develop`/`main` is authorized by this document.** Plan only.

## Group 1 — Cohesion core (develop)

Merge in review batches A→D from `PR_INTEGRATION_ORDER.md`.

| Item | Value |
|---|---|
| PRs | #164, #166–#182 |
| Head SHAs | see inventory |
| Predecessors | none among themselves |
| Migrations | mostly runtime DDL inside modules (no single numbered migration set across all 18) |
| CI | each PR SUCCESS×12; re-run CI on develop after each batch |
| Security tests | `tenantCohesionBatch*.test.mjs` |
| Review | independent human review required (`REVIEW_REQUIRED`) |
| Expected tree | matches local `168a55b4…` if all 18 land cleanly |
| Rollback | revert per PR; runtime DDL may remain |
| Deploy | **do not** treat develop merge as production deploy |

## Group 2 — Remediations (develop)

| PR branch | SHA | After |
|---|---|---|
| `cursor/security-autopilot-task-scope-da81` | `4821321e` | Can merge independently; overlaps `caseAutopilot.ts` with #182 on nearby lines — merge after or with #182 and resolve if needed |
| `cursor/security-jlwm-demo-seed-guard-da81` | `773fe722` | Independent (`index.ts`) — merge anytime |

## Group 3 — Recovery / GUC (separate base)

| PR | Base | Note |
|---|---|---|
| #139 | recovery branch | Required for G6/GUC; do not fold into cohesion without re-integration |

## Close / ignore

- #165 (CONFLICTING duplicate on `main`) — close as superseded by #164.

## Production interlock (G13)

Coolify watched branch / auto-deploy / DB / backups: **UNVERIFIED**. Production remains **NO-GO** until operator attestation.
