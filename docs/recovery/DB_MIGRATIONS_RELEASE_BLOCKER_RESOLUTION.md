# DB Migrations Release Blocker — Resolution Report

**Mode:** Autonomous engineering with production-safety bounds  
**Repository:** `eadala/adala-ai`  
**Report time:** 2026-11-07 (Asia/Riyadh)  
**Author:** Cursor release-engineering agent

---

## A. Baseline

| Item | Value |
|------|--------|
| Working branch (investigation start) | `cursor/integration-recovery-p0-da81` @ `ad113dc56b09f687fc93d9143b3763604a44c068` |
| Fix branch | `cursor/release-db-migrations-reliability-da81` |
| Recovery PR | [#138](https://github.com/eadala/adala-ai/pull/138) — tip `b3d9a0afd1b45486296910827824363bd9ed6810` |
| P0 Hotfix PR | [#139](https://github.com/eadala/adala-ai/pull/139) — tip `ad113dc56b09f687fc93d9143b3763604a44c068` |
| Expected combined Git tree | `b081417bf551e24e1078d37f815b6c553f58a2eb` — **MATCHED** at baseline |
| Ancestry | RC is ancestor of combined candidate (fast-forward; 5 hotfix commits) |
| Migrations | `058` → `059` → `060` preserved (unchanged by this fix) |
| P0 GUC containment | Preserved (unchanged by this fix) |

Prior release decision (before this work): INTEGRATION READY / MERGE NOT READY / PRODUCTION NO-GO — driven by non-terminal DB Migrations checks.

---

## B. CI Investigation

### Live classification (first observation)

| PR | Tip SHA | DB Migrations status |
|----|---------|----------------------|
| #138 | `b3d9a0a` | **IN_PROGRESS** (later: tip also gained **SUCCESS**) |
| #139 | `ad113dc` | **IN_PROGRESS** |

CANCELLED / IN_PROGRESS were never treated as PASS.

### Run IDs and evidence

| Run | Branch / event | Tip | DB Migrations | Duration | Notes |
|-----|----------------|-----|---------------|----------|-------|
| `42318213513` | recovery / **push** | `b3d9a0a` | **SUCCESS** | **53.2 min** | All Gates Passed SUCCESS |
| `42318218990` | recovery / **pull_request** | `b3d9a0a` | IN_PROGRESS (sibling) | >50 min observed | Same tip; duplicate job |
| `42321709793` | hotfix / push | `ad113dc` | IN_PROGRESS | progressing | Last step: “Run migration integration tests” |

### Progress evidence (not a hang)

Live logs showed continuous scenario advancement, e.g. on run `42318218990`:

- 00:26 Asia/Riyadh-adjacent UTC: Scenario 1…  
- ~01:14 UTC: Scenario 051  
- ~01:18 UTC: Scenario 054  

`✅` assertions accumulating; `❌` count **0** while in progress.

### Log volume evidence

| Artifact | Size | NOTICE lines |
|----------|------|--------------|
| #139 job log (~10 min) | ~14 MB | ~65k |
| #138 job log (~50 min) | ~100+ MB | ~442k |

Last active step on all affected jobs: **Run migration integration tests** (`pnpm run test:db-migrations` → `scripts/db/test-migrations.integration.sh`).

### Historical comparison

Successful Migration-057-era runs completed in **~89–91 minutes** (e.g. run `33307472360`).  
Current tip on #138 completed the push-path job in **~53 minutes** — within historical bounds; the suite is **legitimately long-running**, not deadlocked.

### Duplicate-check root factor

Workflow concurrency was `ci-${{ github.ref }}`.

- `push` → `refs/heads/<branch>`  
- `pull_request` → `refs/pull/<n>/merge`  

Different concurrency keys → **two full DB Migrations jobs** for the same tip. One can succeed while the PR rollup still shows IN_PROGRESS.

---

## C. Root Cause

### Root-cause matrix

| Hypothesis | Evidence | Confidence | Disposition |
|------------|----------|------------|-------------|
| **A. Slow but progressing suite** | Scenario timestamps advance; historical ~90m; #138 push SUCCESS in 53m | **High** | **Confirmed primary** |
| **B. NOTICE stderr flood** | `psql_db -f … >/dev/null` left stderr; IF NOT EXISTS NOTICE spam; 100MB+ logs | **High** | **Confirmed amplifier** |
| **C. Duplicate push+PR CI** | Distinct concurrency refs; twin IN_PROGRESS + SUCCESS on same tip | **High** | **Confirmed amplifier** |
| Deadlock / lock wait | No stuck scenario; passes keep accumulating | Low | Rejected |
| Pool exhaustion / open Node handles | Suite is bash+psql, not app pool | Low | Rejected |
| Unresolved async test | N/A for shell suite | Low | Rejected |
| Migration 058–060 failure | Not yet in suite path; in-progress logs still ≤057 scenarios | N/A | Not implicated |
| Need to raise timeout to hide hang | Hang not demonstrated | — | Rejected as “fix” |

### Confirmed cause

1. **Primary:** DB Migrations is a long, multi-scenario integration suite (~53–90 minutes). Observing it mid-flight looks like a “stuck” required check.  
2. **Amplifier:** Quiet applies redirected **stdout only**, so PostgreSQL `NOTICE` (“already exists, skipping”) flooded Actions logs and I/O.  
3. **Amplifier:** Push + pull_request concurrency keys differed, so two jobs raced on the same tip and kept one rollup entry IN_PROGRESS after the other succeeded.

### Impact

- Release control incorrectly blocked on “non-terminal CI” even when a tip SHA already had SUCCESS.  
- Operator confusion and CI minute waste.  
- No application security defect; no production data impact.

### Reproduction

- Microbench (local PG 16): re-apply `014_bankruptcy_schema.sql`  
  - Default messages: **334 NOTICE / ~53 KB** stderr  
  - `client_min_messages=warning`: **0 NOTICE / 0 bytes**  
- Intentional `RAISE NOTICE` via default `psql_db` still emits (NOTICE assertions preserved).

---

## D. Correction

**Branch:** `cursor/release-db-migrations-reliability-da81` (from combined candidate `ad113dc`; does **not** rewrite frozen RC or #138/#139 tips in place).

### Files changed

1. `scripts/db/test-migrations.integration.sh`  
   - Added `apply_sql_file_quiet` using `PGOPTIONS=-c client_min_messages=warning`.  
   - Routed all routine `apply_migration_*` / base applies through it.  
   - Left direct `psql_db … >/tmp/….log 2>&1` paths unchanged so NOTICE/READY assertions still capture.  
   - Documented expected GHA duration at suite start.

2. `.github/workflows/ci.yml`  
   - `timeout-minutes: 120` on `db-migrations` (bound hang detection; historical success ≪ 120m).  
   - Concurrency group unified on `github.event.pull_request.head.ref || github.ref_name`.  
   - Comment documenting expected duration / quiet applies.

### Why necessary

Addresses demonstrated causality (log flood + duplicate long jobs + unbounded hang detection) **without** weakening security tests, changing migrations 058–060, or altering RLS/GUC behavior.

### Compatibility

- Migrations, P0 containment, tenant auth, Stripe gates: **unchanged**.  
- NOTICE-asserting scenarios continue to use default `psql_db` log capture.

---

## E. Verification

| Level | Result |
|-------|--------|
| Microbench quiet vs noisy apply | PASS — NOTICE 334 → 0 |
| `FOCUS_SCENARIO=057` | PASS — 10/0/0 in ~10s |
| `FOCUS_SCENARIO=056` | PASS — 15/0/0 in ~72s |
| Scenario 018 NOTICE assertions (harness) | PASS on A/C NOTICE checks; 2 harness path misses (`verify-schema.sh` / drizzle path) unrelated to quiet apply |
| Remote CI on **pre-fix** #138 tip `b3d9a0a` (push run `42318213513`) | DB Migrations **SUCCESS** 53.2m; All Gates **SUCCESS** |
| Remote CI on #139 tip `ad113dc` | Still completing at report time (IN_PROGRESS / progressing) |
| Remote CI on **this fix branch** | Required after push (new tree) — do not reuse other SHA results |

Security non-regression contract: no production code paths changed; suite assertions for RLS READY notices preserved.

---

## F. Release Integrity

| Item | Status |
|------|--------|
| Pre-fix combined candidate SHA | `ad113dc56b09f687fc93d9143b3763604a44c068` |
| Pre-fix combined tree | `b081417bf551e24e1078d37f815b6c553f58a2eb` |
| Fix branch tree | **Changed** (CI reliability only) — new SHA after commit |
| Intended merge content | #138 recovery + #139 P0 containment (+ this reliability delta if landed) |
| Merge strategy | Prefer one verified tip; FF or tree-equal merge/squash to `ad113dc` lineage then reliability commits |
| Coolify auto-deploy | **BLOCKED FOR HUMAN CONFIRMATION** (repo has no deploy workflow; external watch unknown) |

**Do not ship #138 alone** if Coolify auto-deploys `main`.

---

## G. Remaining Blockers (human-gated)

| Gate | Verdict |
|------|---------|
| #139 DB Migrations terminal SUCCESS on tip | Await / re-check (was IN_PROGRESS) |
| Fix-branch CI SUCCESS | Required if reliability PR is included in release tip |
| Coolify manual-only confirm | **BLOCKED FOR HUMAN CONFIRMATION** |
| Prod RLS role inventory (`scripts/db/prod-rls-role-inventory.sql`) | **NOT VERIFIED** |
| Isolated backup restore evidence | **BLOCKED** (doc ≠ evidence) |
| Secrets / live E2E | **NOT VERIFIED** |
| Prod apply App → 058 → 059 → 060 under restricted traffic | Not authorized for agent |

---

## H. Final Decisions

| Decision | Verdict |
|----------|---------|
| **CODE INTEGRATION** | **READY** — combined security tree verified; reliability fix is additive CI-only |
| **MERGE AUTHORIZATION** | **NOT READY** until (1) #139 tip DB Migrations **SUCCESS**, (2) Coolify auto-deploy human confirmation, (3) if including this fix, its CI SUCCESS on the new tree |
| **PRODUCTION AUTHORIZATION** | **NO-GO** — production role inventory, backup restore evidence, secrets, and controlled migration window remain human-gated |

### Operator note on #138

Tip `b3d9a0a` already has a terminal **SUCCESS** DB Migrations result on push run `42318213513` (~53m) and **All Gates Passed**. A sibling PR-event job may still show IN_PROGRESS due to the pre-fix concurrency split — treat SUCCESS on the tip SHA as the authoritative migration proof for that tree, and land the concurrency fix so this does not recur.
