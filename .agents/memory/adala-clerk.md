---
name: Adala Clerk Auth setup
description: Clerk Auth routing and protected route structure for عدالة AI
---

Clerk is provisioned and working (development keys active).

**Route structure:**
- `/` → Landing page (public, unauthenticated users see marketing page)
- `/dashboard` → Protected (redirects to `/` if signed out)
- `/sign-in/*?` and `/sign-up/*?` → Clerk auth pages (branded navy/gold)
- All `/cases`, `/documents`, `/ai-tasks`, `/ai-chat`, `/users`, `/messages`, `/billing` → Protected

**Why:** Home route must be public per Clerk skill requirements. Authenticated users auto-redirect to `/dashboard`.

**How to apply:** Use `<ProtectedRoute>` wrapper in App.tsx for auth-gated pages. Use `<Show when="signed-in/out">` from `@clerk/react` for conditional rendering.

## CRITICAL — Clerk Proxy URL

`clerkProxyUrl` in App.tsx MUST be:
```typescript
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
```

**Why:** `VITE_CLERK_PROXY_URL` is **empty in dev** (intentional — Clerk hits dev FAPI directly) and **auto-populated by Replit at publish time**. Any manual fallback like `|| window.location.origin + /api/__clerk` causes the published app to use a wrong proxy URL that routes the Clerk JS bundle to `frontend-api.clerk.dev/npm/...` which returns 404 and breaks auth entirely.

**How to apply:** Never add a `||` fallback to `clerkProxyUrl`. Never gate it on `NODE_ENV`. The empty dev value is intentional per the Clerk skill canonical pattern.
