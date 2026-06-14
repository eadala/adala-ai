---
name: Adala Clerk proxyUrl production blank page
description: Root cause and fix for production blank page caused by relative Clerk proxyUrl
---

# Clerk proxyUrl Must Be Absolute in Production

## The Rule
`VITE_CLERK_PROXY_URL` is set by Replit to a RELATIVE path `/api/__clerk`, but Clerk v6 requires an **absolute** URL (`https://domain/api/__clerk`) for the proxy to work correctly.

**Why:** Clerk's internal URL construction uses the proxyUrl as a base. When it's relative, URL resolution fails silently → ClerkProvider fails to initialize → blank page.

**How to apply:** In App.tsx, always expand relative proxyUrl to absolute at runtime:

```js
const _rawProxy = import.meta.env.VITE_CLERK_PROXY_URL;
const clerkProxyUrl = _rawProxy
  ? _rawProxy.startsWith("/")
    ? `${window.location.origin}${_rawProxy}`
    : _rawProxy
  : undefined;
```

This produces `https://legal-platform--ahkm1000.replit.app/api/__clerk` in production (Vite tree-shakes the startsWith check at build time since the value is a constant).

## Diagnosis Path
- Dev works (no proxy, no VITE_CLERK_PROXY_URL in dev)
- Prod: all chunks 200, API 200, Clerk proxy curl 200, but page blank white
- Production bundle had `const jl="/api/__clerk"` (relative) as proxyUrl
- Clerk v6.7.2→6.9.1 update also helps fix SDK-level relative URL handling
- The troubleshoot.md confirms expected proxy URL is `https://<app_domain>/api/__clerk`

## Also Fixed
- Upgrade @clerk/react 6.7.2 → 6.9.1 (fixes SDK-level proxy URL issues)
- Landing eagerly imported (not lazy) so it renders before Clerk initializes
