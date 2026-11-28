# PR Conflict Matrix

## File-level pairwise overlaps (cohesion set) — VERIFIED

| | Result |
|---|---|
| Pairwise file overlaps among #164+#166–#182 | **0** |
| Local merge conflicts integrating all 18 | **0** |

## Semantic / operational conflict risks — INFERRED

| Pair / area | Risk | Severity |
|---|---|---|
| #170 payments.ts vs #182 finance-center.ts | Both touch payment/revenue paths; different modules | Low — complementary |
| #171 orgStructure heal-to-`default` vs inventing-tenant invariants | Startup backfill invents `default` office_id | P1 residual (documented) |
| Cohesion set vs #139 GUC | Cohesion does not pin `set_config(..., true)` | Separate track; do not assume cohesion clears pool GUC |
| #165 vs #164 | Same batch against `main` vs `develop` | #165 CONFLICTING — close as superseded |

## Compatibility with develop tip — VERIFIED

All 18 heads are fast-forwardable merge commits onto `origin/develop` with clean trees in local integration.
