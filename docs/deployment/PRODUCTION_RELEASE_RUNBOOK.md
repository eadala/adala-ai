# Production Release Runbook

**Status:** PLAN ONLY — no deploy without explicit human approval (INV-009).

## Release candidate identification

1. Merge PR #138 only when Gate 1 TypeScript is green and required checks agreed.  
2. Record exact merge commit SHA on `main` as **release SHA**.  
3. Until then, recovery tip SHA is the candidate under test.

## Pre-deploy checklist

- [ ] CI: Tests suite PASS  
- [ ] CI: Gate 1 TypeScript PASS  
- [ ] CI: Gate 5 Dependency Audit triage complete (accept risk or upgrade)  
- [ ] CI: DB Migrations job PASS  
- [ ] Production backup taken + restore drill evidenced  
- [ ] Migrations 053–057 confirmed applied or apply plan approved  
- [ ] Secrets verified in Coolify (Clerk live, Stripe live + webhook URL `/api/stripe/webhook`, Gemini, R2, `HEAL_SECRET`)  
- [ ] Explicit human deploy approval recorded  

## Deployment sequence

1. Backup  
2. Migrations (if any pending) — approved operator only  
3. Deploy API + frontend from release SHA via Coolify  
4. Health: `GET /api/healthz`  
5. Smoke: login, Office A/B notification isolation, signed-url, AI chat, Stripe test webhook health  

## Rollback

1. Redeploy previous Coolify image/tag  
2. Do not reverse 053–057 without DBA forward-fix plan  
3. Disable checkout if payment path regresses  

## Decision log

| Field | Value |
|-------|--------|
| Current verdict | **CONDITIONAL GO** |
| Deploy executed by agent | **No** |
