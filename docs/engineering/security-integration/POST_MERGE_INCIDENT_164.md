# Post-Merge Incident Containment — PR #164

Priority: P0 Release Safety. Evidence time: 2026-11-13 (Asia/Riyadh).  
**No revert, merge, deploy, force-push, or ruleset change executed.**

## Recommendation

**MERGE_SAFE_WITH_UNVERIFIED_DEPLOYMENT**

Rationale: Merged diff is fail-closed tenant-hardening (not authz weakening); post-merge develop CI Gates 1–9 SUCCESS; no migration files; open cohesion PRs remain unmerged with Auto-merge OFF. Coolify/live production deploy status is **UNVERIFIED**. Independent-review gate was process-violated — governance remediation required before further merges.

## 1. Preserved evidence

| Item | Value |
|---|---|
| PR | #164 MERGED |
| Merge method | **SQUASH** (single parent) |
| Merge commit / develop HEAD | `478be04aa42c2ee50ca60d3d37704bcd41f657a5` |
| Parent (pre-merge develop) | `d2bd14d9262054a6948607a5bdfd8eb0c524a446` |
| Tree | `77c39acc3bdedd6e70666c4d30948e9a56ef0ed4` |
| Head branch tip merged | `094636ad0e3edc47f8556d12ce12e7d131a9ac79` |
| Merged at | `2026-11-13T19:39:27Z` (22:39 Asia/Riyadh) |
| Merge actor | **`eadala`** (MergedEvent + `merged_by`) |
| Auto-merge enabled at | `2026-11-13T19:39:22Z` |
| Auto-merge actor | **`eadala`** (not bot) |
| Auto-merge method | SQUASH |
| Review history | **`reviews: []`** — zero submitted reviews |
| `reviewDecision` at query | still `REVIEW_REQUIRED` (stale/post-merge field) |
| Required checks (pre-merge PR rollup) | SUCCESS including Gates 1–4+ (run `43475185349`) |
| Post-merge develop CI | run `43494267004` — **success** (Gates 1–9 + All Gates; Gate 10 skipped) |
| Branch protection (known) | `develop` protected; status checks Gates 1–4 with `enforcement_level: non_admins`; ruleset `adalah-ai` **disabled** |
| Full protection / bypass actor list | **UNVERIFIED** (API 403) |
| Frozen RC tree | `cd84a7f277c481dc5c96d707dde4e78d7f18e713` **unchanged** |
| `origin/main` | `c9667a0b…` unchanged by this incident |

Files in squash: `layout.tsx`, `mobile-nav.tsx`, `api.ts`, `aiCredits.ts`, `bankruptcyIntegrations.ts`, `internal-messages.ts`, `loginTracking.ts`, `noDefaultOfficeFallback.test.mjs`, `webhookHandlers.ts`.

## 2. Deployment exposure

| Signal | Result |
|---|---|
| GitHub Deployments API | empty / no records returned |
| GitHub Environments | `total_count: 0` |
| Workflows on develop push at merge | **CI — Quality Gates only** (`push` → `43494267004`) |
| Coolify / Hetzner live status | **PRODUCTION_DEPLOYMENT_STATUS_UNVERIFIED** |
| Assumption | Absence of GitHub deploy ≠ Coolify idle |

## 3. Merged code validation (`478be04a`)

| Check | Result | Evidence |
|---|---|---|
| Local TypeScript (`tsc -p api-server`) | **PASS** exit 0 | worktree + workspace `node_modules` |
| Local full monorepo build | **NOT_RUN** | not executed this incident |
| `noDefaultOfficeFallback.test.mjs` | **PASS** exit 0 | |
| Develop CI TypeScript/ESLint/Build/Security/Tenant Isolation | **PASS** | run `43494267004` |
| AuthN/AuthZ direction | **Hardening** | `requireAuth`→`requireAuthWithTenant`; reject `"default"`/`"platform"`; drop synthetic default seed/fallback |
| Database migrations | **None** in merge file list | runtime DDL still has residual `DEFAULT` in some CREATE TABLE paths (pre-existing pattern); no numbered migration |
| RLS / pool adversarial | **NOT_RUN** | `DATABASE_URL` unset / no disposable DB |
| Full regression suite | **NOT_RUN** | |

