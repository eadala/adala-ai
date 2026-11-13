# Path 02 — Trial Staging (status board)

**Audience:** Platform engineer + Coolify operator + product owner  
**Integration branch:** `develop`  
**Predecessor:** Path 01 — Security, Governance & Release Integrity — **COMPLETE** (engineering); admin ruleset/reviewer **DEFERRED_BY_OPERATOR**

## Goal

Run a **controlled trial** of Adalah AI with a clear Go/No-Go, without claiming production readiness and without merging the old `main`-targeted conflict stacks (`#138–#140`, `#151`, `#152`).

## Engineering status (repo)

| Item | Status | Evidence |
|------|--------|----------|
| Path 01 audit / governance / deps | **DONE** | `#141`–`#160` on `develop`; `pnpm audit` clean |
| Trial kit docs + preflight script | **DONE** | `TRIAL_*`, `trial-preflight.sh` |
| Kickoff identity snapshot | **THIS PR** | `TRIAL_KICKOFF.md` |
| `trial-preflight.sh HEAD` | **PASS** | Exit 0 on tip |
| Frozen RC identity | **UNCHANGED** | `54415233…` / `cd84a7f…` |
| Open PRs → `develop` | Prefer **0** between Path 02 slices | — |

## Operator status (outside git)

| Item | Status | Notes |
|------|--------|-------|
| Coolify **staging** app (not prod) | **DEFERRED_BY_OPERATOR** | See `COOLIFY_OPERATOR_CHECKLIST.md` §F |
| Staging DNS / `trial.*` | **DEFERRED_BY_OPERATOR** | Live platform path in use |
| Staging env profile | Ready when operator starts | `TRIAL_STAGING_ENV.md` (test keys only) |
| Smoke Go/No-Go | Pending staging or named live checks | `TRIAL_SMOKE_TEST.md` |
| Live platform health | Observed healthy | `https://adalahai.com/api/healthz` |

## How to proceed (ordered)

1. **Engineering (agents):** keep `develop` green; do not reopen Path 01; do not retarget conflicted `#151`/`#152` onto `main`.
2. **Kickoff:** keep `TRIAL_KICKOFF.md` SHA/tree updated when tip moves before a real staging deploy.
3. **Operator (when un-deferred):** create staging Coolify app → apply `TRIAL_STAGING_ENV.md` → deploy agreed `develop` SHA → record SHA → run `TRIAL_SMOKE_TEST.md`.
4. **Go/No-Go:** Critical smoke rows must PASS before inviting beyond named testers.

## Related docs

- [`TRIAL_KICKOFF.md`](./TRIAL_KICKOFF.md)
- [`TRIAL_LAUNCH_RUNBOOK.md`](./TRIAL_LAUNCH_RUNBOOK.md)
- [`TRIAL_SMOKE_TEST.md`](./TRIAL_SMOKE_TEST.md)
- [`TRIAL_STAGING_ENV.md`](./TRIAL_STAGING_ENV.md)
- [`GITHUB_ADMIN_CLOSURE.md`](./GITHUB_ADMIN_CLOSURE.md) (Path 01)
- [`RULESET_ADALAH_AI_APPLY.md`](./RULESET_ADALAH_AI_APPLY.md) (deferred admin)

## Explicit non-goals this path

- Activating ruleset `adalah-ai` (still deferred)
- Production Auto Deploy / `adalahai.com` Coolify changes from agents
- Merging `#138–#140` release stack as part of trial
- Closing conflicted `#151`/`#152` via force-merge into `main`
