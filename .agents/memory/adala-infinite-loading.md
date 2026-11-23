---
name: Adala Infinite Loading Fix
description: Root cause and fix for "جاري التحميل" infinite loading screen on adalahai.com production
---

## The rule

Two changes are needed to prevent infinite loading on the production custom domain:

1. `app.ts` MUST have a `/api/healthz` route (returns 200 immediately, before all middleware)
2. All 4 route wrappers in `App.tsx` must use `useClerkTimeout(12s)` to redirect to `/` if Clerk never initializes

**Why:**
- `artifact.toml` `[services.production.health.startup]` specifies `path = "/api/healthz"` — if this 404s, the startup health check fails and Replit may not route traffic correctly to the new deployment
- On Neon cold starts or after redeployment, the API server (which proxies Clerk's `/api/__clerk/*`) takes a few seconds to become healthy. During this window, Clerk's `isLoaded` stays `false` and every protected route shows PageLoader forever
- The `useClerkTimeout` hook starts a 12-second timer when `isLoaded=false`; on expiry, redirects the user to `/` (Landing) — prevents "infinite" from actually being infinite

**How to apply:**
- After any changes to `app.ts`, verify it has `app.get("/api/healthz", ...)` as one of the first 3 routes (before any middleware)
- The `useClerkTimeout` hook is defined in `App.tsx` near `PageLoader`; all 4 wrappers call it: `AdminRoute`, `WorkspaceRoute`, `ProtectedRoute`, `RoleRoute`

## Investigation findings

- Clerk DID initialize correctly in production (logs show 200 on `/api/__clerk/v1/environment` and `/api/__clerk/v1/client`)
- All API calls returning 403 = pre-existing tenant resolution issue (separate bug, not the loading screen cause)
- JS errors in DB (billing.tsx TDZ, pricing lazy-load failure) were from dev environment, not production
- Server binds to port quickly (<2s); the 258-second gap before first real request was just absence of traffic
- The "infinite" loading was caused specifically by: healthcheck path mismatch → delayed deployment health + no client-side escape hatch
