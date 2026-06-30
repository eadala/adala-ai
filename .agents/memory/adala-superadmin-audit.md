---
name: Adala Super-Admin isSuperAdmin Unification
description: Audit + fix of 9 different isSuperAdmin implementations across the codebase — all replaced with a single canonical exported function.
---

## The Rule
`checkIsSuperAdmin(userId)` and `requireSuperAdmin` (middleware) in `requireAuth.ts` are the ONLY valid SA verification. Never write a local isSuperAdmin in a route file.

**Why:** Found 9 different implementations — 4 were SYNC (read stale JWT), 3 used `VITE_SUPER_ADMIN_EMAILS` (frontend-only env var ignored on server), 2 queried local DB users table (stale vs Clerk). A revoked SA could retain access for the full JWT lifetime (~1h) via the SYNC implementations.

## How to Apply
```typescript
import { requireSuperAdmin } from "../../middlewares/requireAuth";
// Use as route middleware:
router.get("/admin/something", requireSuperAdmin, handler);
// Or for programmatic check:
import { checkIsSuperAdmin } from "../../middlewares/requireAuth";
const ok = await checkIsSuperAdmin(userId);
```

## Canonical Logic
- Always async → always fresh Clerk API call (never JWT session claims)
- Reads `SUPER_ADMIN_EMAILS` (comma-separated) || `PLATFORM_OWNER_EMAIL` (legacy single)
- Also allows `publicMetadata.role === "super_admin"` (Clerk-set role)
- Case-insensitive email comparison

## Files Fixed (previously buggy)
| File | Old Bug | Fix |
|------|---------|-----|
| `saas-os.ts` | SYNC JWT + `VITE_SUPER_ADMIN_EMAILS` | → `requireSuperAdmin` |
| `production-os.ts` | SYNC JWT + `VITE_SUPER_ADMIN_EMAILS` | → `requireSuperAdmin` |
| `stripeAdmin.ts` | SYNC JWT + `VITE_SUPER_ADMIN_EMAILS` | → `requireSuperAdmin` |
| `financial-engine.ts` | SYNC, role-only (no email fallback) | → `requireSuperAdmin` |
| `control-tower.ts` | Only `PLATFORM_OWNER_EMAIL` (not email list) | → `requireSuperAdmin` |
| `promo.ts` | Only `PLATFORM_OWNER_EMAIL`; if not set → always false | → `requireSuperAdmin` |
| `aiCredits.ts` | DB users table query (stale) + `VITE_` env | → `requireSuperAdmin` |
| `aiProviderEngine.ts` | DB users table query (stale) + `VITE_` env | → `requireSuperAdmin` |
| `billing.ts` | SYNC JWT + `VITE_SUPER_ADMIN_EMAILS` | → `requireSuperAdmin` |

## Audit Logging Added
`POST /developer/platform-admins` (GRANT_SUPER_ADMIN) and `DELETE /developer/platform-admins/:userId` (REVOKE_SUPER_ADMIN) now insert to `audit_logs` with `office_id='platform'`.

## Developer Role Note
`role === "developer"` in Clerk metadata has NO separate backend guards anywhere — treated identically to `super_admin` at API level (devOnly guard = isSuperAdmin check). This is intentional design: developer accounts are created by a super admin and trusted.

## VITE_SUPER_ADMIN_EMAILS Warning
This env var is for the frontend (use-role.ts hook) only. On the server, only `SUPER_ADMIN_EMAILS` or `PLATFORM_OWNER_EMAIL` are read. Do NOT add `VITE_` prefix to server-side env checks.
