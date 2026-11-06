# Tenant Authorization Coverage Matrix (initial)

**SHA focus:** recovery branch tip  
**Method:** Code inspection of middleware + SQL scope; not exhaustive of every route  
**Legend:** OK | WEAK | FAIL | N/A | UNKNOWN

## Critical paths (recovery priority)

| Resource | Endpoint | Auth MW | Tenant resolve | Query scope | RLS reliance | Test | Status |
|----------|----------|---------|----------------|-------------|--------------|------|--------|
| Notifications aggregate | GET `/api/notifications` | `requireAuthWithTenant` | `req.tenantId` | `office_id` / employee join; omit invitations/messages | Defense only | `test:notifications-tenant` | OK |
| Plan notifications | GET `/office/plan-notifications` | `requireAuthWithTenant` | `req.tenantId` | `office_id` | Defense only | same | OK |
| Plan notif mark-all | PATCH `/office/plan-notifications/read-all` | `requireAuthWithTenant` | `req.tenantId` | `WHERE office_id` | Defense only | same | OK |
| Invitations list | GET `/rbac/invitations` | `requireAuthWithTenant` | trusted tenantId | `office_id` (+ NULL/`invited_by` transitional) | N/A until RLS on invitations | `test:rbac-invitations` + `test:invitations-058` | OK (after 058) |
| Mediator stats | GET `/mediators/stats` | `requireSuperAdmin` | SA only | Global COUNT intentional | N/A | contract | OK |
| Storage signed-url | GET `/api/storage/files/:id/signed-url` | `requireAuthWithTenant` | office | Prior verification | Defense | `test:storage-signed-open` | OK (no reopen) |
| Stripe webhook | POST `/api/stripe/webhook` | Signature (not user auth) | N/A | Event-driven | N/A | Code present | UNKNOWN live |
| HEAL | POST `/internal/heal` | `HEAL_SECRET` Bearer | N/A | Ops | N/A | `test:stage9-security` | OK fail-closed |

## Flagged for continued inventory (not all FAIL)

Routes still using `requireAuth` without proven tenant scope exist across marketplace, legal-core AI helpers, entitlements, login tracking, etc. Each must be classified before claiming full INV-001 coverage. See RCA systemic failure mode.

## Gaps blocking “full GO”

1. Live two-office E2E for notifications/documents/AI credits.  
2. `invitations.office_id` durable ownership.  
3. Exhaustive matrix for remaining `requireAuth` + tenant tables.  
4. Prod RLS role verification.
