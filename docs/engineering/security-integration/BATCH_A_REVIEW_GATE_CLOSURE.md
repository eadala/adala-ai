# Batch A Review Gate Closure

Evidence: 2026-11-13 (Asia/Riyadh). **No approvals, merges, or deploys performed.**

## Status

| Gate | Result |
|---|---|
| Required CI green on pinned SHAs | **PASS** (all five) |
| Heads unchanged vs prior gate | **PASS** |
| Auto-merge disabled on all Batch A | **FAIL** — #164 has Auto-merge enabled |
| Independent review present | **FAIL** — zero reviews; `REVIEW_REQUIRED` |
| Ready to merge | **NO** |

## Review / merge readiness matrix

| PR | Head SHA (pinned) | Base | CI | Auto-merge | Reviews | Review requests | Merge state | Review-ready | Merge-ready |
|---|---|---|---|---|---|---|---|---|---|
| #164 | `094636ad0e3edc47f8556d12ce12e7d131a9ac79` | develop | SUCCESS×12 | **ON** (SQUASH by `cursor` @ 2026-11-13T17:44:17Z) | 0 | 0 | BLOCKED | **NO** — disable auto-merge + get independent approve | NO |
| #166 | `c62b7f5f66a1d5efb28425038d0ccf1c1b997b24` | develop | SUCCESS×12 | Off | 0 | 0 | BLOCKED | **NO** — need independent approve | NO |
| #167 | `eaf9fc7946f1420f1f5a7ac667318837122f8410` | develop | SUCCESS×12 | Off | 0 | 0 | BLOCKED | **NO** — need independent approve | NO |
| #168 | `6a9de7d40789905dbb0e393518c71df017650a38` | develop | SUCCESS×12 | Off | 0 | 0 | BLOCKED | **NO** — need independent approve | NO |
| #169 | `a8a575ca10e7886e9db65466c3178545862b2891` | develop | SUCCESS×12 | Off | 0 | 0 | BLOCKED | **NO** — need independent approve | NO |

`origin/develop` at check: `d2bd14d9262054a6948607a5bdfd8eb0c524a446`.

## Effective protection (VERIFIED / PARTIAL)

| Control | Evidence | Notes |
|---|---|---|
| `develop` protected | VERIFIED `protected:true` | |
| Required status checks | VERIFIED (non_admins): Gate 1 TypeScript, Gate 2 ESLint, Gate 3 Build & Bundle Budget, Gate 4 Security Scan | Full REST protection detail API **403** to this token |
| Review required | VERIFIED via PR `reviewDecision=REVIEW_REQUIRED` / `mergeStateStatus=BLOCKED` | Exact required-approver count **UNVERIFIED** (GraphQL protection nodes unavailable to token) |
| Ruleset `adalah-ai` (17934003) | VERIFIED `enforcement:disabled`; rules: deletion + non_fast_forward only; empty ref include | Not the active review enforcer |
| Repo `allow_auto_merge` | VERIFIED `true` | Enables per-PR auto-merge |
| CODEOWNERS | VERIFIED `.github/CODEOWNERS` → `* @eadala` (and path owners all `@eadala`) | PR author on Batch A is also `@eadala` — **author ≡ code owner** |
| Collaborators with admin | VERIFIED only `@eadala` | No second human collaborator visible to API |

## Administrator action list (exact)

Execute in order. Do **not** merge until steps 1–5 complete and reviews approve.

1. **Disable Auto-merge on #164**  
   GitHub → PR #164 → disable Auto-merge (currently SQUASH, enabled by `cursor`).  
   Leave #166–#169 without Auto-merge.

2. **Invite an independent technical reviewer** (not `@eadala` as sole approver of own PRs)  
   - Settings → Collaborators → Invite with **Write** (or higher) **or** add as org member with PR review rights.  
   - Candidate must be able to: view private/public repo code, submit `APPROVED`/`CHANGES_REQUESTED` reviews, and must **not** be the PR author bot/account that authored the commits under review if policy forbids self-approval.  
   - Because CODEOWNERS is only `@eadala` and author is `@eadala`, self-approval does **not** satisfy “independent” review for this program even if GitHub would accept it.

