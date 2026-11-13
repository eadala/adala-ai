# GitHub Admin Closure — PR #141 & Governance Enforcement

**Audience:** Repository administrator (`eadala`) and Coolify operator  
**Agent scope:** Documentation only — this file does **not** change live GitHub/Coolify settings.  
**Related PRs:**
- Governance: [#141](https://github.com/eadala/adala-ai/pull/141) → `develop`
- Gate 5 deps remediation: [#142](https://github.com/eadala/adala-ai/pull/142) → `develop` (**merge first**, then rebase #141)
**Frozen RC (immutable):** `5441523302a1513f07b5dc08f028d848a0bad5b4` / tree `cd84a7f277c481dc5c96d707dde4e78d7f18e713`

---

## A. Required GitHub settings

### A1. Ruleset status (API-verified)

| Field | Current | Target |
|-------|---------|--------|
| Ruleset `adalah-ai` (id `17934003`) | **enforcement: disabled** | `active` after prerequisites |
| Target refs (`conditions.ref_name.include`) | **Empty `[]`** | `refs/heads/main`, `refs/heads/develop` |
| Rules present | `deletion`, `non_fast_forward` only | Expand (A2) |
| Collaborators | **`eadala` only** | ≥1 independent Write collaborator (B) |
| Bypass actors | `null` | Keep empty for routine work |

**UI path:** GitHub → `eadala/adala-ai` → **Settings** → **Rules** → **Rulesets** → `adalah-ai`

### A2. Exact recommended ruleset values

Apply to **both** `refs/heads/main` and `refs/heads/develop`:

| Setting | Value |
|---------|-------|
| Enforcement | `Active` (only after A4 + B complete; prefer Evaluate first if offered) |
| Restrict deletions | On |
| Block force pushes (`non_fast_forward`) | On |
| Require a pull request before merging | On |
| Required number of approvals | `1` |
| Dismiss stale pull request approvals when new commits are pushed | On |
| Require review from Code Owners | On (after B) |
| Require approval of the most recent reviewable push | On (recommended) |
| Require status checks to pass | On |
| Required checks (exact names) | `✅ All Gates Passed` (Quality Gates workflow). Optionally also `Branch & sensitive-path checks` for governance PRs |
| Require branches to be up to date | Optional; enable once develop tip is green |
| Require conversation resolution before merging | On (recommended) |
| Allow force pushes / deletions | Off for everyone |
| Bypass list | Empty for routine work; add break-glass owner only with written policy |

**Compatibility notes:**
- Check names must match job `name:` strings exactly as reported by `gh pr checks`.
- Do not require checks that do not run on `main` tip (main’s workflow differs from develop Quality Gates). Prefer requiring `✅ All Gates Passed` only on `develop` until main adopts the same gate names, **or** maintain separate rulesets per branch.
- Merge queue: not required; if enabled later, required checks must be the same names.

### A3. Safe activation sequence

1. Land [#142](https://github.com/eadala/adala-ai/pull/142) (Gate 5) and confirm Gate 5 PASS.
2. Rebase/update [#141](https://github.com/eadala/adala-ai/pull/141); confirm All Gates PASS.
3. Complete independent reviewer invite (B).
4. Set target refs + rules while still **disabled** / Evaluate.
5. Verify a throwaway docs PR is blocked without review + checks.
6. Set enforcement **Active** on `develop`, then `main` (or separate rulesets).
7. Record break-glass bypass owners outside the repo if needed.

### A4. Verification commands

```bash
gh api repos/eadala/adala-ai/rulesets/17934003 \
  --jq '{name,enforcement,include:.conditions.ref_name.include,rules:[.rules[].type]}'
gh api repos/eadala/adala-ai/collaborators --jq '.[].login'
```

---

## B. Independent reviewer procedure (exact)

**Problem:** Collaborators API lists only `@eadala`. Author cannot satisfy independent approval for their own PR when approvals are required.

### B1. Invite

1. GitHub → `eadala/adala-ai` → **Settings** → **Collaborators and teams** → **Add people**
2. Invite a trusted human reviewer (separate identity; not an alt controlled by the PR author)
3. Permission: **Write** (minimum to approve PRs under typical rulesets; **Maintain** only if they must manage settings)

### B2. Verify acceptance

```bash
gh api repos/eadala/adala-ai/invitations
gh api repos/eadala/adala-ai/collaborators --jq '.[].login'
```

Confirm the second login appears with `permissions.push=true` (or UI Write).

### B3. CODEOWNERS

Current: `.github/CODEOWNERS` → `* @eadala`

Minimum sustainable update (via PR, not force on protected branches):

```text
*       @eadala @<independent-reviewer>
/.github/  @eadala @<independent-reviewer>
```

Or a GitHub team `@<org>/adala-reviewers` with ≥2 members.

### B4. Review PR #141

1. Request review from the independent collaborator on #141
2. They approve after reading governance + confirming no production deploy hooks
3. Do **not** self-approve as a substitute; do **not** disable required reviews to unblock

---

## C. PR merge order (repository-side)

1. **Merge #142** (deps + develop CI path alignment) after CI green + independent review  
2. **Rebase #141** onto updated `develop`  
3. Confirm #141 All Gates PASS (Gate 5 inherited from develop tip)  
4. Independent review of #141  
5. Merge #141 → `develop` only with explicit admin authorization  

Do **not** merge #138–#140 as part of this work. Do **not** deploy.

---

## D. PR #141 merge prerequisites

| Prerequisite | Status |
|--------------|--------|
| Scope = docs/scripts/governance (+ prior Gate 1/7 path fixes) | Intended |
| Gate 5 criticals | Remediated in **#142** (orval≥8.21 / proxy-addr≥2.0.8) — merge then rebase |
| Independent review | **PENDING** |
| Frozen RC unchanged | **PASS** |
| Coolify Auto Deploy verified | **UNVERIFIED** |

---

## E. Coolify operator requirements (UNVERIFIED until completed)

Complete `docs/engineering/COOLIFY_OPERATOR_CHECKLIST.md`:

- Production app identity for `adalahai.com`
- **Deployed commit SHA**
- Watched branch
- Auto Deploy ON/OFF/PAUSED
- Whether non-`main` pushes deploy
- Webhook / deployment triggers
- Rollback capability
- PostgreSQL backup + restore evidence

Until then: `COOLIFY_DEPLOYMENT_SAFETY = UNVERIFIED`.

---

## F. Recovery gaps

| Layer | Status |
|-------|--------|
| Git source scripts | Implemented (read-only) |
| Application rollback via Coolify | **UNVERIFIED** |
| PostgreSQL backup/restore | **UNVERIFIED** |
| Hetzner snapshots | **UNVERIFIED** |
| Production baseline tag | **Do not create** without deployed SHA |

---

## G. Sign-off checklist

- [ ] PR #142 merged (Gate 5)
- [ ] PR #141 rebased + All Gates PASS
- [ ] Independent reviewer invited and eligible
- [ ] Ruleset targets + rules configured; enforcement authorized
- [ ] Coolify checklist completed
- [ ] Explicit authorization before merge to `develop`/`main`
