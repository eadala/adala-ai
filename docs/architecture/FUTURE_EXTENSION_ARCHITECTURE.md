# Future Extension Architecture (constraints only)

This recovery does **not** implement new product modules (alliances, new agents, government APIs).

## Preserve

- Migration-owned schema authority (no Runtime CREATE for new durable tables).  
- `requireAuthWithTenant` + query-level `office_id` as the default API boundary.  
- Clerk as identity; office UUID as tenant key.  
- Stripe webhook idempotency patterns already present.  
- R2 signed-url access model for documents.

## Extension points (later)

| Capability | Suggested attachment |
|------------|---------------------|
| New AI agents | Existing AI gateway + credits (039–042) |
| Document intelligence | Document V2 / storage signed-url |
| Inter-office collaboration | Explicit membership + new policies (not empty-tenant RLS) |
| External APIs | Dedicated OAuth client credentials; never reuse user session |

## Constraint

Any new tenant-owned table must ship with: migration DDL, `office_id`, API tenant filter, and (when ready) RLS policy family — without Runtime DDL at boot.
