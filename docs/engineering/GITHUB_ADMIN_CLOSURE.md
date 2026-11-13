# GitHub Admin Closure — Path 01 status & governance enforcement

**Audience:** Repository administrator (`eadala`) and Coolify operator
**Agent scope:** Documentation only — this file does **not** change live GitHub/Coolify settings.
**Related PRs:**
- Governance + Gate 5 stack: [#141](https://github.com/eadala/adala-ai/pull/141) → `develop` — **MERGED**
- Gate 5 deps-only: [#142](https://github.com/eadala/adala-ai/pull/142) → **CLOSED as superseded** (content on develop via `29ad4d2f`)
- Admin status docs: [#143](https://github.com/eadala/adala-ai/pull/143) → **MERGED**
**Develop tip (engineering path):** track `origin/develop` (post-#143: `5d4bb192…`)
**Develop CI:** Gate 5 + All Gates **SUCCESS** on tip after #141/#143
**Frozen RC (immutable):** `5441523302a1513f07b5dc08f028d848a0bad5b4` / tree `cd84a7f277c481dc5c96d707dde4e78d7f18e713`

### Engineering path vs production path

| Track | Status | Blocker? |
|-------|--------|----------|
| Develop engineering (governance, Gate 5, CI, deps #141–#156) | **DONE** — `pnpm audit` **No known vulnerabilities** on tip | No |
| GitHub ruleset + independent reviewer | Admin UI / invite — **PENDING** (Write collaborator; ruleset Evaluate/Disabled until then) | Blocks *enforced* review policy only |
| Coolify / production deploy baseline | **DEFERRED** by product decision — continue code without waiting | Blocks **production release claims** only — not develop engineering |


## Engineering path — COMPLETE (2026-11-13)

| Checkpoint | Evidence |
|------------|----------|
| #141 governance | MERGED |
| #142 Gate 5 deps | CLOSED superseded |
| #143/#144 status docs | MERGED |
| #153 zod high | MERGED |
| #155 moderate batch | MERGED |
| #156 low cleanup | MERGED → tip `845eb8bd…` |
| `pnpm audit` on tip | **No known vulnerabilities found** |
| Open PRs → `develop` | **none** |

**Remaining (admin UI only — not code):** independent Write collaborator (B), ruleset prepare/activate (A), Coolify production baseline (**DEFERRED**).

---
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
**Apply guide:** [`RULESET_ADALAH_AI_APPLY.md`](./RULESET_ADALAH_AI_APPLY.md) (click-path for ruleset `adalah-ai`).


### A2. Exact recommended ruleset values

Apply to **both** `refs/heads/main` and `refs/heads/develop` (or separate rulesets if check names differ):

| Setting | Value |
|---------|-------|
| Enforcement | `Active` (prefer Evaluate first if offered) |
| Restrict deletions | On |
| Block force pushes (`non_fast_forward`) | On |
| Require a pull request before merging | On |
| Required number of approvals | `1` |
| Dismiss stale pull request approvals when new commits are pushed | On |
| Require review from Code Owners | On (after B) |
| Require approval of the most recent reviewable push | On (recommended) |
| Require status checks to pass | On |
| Required checks (exact names) | `✅ All Gates Passed` on `develop`; confirm `main` names before requiring there |
| Require conversation resolution before merging | On (recommended) |
| Allow force pushes / deletions | Off |
| Bypass list | Empty for routine work; break-glass only with written policy |

### A3. Safe activation sequence

1. ~~Land Gate 5 remediation and confirm Gate 5 PASS.~~ **DONE**
2. ~~Land governance docs/scripts on develop.~~ **DONE** (#141 / #143)
3. Complete independent reviewer invite (B). **NEXT** (for enforced policy)
4. Set target refs + rules while still **disabled** / Evaluate.
5. Verify a throwaway docs PR is blocked without review + checks.
6. Set enforcement **Active** on `develop`, then `main` (or separate rulesets).
7. Record break-glass bypass owners outside the repo if needed.

### A4. Verification commands

Preferred one-shot (read-only):

```bash
./scripts/release/verify-path01-admin.sh
```

Expect `RESULT: ENGINEERING_OK_ADMIN_PENDING` until collaborator + ruleset targets/enforcement are set; then `PATH01_ADMIN_READY`.

Manual equivalents:

```bash
gh api repos/eadala/adala-ai/rulesets/17934003 \
  --jq '{name,enforcement,include:.conditions.ref_name.include,rules:[.rules[].type]}'
gh api repos/eadala/adala-ai/collaborators --jq '.[].login'
gh api repos/eadala/adala-ai/commits/develop --jq '{sha:.sha[0:7],msg:.commit.message|split("\n")[0]}'
pnpm audit  # expect: No known vulnerabilities found
```

---

## B. Independent reviewer procedure (exact)

**Problem:** Collaborators API lists only `@eadala`. Author cannot satisfy independent approval when approvals are required.

### B1. Invite

1. GitHub → `eadala/adala-ai` → **Settings** → **Collaborators and teams** → **Add people**
2. Invite a trusted human reviewer (separate identity)
3. Permission: **Write** (minimum)

### B2. Verify acceptance

```bash
gh api repos/eadala/adala-ai/invitations
gh api repos/eadala/adala-ai/collaborators --jq '.[].login'
```

### B3. CODEOWNERS

Current: `.github/CODEOWNERS` → `* @eadala`

```text
*       @eadala @<independent-reviewer>
/.github/  @eadala @<independent-reviewer>
```

### B4. Ongoing reviews

1. Request independent review on PRs into `develop`/`main`
2. Do **not** self-approve as a substitute; do **not** disable required reviews to unblock
3. Prefer **not** using bypass for routine merges

---

## C. Repository merge status

| Item | Status |
|------|--------|
| Gate 5 on develop (`orval@8.47.0`, `proxy-addr@2.0.8`, `express@5.3.0`) | **DONE** |
| #141 governance merged | **DONE** |
| #142 closed superseded | **DONE** |
| #143 admin status docs merged | **DONE** |
| #138–#140 | Still out of scope for this path — do not merge here |
| Coolify production baseline | **DEFERRED** (not a develop engineering blocker) |

---

## D. Path 01 code prerequisites

| Prerequisite | Status |
|--------------|--------|
| Governance + Gate 1/5/7 on develop | **DONE** |
| Gate 5 criticals + full `pnpm audit` | **PASS** (0 known vulns on tip after #156) |
| Independent review capacity | **PENDING** (policy) |
| Frozen RC unchanged | **PASS** |
| Coolify Auto Deploy verified | **DEFERRED / UNVERIFIED** — continue engineering; do not claim production readiness |

---

## E. Coolify operator requirements (deferred)

When production release is scheduled, complete `docs/engineering/COOLIFY_OPERATOR_CHECKLIST.md`:

- Production app identity for `adalahai.com`
- **Deployed commit SHA**
- Watched branch / Auto Deploy / webhooks
- Rollback + PostgreSQL backup/restore evidence

Until then: `COOLIFY_DEPLOYMENT_SAFETY = UNVERIFIED` and **out of the critical path for develop engineering**.

---

## F. Recovery gaps

| Layer | Status |
|-------|--------|
| Git source scripts | Implemented (read-only) |
| Application rollback via Coolify | **UNVERIFIED** (deferred) |
| PostgreSQL backup/restore | **UNVERIFIED** (deferred) |
| Hetzner snapshots | **UNVERIFIED** (deferred) |
| Production baseline tag | **Do not create** without deployed SHA |

---

## G. Sign-off checklist

- [x] Gate 5 remediation on `develop`
- [x] Governance #141 (+ #143/#144) merged; develop All Gates PASS
- [x] Deps audit path complete (#153 high, #155 moderate, #156 low) — tip audit clean
- [ ] Independent reviewer invited and eligible
- [ ] Ruleset targets + rules configured; enforcement authorized
- [ ] Coolify checklist completed (**before production**, not before further develop work)
- [ ] Explicit authorization before merges to `main` / production deploy
