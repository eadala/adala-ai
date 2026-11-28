# PR Integration Order

Derived from verified independence (not PR numbers as dependency).

## Recommended order (reviewability / risk grouping)

Any order is **technically safe** for git application. Recommended batches for human review:

### Batch A — Tenant defaults & marketplace (independent)
1. #164 → #166 → #167 → #168 → #169

### Batch B — Payments / AI gateway / org / chat
2. #170 → #171 → #172 → #173 → #174

### Batch C — Billing / RBAC / ops surfaces
3. #175 → #176 → #177 → #178 → #179

### Batch D — Event bus / HR / JLWM / Batch19
4. #180 → #181 → #182

### Batch E — Post-cohesion remediations (this program)
5. `cursor/security-autopilot-task-scope-da81` (`4821321e`)
6. `cursor/security-jlwm-demo-seed-guard-da81` (`773fe722`)

### Parallel track (do not mix into cohesion merge without re-validation)
- Recovery #138 / #139 GUC containment on recovery base

## Local validation order used — VERIFIED

Numerical merge #164,#166–#182 onto develop → final HEAD `5abb1d03…` tree `168a55b4…`.

## Rollback limitations

- Each PR is independently revertable **before** later PRs land if no shared files.
- After all 18 land, revert must be per-PR or use the pre-integration develop SHA `d2bd14d9…`.
- DB runtime DDL / DROP DEFAULT inside modules is not automatically rolled back by git revert.