## 4. Remaining cohesion PR safety (#166–#185)

All **OPEN**, base **`develop`**, Auto-merge **OFF**, none unexpectedly merged, `mergeable=MERGEABLE`, `mergeStateStatus=BLOCKED` (`REVIEW_REQUIRED`), CI SUCCESS×12 (except as previously noted historically for #183 — current head `0d796595` SUCCESS×12).

| PR | Head (12) | Auto-merge |
|---|---|---|
| #166 | `c62b7f5f66a1` | OFF |
| #167 | `eaf9fc7946f1` | OFF |
| #168 | `6a9de7d40789` | OFF |
| #169 | `a8a575ca10e7` | OFF |
| #170–#182 | (unchanged tips) | OFF |
| #183 | `0d7965951e2c` | OFF |
| #184 | `ec4d7906e628` | OFF |
| #185 | `773fe7223c9a` | OFF |

## 5. Governance failure analysis

**Permitting mechanisms (evidence-based):**

1. **Administrator privileges** — merge actor `eadala` is repo **admin**; develop status-check enforcement was recorded as **`non_admins`**, so admins can merge without waiting on the same constraints as non-admins (**INFERRED** as primary enabler, consistent with observed merge despite `reviews: []`).
2. **Auto-merge configuration** — repo `allow_auto_merge=true`; Auto-merge enabled by admin 5s before squash land (**VERIFIED**).
3. **Missing effective independent review** — CODEOWNERS only `@eadala`; PR author/`merged_by` same account; zero review submissions (**VERIFIED**).
4. **Ruleset ineffective** — `adalah-ai` ruleset `enforcement:disabled` and empty ref includes (**VERIFIED**).
5. **Bypass permissions** — exact bypass actor list **UNVERIFIED** (API 403); admin merge rights sufficient explanation without invoking undocumented bypass.

**Not inferred solely from actor:** Auto-merge enablement timestamp, empty reviews, `non_admins` check enforcement, and disabled ruleset are independent artifacts supporting the same conclusion.

### Minimum config changes to enforce independent review (DO NOT APPLY without authorization)

1. Repo Settings → Branches → `develop`: enable **Require a pull request before merging**; **Require approvals ≥ 1**; enable **Do not allow bypassing the above settings** (include administrators).
2. Require review from Code Owners **and** add a second human CODEOWNER (not the sole author account).
3. Disable **Allow auto-merge** at repo level (or policy: never enable until approvals exist).
4. Enable an active ruleset targeting `refs/heads/develop` with required reviewers + required status checks (replace disabled `adalah-ai` stub).
5. Optional: restrict who can enable Auto-merge / merge to a release role distinct from PR author.

## 6. Containment recommendation detail

**Not recommending controlled revert** because the landed change strengthens tenant fail-closed behavior and post-merge CI is green. Revert would re-introduce inventing-default paths in Stripe/AI credits/login/messages.

If human later chooses revert anyway:

- Revert commit `478be04a` via new PR (no force-push).
- Dependent PRs: #166–#185 still based on develop — after revert they remain file-disjoint from #164 paths generally; re-validate mergeability.
- Migrations: none to roll back.
- Tests: re-run Gates 1–8 + `noDefaultOfficeFallback`.

## Next safe action

1. **Human:** Confirm Coolify watched branch / Auto Deploy for `develop` → set PRODUCTION_DEPLOYMENT_STATUS accordingly; if Auto Deploy on and production must not move, pause Coolify deploy manually.
2. **Human:** Apply governance items (admin-enforced reviews + disable auto-merge) **with explicit authorization**.
3. **Engineering:** Continue Batch A remainder (#166–#169) only after independent non-author approval; keep Auto-merge OFF; re-validate each PR against current develop before each merge.
4. **Do not** merge further cohesion PRs under Auto-merge.

