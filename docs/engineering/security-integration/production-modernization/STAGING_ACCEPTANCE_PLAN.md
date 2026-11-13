# Staging Acceptance Plan

## Isolation requirements

- Separate Coolify app (not production)
- Separate PostgreSQL
- Test Stripe/Moyasar keys only
- Synthetic tenants only
- No production webhooks / Clerk production hijack
- Explicit deploy approval per promote

**Do not create staging without authorization.**

## Acceptance tests (minimum)

1. Auth: Clerk sign-in; tenant resolution fail-closed  
2. Office create / membership  
3. Case CRUD isolation Office A vs B  
4. Documents upload/list scoped  
5. AI case-brief contract counts exact per office  
6. Autopilot task create + context fetch scoped  
7. Collection payment stamps `revenues.office_id`  
8. Payments health: configured test gateway → not outage  
9. JLWM seed does not run when `NODE_ENV=production` without allow flag  
10. Backup job dry-run metadata (staging DB)  
11. Monitoring `/api/health` + `/api/status`  
12. WWW/apex both route to staging host  

## Gate mapping

Staging PASS required before G12; does not authorize production.