3. **(Recommended) Temporary CODEOWNERS dual-ownership for Batch A paths**  
   Add the independent reviewer alongside `@eadala` for:
   - `/artifacts/api-server/src/`
   - `/artifacts/adala/src/`  
   Or request reviews manually without CODEOWNERS change (step 4). Prefer manual request if you want zero repo config churn.

4. **Request review on each PR** from the independent reviewer  
   - #164, #166, #167, #168, #169 — one request each.  
   - Attach the checklist below (or link this doc).

5. **Wait for non-author `APPROVED` reviews** clearing `REVIEW_REQUIRED` / `BLOCKED`.  
   Agent/automation must **not** approve on behalf of the reviewer.

6. **Before each merge into `develop`:** fresh validation (mandatory)  
   - Confirm head SHA still equals the pinned SHA above (or re-run CI + re-review if SHA moved).  
   - `gh pr view <n> --json headRefOid,mergeable,mergeStateStatus,reviewDecision,statusCheckRollup,autoMergeRequest`  
   - Rebase/merge-check against **current** `origin/develop` (after prior Batch A merges, develop advances — re-validate remaining PRs).  
   - Confirm Auto-merge still off.  
   - Then human merges in sequence only.

7. **Proposed merge sequence (unchanged)**  
   `#164 → #166 → #167 → #168 → #169`  
   After each merge: refresh remaining PRs against updated `develop` before the next merge recommendation.

8. **Do not** enable Auto-merge, bypass protection, force-push, or deploy via Coolify as part of this gate.

## Independent reviewer checklist (concise)

### Global (every Batch A PR)

- [ ] Tenant identity from server auth only (`req.tenantId` / `requireAuthWithTenant`); no client-supplied office inventing.
- [ ] Missing/invalid tenant → fail-closed (403/401); no `"default"` / `"platform"` office fallback on write paths.
- [ ] No cross-office read/write introduced in the diff.
- [ ] Authorization unchanged or tightened (no fail-open).
- [ ] Required CI still green on the pinned head SHA.
- [ ] Diff matches stated purpose; no unrelated drive-by changes.
- [ ] Tests in PR (or existing guards) cover the fail-closed behavior touched.

### PR-specific

| PR | Focus |
|---|---|
| #164 | Stripe webhooks / AI credits / loginTracking / internal-messages: removal of `"default"` office seed & lookups; SPA auth fetch touchpoints |
| #166 | Marketplace/portal IDOR (`canAccessOffice`); email cron must not use synthetic default SMTP row; invoice office filters |
| #167 | Branding/theme/onboarding: reject inventing `default` office on complete; no query `tenantId` trust |
| #168 | Document templates / workflow / managed integrations: drop `OR office_id='default'` read paths; fail-closed tid |
| #169 | Entitlements stop returning `"default"`; support-enterprise stamps `office_id`; trialOnboarding refuses default/platform |

### Explicit non-goals for this review pass

- Full platform RLS/pool adversarial suite (tracked separately).
- Merging #139 / #183 / #185.
- Production deploy.

## Post-review merge protocol

1. Reviewer submits **Approve** on PR N at pinned SHA.  
2. Release engineer re-fetches: CI green, mergeable, auto-merge off, SHA unchanged (or re-approved if changed).  
3. Merge PR N into `develop` (squash/merge per repo preference; human only).  
4. `git fetch origin develop` → re-check PR N+1 mergeability vs new develop tip.  
5. Repeat until #169 lands.  
6. Only then consider follow-on remediations (#185, #183, docs #184).

## Agent constraints honored

- Did not approve PRs.  
- Did not merge, bypass protection, modify Coolify/Hetzner, or deploy.  
- Did not disable #164 Auto-merge (requires human/admin UI or write token) — listed as admin action #1.
