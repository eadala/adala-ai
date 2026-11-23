---
name: Adala production blank page fix
description: publishableKeyFromHost throws on .replit.app — fix for Clerk blank screen in production
---

## The Problem
`publishableKeyFromHost` from `@clerk/react/internal` throws an exception when called with `.replit.app` production hostname. Even when caught by try/catch, the throw happens AFTER partially mutating Clerk's internal singleton state, leaving it corrupted.

This cascades:
1. Corrupted Clerk singleton → ClerkProvider fails to initialize
2. `useClerk()` in `ClerkQueryClientCacheInvalidator` returns undefined
3. Destructuring `{ addListener } = undefined` → TypeError at render time
4. No ErrorBoundary → entire React tree unmounts → dark navy `#root` background only (blank page)

**Why:** Visible in the production bundle as `publishableKeyFromHost failed:",t),ut="pk_live_..."` — the catch block fires but corruption already happened.

## The Fix (all 3 required)

1. **Remove `publishableKeyFromHost` entirely** — use env var directly:
   ```js
   const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ?? "";
   ```

2. **Guard `useClerk()` with optional chaining** in ClerkQueryClientCacheInvalidator:
   ```js
   const clerk = useClerk();
   if (!clerk?.addListener) return;
   ```

3. **Add `AppErrorBoundary`** class component wrapping `App()` — shows Arabic error message + reload button instead of blank screen.

## Keep Absolute proxyUrl
Also keep the absolute proxyUrl expansion (was already fixed before this):
```js
const _rawProxy = import.meta.env.VITE_CLERK_PROXY_URL;
const clerkProxyUrl = _rawProxy?.startsWith("/")
  ? `${window.location.origin}${_rawProxy}`
  : _rawProxy ?? undefined;
```

**Why:** Clerk v6 requires absolute URL for proxyUrl prop, Replit sets VITE_CLERK_PROXY_URL as relative `/api/__clerk`.

## Never use publishableKeyFromHost for .replit.app deployments
The function is from `@clerk/react/internal` and is designed for multi-domain Replit setups. For single-domain `.replit.app` deployments with proxyUrl, it is unnecessary and harmful.
