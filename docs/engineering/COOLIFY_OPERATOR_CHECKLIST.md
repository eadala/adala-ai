# Coolify Operator Checklist — Adalah AI

**Audience:** Authorized infrastructure operator only  
**Agents:** Do not modify Coolify. Use this list to request evidence.

## A. Identify production

- [ ] Coolify project / environment name: ________
- [ ] Application name serving **adalahai.com**: ________
- [ ] Confirmed this is production (not staging/demo): ________
- [ ] Git repository connected: `eadala/adala-ai` (yes/no): ________

## B. Deployed baseline

- [ ] Currently deployed Git commit SHA: ________
- [ ] Image digest / build id: ________
- [ ] Deployed at (Asia/Riyadh time): ________
- [ ] Matches a GitHub tag? which?: ________
- [ ] Independent verification method used: Coolify UI / SSH / other: ________

## C. Git integration & Auto Deploy

- [ ] Watched branch: ________ (docs say `main` — confirm live)
- [ ] Auto Deploy: ON / OFF / PAUSED: ________
- [ ] Webhook source (GitHub app / manual): ________
- [ ] Do non-`main` branch pushes deploy? YES/NO/UNKNOWN: ________
- [ ] Do PR merges to non-production bases deploy? YES/NO/UNKNOWN: ________

## D. Controls

- [ ] Manual deploy available: YES/NO
- [ ] Rollback to previous deployment available: YES/NO
- [ ] Last 5 deployments recorded (SHA + time): attached? ________

## E. Data plane

- [ ] Production PostgreSQL identity (host name only, no passwords): ________
- [ ] Separate from any staging DB: YES/NO/UNKNOWN
- [ ] Backup job exists: YES/NO/UNKNOWN
- [ ] Last successful backup time: ________
- [ ] Off-server copy exists: YES/NO/UNKNOWN
- [ ] Restore drill last run: ________ (or NEVER)

## F. Staging isolation (active for trial — do not invent; do not touch production)

Before first trial deploy (see `TRIAL_KICKOFF.md`):

- [ ] Separate Coolify application
- [ ] Separate PostgreSQL database
- [ ] Separate credentials / env vars
- [ ] No production customer data
- [ ] No shared privileged tenant bypass
- [ ] Distinct hostname

## G. Sign-off

| Field | Value |
|-------|--------|
| Operator name | |
| Date (Asia/Riyadh) | |
| Auto Deploy safe for merge window? | YES/NO |
| Evidence attached (screenshots/API redacted) | YES/NO |

Until this checklist is completed, treat `COOLIFY_AUTO_DEPLOY` and `DEPLOYED_SHA` as **UNVERIFIED**.
