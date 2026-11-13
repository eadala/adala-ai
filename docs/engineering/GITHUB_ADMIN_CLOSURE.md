# GitHub Admin Closure — PR #141 & Governance Enforcement

**Audience:** Repository administrator (`eadala`) and Coolify operator  
**Agent scope:** Documentation only — this file does **not** change live GitHub/Coolify settings.  
**Related PR:** [#141](https://github.com/eadala/adala-ai/pull/141) → `develop`  
**Frozen RC (immutable):** `5441523302a1513f07b5dc08f028d848a0bad5b4` / tree `cd84a7f277c481dc5c96d707dde4e78d7f18e713`

---

## A. Required GitHub settings

### A1. Ruleset status (verified 2026-11-13)

| Field | Current | Target |
|-------|---------|--------|
| Ruleset `adalah-ai` (id `17934003`) | **enforcement: disabled** | Enable for `main` and `develop` after prerequisites |
| Target refs (`conditions.ref_name.include`) | **Empty `[]`** — would not protect any branch even if enabled | Set `refs/heads/main`, `refs/heads/develop` |
| Rules present | `deletion`, `non_fast_forward` only | Expand (see A2) |
| Collaborators | **`eadala` only** (API) | Add ≥1 independent Write collaborator before requiring reviews |
| Branch protection API | Often **403** to automation tokens | Configure in UI |

**UI path:** GitHub → `eadala/adala-ai` → **Settings** → **Rules** → **Rulesets** → `adalah-ai`

### A2. Recommended ruleset for `main` and `develop`

Target refs: `refs/heads/main`, `refs/heads/develop`

| Rule | Recommended value |
|------|-------------------|
| Restrict deletions | Enabled |
| Block force pushes | Enabled |
| Require a pull request before merging | Enabled |
| Required approvals | **1** (independent; not the author) |
| Dismiss stale reviews | Enabled |
| Require review from Code Owners | Enabled (after A3) |
| Require status checks | Enable after green check names stabilize |
| Suggested checks (mainline) | `✅ All Gates Passed` and/or Governance Safety job when intentional |
| Require conversation resolution | Optional but recommended |
| Bypass list | Empty for routine work; break-glass owners only |

**Do not enable enforcement until:**

1. Required check names exist on the target branch tip and can succeed.
2. At least one eligible non-author reviewer can approve.
3. `develop` CI baseline is repaired or status-check list is scoped accordingly (see A4).

### A3. Verification after change

```bash
gh api repos/eadala/adala-ai/rulesets/17934003 --jq '{name,enforcement,rules:[.rules[].type]}'
# Open a throwaway docs PR and confirm merge is blocked without review + checks
```

---

## B. Reviewer / CODEOWNERS resolution

**Current:** `.github/CODEOWNERS` → `* @eadala`

**Problem:** If `@eadala` authors a PR, GitHub will not treat self-approval as an independent review when “require approvals” is enforced.

**Minimum compliant options:**

1. Add a second human collaborator with Write access and list them in CODEOWNERS for critical paths (`/.github/`, `/artifacts/api-server/migrations/`, auth/tenant files).
2. Create a GitHub team (e.g. `adala-reviewers`) with ≥2 members; set CODEOWNERS to `@org/adala-reviewers`.
3. For owner-authored release PRs into `main`, require an external peer account to approve.

**Do not:** disable CODEOWNERS, fabricate approvals, or use alt accounts controlled by the same person to simulate independence.

**UI path:** Settings → Collaborators and teams → invite reviewer → update `.github/CODEOWNERS` via PR.

---

## C. Ruleset activation sequence

1. Repair or accept `develop` CI baseline (A4).
2. Add independent reviewer (B).
3. Draft ruleset changes in **evaluate** / report-only mode if available; otherwise enable on `develop` first.
4. Confirm a test PR is blocked without review and unblocked after valid approval + checks.
5. Enable the same rules for `main`.
6. Document break-glass bypass owners.

---

## D. PR #141 merge prerequisites

| Prerequisite | Status (2026-11-13) |
|--------------|---------------------|
| Scope = docs/scripts/governance CI only (+ minimal develop CI path fixes) | Intended |
| Governance Safety workflow | Re-verify on latest tip (must PASS) |
| Full CI Quality Gates on develop tip | Gate 1/7 fixed in #141; Gate 5 still FAIL (see A4) |
| Independent review | **PENDING** (`REVIEW_REQUIRED`, 0 reviews) |
| Frozen RC unchanged | **PASS** |
| Coolify Auto Deploy verified | **UNVERIFIED** |
| Merge authorization | Do **not** merge until Gate 5 policy + review + Coolify evidence |

### A4. Develop CI baseline debt (blocker for green “All Gates”)

Observed on PR #141 against `develop` (`4f220d96…`):

| Gate | Result | Root cause |
|------|--------|------------|
| Gate 7 Architecture | Fixed in #141 | Workflow expected `packages/db`; tree has `lib/db` |
| Gate 1 TypeScript | Fixed in #141 | Build `lib/db` + `lib/api-zod` before api-server typecheck (composite refs) |
| Gate 5 Dependency Audit | FAIL | Pre-existing criticals on develop tip: `orval@8.9.1` (<8.21.0 RCE advisories), `proxy-addr@2.0.7` via express — **do not silence**; separate deps PR or sync `main`→`develop` |

**Admin choices (pick one):**

1. **Preferred:** Merge/rebase `main` into `develop` (separate authorized PR) so develop inherits fixed CI + deps, then re-run #141.  
2. Land minimal CI path fixes via #141 (Gate 1/7) and open a **separate** deps PR for Gate 5.  
3. Temporarily do not require full Quality Gates on docs-only PRs to develop (policy change — requires explicit admin decision; do not weaken `main`).

---

## E. Coolify operator requirements

Complete `docs/engineering/COOLIFY_OPERATOR_CHECKLIST.md` and return:

- Production app identity for `adalahai.com`
- **Deployed commit SHA**
- Watched branch
- Auto Deploy ON/OFF/PAUSED
- Whether non-`main` pushes deploy
- Backup + restore evidence

Until then: `COOLIFY_DEPLOYMENT_SAFETY = UNVERIFIED`.  
Do **not** treat merge of #141 as production release readiness.

---

## F. Recovery gaps

| Layer | Status |
|-------|--------|
| Git source scripts (`verify-release` / `recovery-inspect`) | Implemented (read-only) |
| Application rollback via Coolify | **UNVERIFIED** |
| PostgreSQL backup/restore drill | **UNVERIFIED** |
| Hetzner snapshots | **UNVERIFIED** |
| Production baseline tag | **Do not create** without deployed SHA |

---

## G. Sign-off checklist

- [ ] Ruleset enforcement plan approved
- [ ] Independent reviewer available
- [ ] Develop CI baseline strategy chosen (A4)
- [ ] PR #141 reviewed by non-author
- [ ] Coolify checklist completed
- [ ] Explicit authorization before any merge to `develop`/`main`
