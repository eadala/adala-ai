# Batch A Pre-Merge Security Gate

Evidence time: 2026-11-13 (Asia/Riyadh). **No merges performed.**

## Decision

**BATCH_A_BLOCKED_BY_REVIEW**

Acceptance rule: independent review missing on every Batch A PR (`reviewDecision=REVIEW_REQUIRED`, `reviews=[]`, `mergeStateStatus=BLOCKED`). Required CI for Batch A is green. No critical open-PR tenant-isolation dependency blocks Batch A.

## Frozen / preserved candidates — VERIFIED

| Artifact | Value |
|---|---|
| Frozen RC tree | `cd84a7f277c481dc5c96d707dde4e78d7f18e713` unchanged |
| Full integration candidate tree | `168a55b43e139b67d7ff7687c624dff6a5518015` preserved at `/tmp/security-integration/integration-wt` |
| Batch A-only local candidate | HEAD `785545081c373c4a223b97d4761a2af3be5703f7` TREE `6e6e8477196a9cb5ba6c64ae02ed8cdc9c7a8005` (local worktree only; not pushed) |

## Batch A PR matrix

| PR | Head SHA | Base | CI | Review | Mergeable | Auth |
|---|---|---|---|---|---|---|
| #164 | `094636ad0e3edc47f8556d12ce12e7d131a9ac79` | develop | SUCCESS×12 | **MISSING** | MERGEABLE / BLOCKED | **NO** until review |
| #166 | `c62b7f5f66a1d5efb28425038d0ccf1c1b997b24` | develop | SUCCESS×12 | **MISSING** | MERGEABLE / BLOCKED | **NO** until review |
| #167 | `eaf9fc7946f1420f1f5a7ac667318837122f8410` | develop | SUCCESS×12 | **MISSING** | MERGEABLE / BLOCKED | **NO** until review |
| #168 | `6a9de7d40789905dbb0e393518c71df017650a38` | develop | SUCCESS×12 | **MISSING** | MERGEABLE / BLOCKED | **NO** until review |
| #169 | `a8a575ca10e7886e9db65466c3178545862b2891` | develop | SUCCESS×12 | **MISSING** | MERGEABLE / BLOCKED | **NO** until review |

Dependencies between Batch A PRs: **none** (0 file overlaps; sequential merge clean).

Dependencies on #139 / #183 / #184 / #185: **none** (0 file overlaps; #139 different base; no shared middleware/RLS/schema migrations in Batch A delta).

## Related PR CI / order

| PR | Head | CI | Role vs Batch A |
|---|---|---|---|
| #139 | `ad113dc56b09…` | SUCCESS×26 | Parallel recovery/GUC track — **not required** before Batch A |
| #183 | `4821321e…` (+ TS fix push) | Was FAILURE Gate1 (`Cannot find name 'c'`) | **Not required** before Batch A; merge **after** Batch A (or independently once green) |
| #184 | `f8e882b8…` | SUCCESS×12 | Docs only — anytime |
| #185 | `773fe722…` | SUCCESS×12 | Independent `index.ts` — anytime after/parallel Batch A |

Recommended order after reviews: `#164 → #166 → #167 → #168 → #169` (reviewability), then `#185`, then `#183` (once CI green), `#184` anytime. `#139` stays on recovery base.

## Runtime / schema conflict check — VERIFIED

- Pairwise file overlaps Batch A: **NONE**
- Migration/SQL/drizzle files in Batch A delta: **NONE**
- `orgStructure` / `requireAuth` / RLS / `set_config` in Batch A delta: **NONE**
- Combined Batch A merge: **clean** → tree `6e6e8477…`
- Guard test: `node --test …/noDefaultOfficeFallback.test.mjs` → **PASS** exit 0

## DEFAULT `'default'` / orgStructure — Batch A scope

| Finding | In Batch A? | Production reachability | Cross-tenant impact | Gate impact |
|---|---|---|---|---|
| Route inventing `officeId="default"` | Being **removed** by #164–#169 | Pre-fix yes; post-fix fail-closed 403 | Batch A reduces inventing | Non-blocking |
| Residual DDL `DEFAULT 'default'` in CREATE TABLE (`aiCredits`, `onboarding`, `document-templates`) | Present after Batch A | Only if INSERT omits `office_id`; Batch A routes stamp/reject | Schema debt P2 | Non-blocking for Batch A |
| orgStructure heal-to-`default` | **No** — lives in #171 | N/A to Batch A | Out of scope | Non-blocking |

## RLS / pool containment on Batch A candidate

| Item | Result |
|---|---|
| Disposable Postgres | **Unavailable** (`DATABASE_URL` unset; no local Postgres/docker DB) |
| Adversarial suite | **NOT_RUN** |
| Blocker | Provision disposable Postgres, set `DATABASE_URL`, re-run G6 suite on Batch A tree `6e6e8477…` |
| Batch A authz note | Batch A does not modify GUC/RLS middleware; #139 remains separate |

## Rollback implications

- Each Batch A PR independently revertable (disjoint files).
- No numbered migrations; runtime DDL leftovers (if any pre-existing CREATE IF NOT EXISTS) are not undone by git revert.
- Prefer revert PR commit over force-push.

## Minimum actions to unblock BATCH_A_READY_FOR_AUTHORIZED_MERGE

1. **Required:** Independent approving review on #164, #166, #167, #168, #169 (clear `REVIEW_REQUIRED` / `mergeStateStatus=BLOCKED`).
2. **Required:** Re-confirm CI still SUCCESS on those exact SHAs at merge time.
3. **Not required for this gate:** #139, #183, #185, disposable RLS suite — document/follow separately before production.
