# Recommended Release Composition

## Principle

Minimum complete security + reliability set. Not “newest everything.”

## Selected composition (immutable intent)

**Base:** `origin/develop` @ `478be04aa42c2ee50ca60d3d37704bcd41f657a5` (includes #164)

**Integrate (exact heads at selection time):**

| Order | PR | Head SHA | Notes |
|---|---|---|---|
| 1–16 | #166–#181 | (see inventory) | Cohesion batches; file-disjoint |
| 17 | #182 | `b62d2b8a97e0` | Batch19 |
| 18 | #185 | `773fe7223c9a` | JLWM seed gate |
| 19 | #183 intent | applied as RC commit | Resolve conflict with #182 |

**Parallel required (not in local RC tree yet):**

| PR | Head | Why deferred in tree |
|---|---|---|
| #139 | `ad113dc56b09` | Different base (recovery); must be planned as dedicated stack onto RC or main |

**Exclude:** #165, feature-only PRs, unreviewed Auto-merge.

## Local built candidate

| Field | Value |
|---|---|
| Branch (local only, **not pushed**) | `cursor/release-candidate-modernization-da81` |
| HEAD | `5ca2a2e931b859ed36b51eed75fd3e03cda509c7` |
| TREE | `bd9e3750fc7870c05124dc4af9e844095c292dd1` |
| Worktree | `/tmp/security-integration/release-candidate-wt` |

## Dependencies

Cohesion PRs independent of each other. #183 depends semantically on #182 file. #139 depends on recovery lineage / GUC middleware.

## Migrations

Cohesion PRs: mostly runtime DDL. Main already has 053–057. Prod apply status **UNVERIFIED**. #139 may add GUC-related changes — inspect before promote.
