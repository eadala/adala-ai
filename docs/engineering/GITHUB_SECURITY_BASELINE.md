# GitHub Security Baseline — Adalah AI

## Observed state (agent-readable evidence)

| Control | Observed | Notes |
|---------|----------|-------|
| Default branch | `main` | API |
| Ruleset `adalah-ai` | Present, **enforcement: disabled** | API |
| Branch protection API | Often **403** to integration token | Treat as ACCESS REQUIRED, not “absent” |
| Merge methods | squash / merge / rebase allowed | API |
| Auto-merge capability | enabled at repo setting | Does not replace reviews |
| CODEOWNERS | `.github/CODEOWNERS` → `* @eadala` | Self-review eligibility risk |
| Actions deploy workflow | **Absent** (`deploy.yml` removed historically) | Build/gates only in `ci.yml` |
| Secrets in git | Forbidden | Gate 4 secret scan in CI on mainline |

Refresh with:

```bash
gh api repos/eadala/adala-ai/rulesets
gh api repos/eadala/adala-ai --jq '{default_branch,allow_squash_merge,delete_branch_on_merge}'
```

## Required posture (target)

### `main` and `develop`

- Require pull request before merge.
- Require at least **1 independent approving review** (not the PR author).
- Require status checks from CI Quality Gates (as configured on the tip that owns `ci.yml`).
- Disallow force-push and branch deletion for protected refs.
- Restrict who can push.

### Self-review problem (`@eadala`)

CODEOWNERS currently lists only `@eadala`. If the same account authors a PR, GitHub may not count the author as a satisfying review depending on org settings.

**Compliant options (admin):**

1. Add a second human reviewer / team to CODEOWNERS for critical paths.
2. Require reviews from Code Owners **and** dismiss stale reviews; ensure a non-author reviewer always approves.
3. Use a bot-free human peer account for release PRs into `main`.

Do **not** bypass required reviews. Do **not** disable CODEOWNERS to land a PR.

## Actions security

- Prefer `permissions:` least privilege on workflows (`contents: read` default).
- Pin third-party actions to full commit SHAs when introducing new ones.
- Avoid `pull_request_target` with untrusted checkout + secrets.
- Do not echo secrets in logs.
- Concurrency groups should cancel redundant runs for the same head branch.

## Dependabot / security features

Admin should confirm Dependabot alerts, secret scanning, and push protection in GitHub Settings → Security. Mark **UNVERIFIED** until an admin screenshot/API confirms.

## Release tag protection

Protect tags matching `v*` from force updates / deletion (admin Settings → Tags / Rulesets).
