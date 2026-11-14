# Independent Remediation Review

**Assurance level:** Internal second-pass by implementing agent (not external auditor).

## Challenges

1. Pool guard resets GUC on release → intentional; means RLS GUC still ineffective across drizzle queries — app WHERE mandatory.  
2. Branding IDOR and role drift remain open.  
3. AI agent `office_id` column assumed present (launchGate checks workflows); if missing in some envs, inserts fail closed.  
4. Moyasar now fails closed without secret — may break misconfigured tenants (correct security tradeoff).  
5. Static tests ≠ live HTTP IDOR proof.

## Bypass attempts considered

- Conflicting path vs tenantId → denied by `requirePathOfficeMatchesTenant`.  
- Body officeId on credits → ignored.  
- Header without membership on trace resolver → denied.  
- Bypass sticky after SA/webhook → release reset.

No additional CRITICAL bypass found in remediated paths during second pass.
