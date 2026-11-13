# Apply ruleset `adalah-ai` (Path 01 admin)

**Audience:** Repository admin (`eadala`)  
**Agent scope:** Documentation only — Cursor cannot mutate rulesets (`403 Resource not accessible by integration`).  
**Ruleset:** `adalah-ai` · id `17934003`  
**UI:** https://github.com/eadala/adala-ai/settings/rules/17934003  
**Public rules page:** https://github.com/eadala/adala-ai/rules/17934003  

Current API-observed baseline (must change):

| Field | Observed | Target |
|-------|----------|--------|
| `enforcement` | `disabled` | `evaluate` first, then `active` after reviewer exists |
| `conditions.ref_name.include` | `[]` | `refs/heads/develop`, `refs/heads/main` |
| `rules` | `deletion`, `non_fast_forward` | Expand per §2 |

Prerequisite: invite an independent **Write** collaborator first  
→ https://github.com/eadala/adala-ai/settings/access  

---

## 1. Targets

In the ruleset editor:

1. Open **Target branches** (or equivalent “ref name” condition).
2. Include:
   - `refs/heads/develop`
   - `refs/heads/main`
3. Leave exclude empty unless you have a documented exception branch.

---

## 2. Rules to add (keep existing deletion / non_fast_forward)

Add these while enforcement is still **Disabled** or **Evaluate**:

| Rule | Setting |
|------|---------|
| Restrict deletions | On (already present) |
| Block force pushes | On (already present as `non_fast_forward`) |
| Require a pull request before merging | On |
| Required approving review count | `1` |
| Dismiss stale pull request approvals when new commits are pushed | On |
| Require review from Code Owners | On **only after** CODEOWNERS lists a non-author reviewer |
| Require approval of the most recent reviewable push | On (recommended) |
| Require status checks to pass | On |
| Required checks | Exact name: `✅ All Gates Passed` |
| Require conversation resolution before merging | On (recommended) |
| Allow force pushes / deletions bypass | Off for everyone |

**Compatibility:** Prefer requiring `✅ All Gates Passed` on `develop` first. Confirm `main` emits the same check job name before enforcing it there, or use separate rulesets per branch.

---

## 3. Enforcement sequence (safe)

1. Save rules + targets with enforcement **Disabled** or **Evaluate**.
2. Confirm independent Write collaborator accepted the invite.
3. Open a tiny docs PR into `develop` and confirm it is blocked without approval + failing/missing required check when intended.
4. Set enforcement **Active** on the ruleset (or activate develop first if split).
5. Re-run:

```bash
./scripts/release/verify-path01-admin.sh
```

Expect: `RESULT: PATH01_ADMIN_READY`.

---

## 4. What Cursor will verify after you save

```bash
gh api repos/eadala/adala-ai/rulesets/17934003 \
  --jq '{name,enforcement,include:.conditions.ref_name.include,rules:[.rules[].type]}'
gh api repos/eadala/adala-ai/collaborators --jq '.[].login'
./scripts/release/verify-path01-admin.sh
```

Do **not** use bypass for routine merges after Active. Coolify production baseline remains **DEFERRED** and is out of this ruleset step.
