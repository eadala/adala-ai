# Global Readiness Audit — 2026-11-13 (Asia/Riyadh)

## Live baseline (`https://adalahai.com`)

| Check | Result |
|-------|--------|
| HTTPS `/` | 200 + HSTS + CSP + nosniff + SAMEORIGIN |
| `/api/healthz` | healthy |
| SPA routes (`/sign-in`, `/offices`, `/dashboard`) | 200 |
| `/api/status` (pre-fix deploy) | payments reported outage/degraded — Stripe unset |
| `/api/readyz`, `/api/version` | were missing on live tip |

## Code findings → fixes in this change set

| Severity | Finding | Fix |
|----------|---------|-----|
| P0 | `auth.userId` used as office/tenant fallback in messages / client-portal / client-auth / storage | Resolve via `resolveTenantId`; fail closed |
| P1 | WhatsApp webhook accepted unsigned events when secret unset | Fail closed in `NODE_ENV=production` |
| P1 | Moyasar webhook same fail-open | Fail closed in production when office secret missing |
| P1 | WhatsApp HMAC `timingSafeEqual` could throw on length mismatch | Length-safe compare |
| P2 | `/api/status` treated missing Stripe as platform pain; no Moyasar/R2 awareness | Payments optional → degraded; Moyasar/R2 detected |
| P2 | No public readiness/version endpoints | Added `/api/readyz` + `/api/version` |

## Still operator / out-of-scope (not “code done = globally live”)

- Configure Stripe **or** Moyasar live keys + webhooks on production Coolify
- Confirm Clerk **production** instance (not only `*.clerk.accounts.dev`)
- Merge/stack GUC pool containment (`cursor/security-p0-guc-containment-da81`) before claiming strong RLS isolation under pool reuse
- Coolify production baseline SHA / Auto Deploy / backups still **UNVERIFIED**
- Do not merge release stack `#138–#140` without separate authorization

## Verification

```bash
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/api-server run test:tenant-fallback-removal
```
