# Trial Launch Runbook — Adalah AI

**Goal:** Simple, controlled **trial** (not full production launch).  
**Audience:** Platform engineer + Coolify operator + product owner.  
**Hard rules:** No production Auto Deploy changes from agents. No customer production data in trial. No Live Stripe.

## 0. Identity snapshot (fill at kickoff)

| Field | Value |
|-------|--------|
| Trial code base (Git SHA) | ________ (start from current `develop` tip) |
| Tree (optional) | `./scripts/release/verify-release.sh <sha>` |
| Frozen RC (immutable reference) | `5441523302a1513f07b5dc08f028d848a0bad5b4` / tree `cd84a7f…` |
| Trial hostname | e.g. `trial.adalahai.com` |
| Coolify app name (staging only) | ________ |
| Owner sign-off | ________ |
| Date (Asia/Riyadh) | ________ |

## 1. Scope (keep tiny)

**In for v0 trial**

- Auth (Clerk test)
- Create/open office
- Create one case (or core legal entity used in your demo path)
- Upload one small document
- Basic navigation without 500s

**Out for v0 trial**

- Live payments / production Stripe
- Broad public signup
- Merging release stack `#138–#140` unless separately authorized
- Production `adalahai.com` deploy

## 2. Engineering preflight (repo)

```bash
git fetch origin develop
git checkout -B release/trial-$(date +%Y%m%d) origin/develop
./scripts/release/trial-preflight.sh
./scripts/release/verify-release.sh HEAD
```

Pass criteria: preflight exits **0**, CI on the release PR (if any) All Gates PASS.

## 3. Staging isolation (Coolify operator)

Use `COOLIFY_OPERATOR_CHECKLIST.md` §F plus:

- [ ] Separate Coolify **application** (not production)
- [ ] Separate PostgreSQL
- [ ] Separate env secrets (Clerk test, no prod keys)
- [ ] Watched Git branch = trial release branch or `develop` (**not** assumed production `main`)
- [ ] Auto Deploy ON for **staging only**
- [ ] Production Auto Deploy untouched / confirmed still on intended branch
- [ ] Deployed SHA recorded: ________

## 4. First deploy

1. Push trial branch (or merge kit to `develop` then deploy staging from agreed ref).
2. Operator triggers deploy (or staging Auto Deploy).
3. Record deployed SHA from Coolify UI.
4. Confirm SHA matches intended Git ref:
   ```bash
   ./scripts/release/verify-release.sh <deployed-sha>
   ```

## 5. Smoke test

Execute `TRIAL_SMOKE_TEST.md` end-to-end.  
**Go / No-Go:** all Critical rows PASS.

## 6. Invite policy

- [ ] Named testers only (list): ________
- [ ] No marketing blast
- [ ] Feedback channel (WhatsApp/sheet): ________
- [ ] Trial window: ________ → ________ (Asia/Riyadh)

## 7. During trial (24–48h)

- Watch Coolify logs for 5xx spikes
- One owner on-call for blockers
- Fix only **P0** via small PRs → `develop` → redeploy **staging**
- Do not expand scope mid-trial

## 8. Exit criteria

| Outcome | Action |
|---------|--------|
| Smoke + 48h stable | Plan production path separately (baseline verify + backups) |
| Critical smoke fail | Stop invites; fix; re-run smoke |
| Partial | Shrink scope; new trial window |

## 9. Explicit non-claims

Until Coolify **production** checklist is filled with evidence:

- Do **not** claim `adalahai.com` runs this SHA
- Do **not** create production baseline tags from guesswork
- Trial success ≠ production readiness
