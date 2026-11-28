# PR Dependency Graph

## Method — VERIFIED

- `git merge-base origin/develop origin/<head>` for each cohesion branch → all equal `d2bd14d9…`
- `git merge-base --is-ancestor origin/develop origin/<head>` → all ON_DEVELOP_TIP
- `gh pr diff --name-only` pairwise file intersection → **0 overlapping files**
- Local sequential `git merge --no-ff` of all 18 heads onto develop tip → **0 conflicts**

## Graph classification

```
develop (d2bd14d9)
 ├── #164 ── independent
 ├── #166 ── independent
 ├── #167 ── independent
 ├── #168 ── independent
 ├── #169 ── independent
 ├── #170 ── independent
 ├── #171 ── independent
 ├── #172 ── independent
 ├── #173 ── independent
 ├── #174 ── independent
 ├── #175 ── independent
 ├── #176 ── independent
 ├── #177 ── independent
 ├── #178 ── independent
 ├── #179 ── independent
 ├── #180 ── independent
 ├── #181 ── independent
 └── #182 ── independent
```

**DAG:** valid. No edges between cohesion PRs. No cycles.

## Semantic dependencies (INFERRED, non-blocking)

| Concern | Related PRs | Note |
|---|---|---|
| Tenant auth middleware | mostly pre-existing on develop; cohesion PRs consume `requireAuthWithTenant` / `req.tenantId` | No PR in set rewrites middleware core |
| Payments / revenue | #170 payments DDL+routes; #182 collection revenue stamp | Different files; #182 assumes revenues.office_id column exists (pre-existing) |
| AI / Autopilot | #172–#174 AI modules; #182 caseAutopilot + ai-engine | Different files |
| GUC / pool containment | **#139** (recovery stack) | Not in cohesion set; still required for RLS session safety |

## External stack

```
main
 └── cursor/recovery-production-readiness-da81 (#138 lineage)
      └── #139 GUC containment
```

Cohesion set does **not** stack on recovery. Merge planning must treat recovery/GUC as a separate track.
