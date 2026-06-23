---
name: Adala Tenant Resolution
description: Why users get 403 from requireAuthWithTenant and how to fix it
---

## The Resolution Chain (tenantMiddleware.ts)

`resolveTenantId` tries 6 steps in order:
1. `x-tenant-id` header
2. Developer impersonation (`developer_impersonation` table)
3. Cache (5 min TTL)
4. `office_members WHERE user_id = userId AND status = 'active'`
5. `users.office_id`
6. `office_registry WHERE clerk_user_id = userId AND status = 'active'`  ← added
7. `trial_offices WHERE user_id = userId`  ← added
8. Returns null → 403

## Root Cause of 403s in Production

The onboarding flow (`trialOnboarding.ts` → `POST /onboarding/setup`) creates:
- `trial_offices` entry with `office_id = trial_${userId.slice(-8)}`
- Optionally creates cases/clients with that office_id
- **NEVER** creates `office_members` entry — that was the bug

After the security hardening sprint removed the first-office fallback, all trial users got 403.

## Self-Healing Pattern

Steps 6 and 7 in `resolveTenantId` auto-heal by running:
```sql
INSERT INTO office_members (office_id, user_id, role, status)
VALUES (${officeId}, ${userId}, 'owner', 'active')
ON CONFLICT DO NOTHING
```
After healing, the user's next request hits step 4 (fast path).

## Key Table Facts

- `users.email` is NOT NULL — never use `INSERT INTO users (id, office_id)`. Use `UPDATE users SET office_id = X WHERE id = Y AND office_id IS NULL`
- `office_members.id` has `DEFAULT gen_random_uuid()` — no need to supply it
- `office_page` has NO `clerk_user_id` column — can't look up by owner there
- `office_registry` has `clerk_user_id` — for offices created via `POST /office/my` (now fixed to insert registry)
- `trial_offices.office_id` = `trial_${userId.slice(-8)}` — TEXT (not UUID)

## Places That Must Create office_members

When any of these create a new office, they MUST also insert into `office_members`:
- `trialOnboarding.ts` `POST /onboarding/setup` ← fixed
- `marketplace/office.ts` `POST /office/my` ← fixed

**Why:** Without office_members, the user gets 403 on all `requireAuthWithTenant` routes forever.
