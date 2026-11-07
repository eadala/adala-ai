# RLS Migration Plan — 059 Fail-Closed

## Order

1. Deploy application build that includes fail-closed GUC helpers + SA/webhook bypass (**before or with** DB).  
2. Backup production.  
3. Run `scripts/db/preflight-migration-059.sql` (SELECT-only).  
4. Apply `059_rls_fail_closed_empty_tenant.sql` with approval.  
5. Post-check: `pg_policies` for `rls_%` should show `nullif` + `bypass_rls`, no empty `coalesce` privilege.  
6. Smoke: office login, notifications, SA dashboard, Stripe test webhook.

## Compatibility

- vault/zta (056): **not** modified — still fail-open until follow-up.  
- No FORCE RLS.  
- Idempotent replace of known fail-open `rls_*` only; incompatible quals **BLOCK**.

## Rollback

Restore prior policy definitions from backup; redeploy previous app if needed.

## Human approval required

Production apply — **yes**. Agent will not apply.
