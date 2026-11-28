# P0 Auto-Merge Safety Interlock

Executed: 2026-11-13 (Asia/Riyadh). No approvals, protection changes, or deploys.

## Outcome

| Target | Result |
|---|---|
| Disable Auto-merge on #164 | **FAILED — already MERGED** |
| Open cohesion PRs #166–#185 Auto-merge | **All OFF** (`autoMergeRequest: null`) |
| Success condition (no unintended Auto-merge on open cohesion PRs) | **MET for open set** |
| #164 remains OPEN/unmerged | **NOT MET** — merged before interlock could disable |

## PR #164 — before / after

| Field | Before (this interlock refresh) | After attempted disable |
|---|---|---|
| state | **MERGED** | MERGED |
| mergedAt | `2026-11-13T19:39:27Z` (22:39 Asia/Riyadh) | unchanged |
| autoMergeRequest | ON — SQUASH, enabledBy **`eadala`** at `2026-11-13T19:39:22Z` | Still present on merged PR object; disable rejected |
| headRefOid | `094636ad0e3edc47f8556d12ce12e7d131a9ac79` | unchanged |
| Disable command | `gh pr merge 164 --disable-auto` | `GraphQL: Can't disable auto-merge for this pull request.` |

## Cohesion scan (#164, #166–#185)

| PR | State | Auto-merge | Action taken |
|---|---|---|---|
| #164 | MERGED | residual ON field on merged object | Disable attempted — **denied** (already merged) |
| #166–#182 | OPEN | null / OFF | None required |
| #183–#185 | OPEN | null / OFF | None required |

## Permission failures

1. Cannot disable Auto-merge on a **merged** PR (GitHub GraphQL `disablePullRequestAutoMerge` rejected).
2. Cannot unmerge #164 via this agent (not authorized; would require human revert PR).

## Manual steps if Auto-merge reappears on an OPEN PR

1. Open the PR on GitHub.
2. In the merge box, click **Disable auto-merge** (or ⋯ → Disable auto-merge).
3. Confirm the merge box no longer shows “Auto-merge enabled”.
4. Verify: `gh pr view <n> --json autoMergeRequest,state` → `autoMergeRequest: null`, `state: OPEN`.
5. Do **not** re-enable Auto-merge for Batch A/B cohesion PRs until independent review clears and a human explicitly authorizes merge.

## Recommended immediate human follow-up

1. Treat #164 land as an **unauthorized-to-program merge** relative to the independent-review gate (reviewDecision still showed `REVIEW_REQUIRED` at merge time).
2. Decide: keep on `develop` (verify post-merge CI/health) **or** open a controlled revert PR.
3. Keep Auto-merge **off** on remaining Batch A PRs (#166–#169) until independent reviews complete.
4. Optionally disable repo-level `Allow auto-merge` (Settings → General → Pull Requests) to prevent recurrence.

