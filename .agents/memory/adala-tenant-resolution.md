---
name: Adala Tenant Resolution
description: Why users get 403 from requireAuthWithTenant and how the 7-step chain + onboarding fix it
---

## The Resolution Chain (tenantMiddleware.ts → resolveTenantId)

7 steps in order; first match wins:
1. `x-tenant-id` header (validated against office_members; super-admins bypass)
2. Developer impersonation (`developer_impersonation` table)
3. Cache (5 min TTL in-memory Map)
4. `office_members WHERE user_id = userId AND status = 'active'`  ← fast path after heal
5. `users.office_id` column
6. `office_registry WHERE clerk_user_id = userId AND status = 'active'`  ← auto-heals to step 4
7. `trial_offices WHERE user_id = userId`  ← auto-heals to step 4
8. **NEW** `onboarding_state WHERE completed = true`  ← auto-provisions trial office + auto-heals
9. Returns null → 403 with `code: "TNT_403"` + userId + hint in response body

**Why:** Without reaching a non-null tenantId, every `requireAuthWithTenant` route returns 403.

## Root Cause Discovered (June 2026)

`onboarding.ts` PUT `/onboarding/state` stored `office_id = 'default'` (hardcoded literal).
When `completed=true`, it never created:
- `trial_offices` entry
- `office_members` entry

Result: 11 production users who completed onboarding had zero office mapping → 403 on every API call.

**Fix applied:**
1. `onboarding.ts` — when `completed=true`, creates `trial_offices` + `office_members` immediately (awaited, not fire-and-forget)
2. `tenantMiddleware.ts` — added step 8 (onboarding_state fallback) as permanent safety net
3. Bulk healed all 11 orphaned users via SQL CTE in one transaction
4. Both 403 paths now log `[TENANT-403]` with userId, path, method for diagnosis

## Office Provisioning Pattern for Trial Users

All new users get `office_id = trial_${userId.replace(/[^a-zA-Z0-9]/g,'').slice(-8)}`.
No `office_page` entry needed — the `office_members` row is sufficient for tenant resolution.

## Key Table Facts

- `office_members` UNIQUE constraint is `(office_id, user_id)` — use `ON CONFLICT (office_id, user_id) DO NOTHING`
- `trial_offices` UNIQUE constraint is `(user_id)` — one trial per user
- `trial_offices` has NOT NULL fields with defaults: `office_name DEFAULT ''`, `specialty DEFAULT ''`, `office_size DEFAULT 'solo'`
- `users.email` is NOT NULL — never `INSERT INTO users (id)`. Use `UPDATE users SET office_id WHERE id = Y AND office_id IS NULL`
- `office_page.id` is `uuid` type; `office_members.office_id` is `text` — they don't have a FK relationship

## Places That Must Create office_members on Office Creation

- `onboarding.ts` `PUT /onboarding/state` when `completed=true` ← FIXED
- `marketplace/office.ts` `POST /office/my` ← was fixed in earlier sprint
- Any future "create office" route must also insert into `office_members`

**Why:** Without office_members the user hits 403 on every protected route forever.
