# GitHub Admin Closure — Governance & Gate 5 Status

**Audience:** Repository administrator (`eadala`) and Coolify operator  
**Agent scope:** Documentation only — this file does **not** change live GitHub/Coolify settings.  
**Frozen RC (immutable):** `5441523302a1513f07b5dc08f028d848a0bad5b4` / tree `cd84a7f277c481dc5c96d707dde4e78d7f18e713`

## Status snapshot (2026-11-13)

| Item | Status |
|------|--------|
| Governance [#141](https://github.com/eadala/adala-ai/pull/141) | **MERGED** into `develop` (`fbfa5567…`) |
| Gate 5 deps [#142](https://github.com/eadala/adala-ai/pull/142) | **CLOSED unmerged** — content already on `develop` via `29ad4d2f` (`orval@8.47.0`, `express@5.3.0`, `proxy-addr@2.0.8`) |
| Develop tip CI | **All Gates PASS** including Gate 5 (run `43421944825` on `fbfa5567…`) |
| Local critical audit on tip | **0 critical** |
| Replacement deps PR | **Not required** — zero package/lockfile delta vs closed #142 tip |
| Status-doc follow-up | This file updated on tip for admin handoff |
| Ruleset / independent reviewer / Coolify | Still **admin-pending** — **NEXT** |
| Independent reviewer (B) | **PENDING** — invite Write collaborator |
| Ruleset activation (A) | Prepare targets/rules in **Evaluate/Disabled**; Active only after B |

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

Apply to **both** `refs/heads/main` and `refs/heads/develop` (or use separate rulesets if check names differ):

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
| Required checks (exact names) | `✅ All Gates Passed` on `develop`; confirm `main` check names before requiring there |
| Require branches to be up to date | Optional while tip stays green |
| Require conversation resolution before merging | On (recommended) |
| Allow force pushes / deletions | Off |
| Bypass list | Empty for routine work; break-glass only with written policy |

### A3. Safe activation sequence

1. Confirm develop tip still has Gate 5 PASS (already true at `fbfa5567…`).
2. Complete independent reviewer invite (B).
3. Set target refs + rules while still **disabled** / Evaluate.
4. Verify a throwaway docs PR is blocked without review + checks.
5. Set enforcement **Active** on `develop`, then `main` (or separate rulesets).
6. Record break-glass bypass owners outside the repo if needed.

### A4. Verification commands

```bash
gh api repos/eadala/adala-ai/rulesets/17934003 \
  --jq '{name,enforcement,include:.conditions.ref_name.include,rules:[.rules[].type]}'
gh api repos/eadala/adala-ai/collaborators --jq '.[].login'
pnpm audit --audit-level=critical  # expect 0 lines containing "critical"
```

---

## B. Independent reviewer procedure (exact)

**Problem:** Collaborators API lists only `@eadala`. Author cannot satisfy independent approval for their own PR when approvals are required.

### B1. Invite

1. GitHub → `eadala/adala-ai` → **Settings** → **Collaborators and teams** → **Add people**
2. Invite a trusted human reviewer (separate identity; not an alt controlled by the PR author)
3. Permission: **Write** (minimum to approve PRs; **Maintain** only if they must manage settings)

### B2. Verify acceptance

```bash
gh api repos/eadala/adala-ai/invitations
gh api repos/eadala/adala-ai/collaborators --jq '.[].login'
```

### B3. CODEOWNERS

Current: `.github/CODEOWNERS` → `* @eadala`

Minimum sustainable update (via PR):

```text
*       @eadala @<independent-reviewer>
/.github/  @eadala @<independent-reviewer>
```

Or a GitHub team `@<org>/adala-reviewers` with ≥2 members.

**Do not:** fabricate approvals, use alt accounts to simulate independence, or disable required reviews merely to unblock.

---

## C. Repository merge status

| PR | Outcome |
|----|---------|
| #141 governance | Merged to `develop` |
| #142 Gate 5 deps | Closed; commits already on `develop` (`29ad4d2f`, `d237a575`) — **do not reopen** unless tip regresses |
| #138–#140 | Still out of scope — do not merge as part of this work |

Do **not** deploy from these merges without Coolify verification (E).

---

## D. Gate 5 engineering proof (on develop tip)

| Check | Result |
|-------|--------|
| `orval` | lockfile `8.47.0` (`lib/api-spec` direct devDependency) |
| `express` | `^5.3.0` → `5.3.0` |
| `proxy-addr` | override `>=2.0.8` → `2.0.8` |
| `pnpm install --frozen-lockfile` | PASS |
| Critical audit | **0 critical** |
| Develop CI All Gates | **PASS** |

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

- [x] Gate 5 criticals remediated on `develop`
- [x] Governance #141 merged
- [ ] Independent reviewer invited and eligible
- [ ] Ruleset targets + rules configured; enforcement authorized
- [ ] Coolify checklist completed
- [ ] Explicit authorization before any production deploy / `main` release
