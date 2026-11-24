---
name: Adala Clerk proxyUrl — dev vs prod
description: Root cause and fix for Clerk failing to load (blank/infinite loading, or "failed_to_load_clerk_js") in dev preview vs production, caused by the shared VITE_CLERK_PROXY_URL env var
---

# Clerk proxyUrl — Dev vs Production

## The Core Rule (Updated July 2026)

`clerkProxyMiddleware.ts` is **only mounted in production** (`NODE_ENV === "production"` gate) — Clerk's proxy feature requires a stable, pre-verified domain, which dev preview URLs (random `*.pike.replit.dev` per session) can never satisfy.

Therefore the frontend must **never pass a proxyUrl to ClerkProvider in dev** — not even one pointing at a known-good production/replit.app domain, because:
1. It would be cross-origin from the dev preview's own origin, and CSP `script-src` only allows `'self'` + `clerk.accounts.dev` domains — any other origin gets blocked outright.
2. Clerk in dev should just fall back to talking directly to its own Frontend API (`clerk.accounts.dev`), which is already CSP-whitelisted and works with dev-mode (`pk_test_`) keys.

**Canonical pattern in App.tsx:**
```typescript
const clerkProxyUrl = import.meta.env.DEV
  ? undefined  // let Clerk hit clerk.accounts.dev directly, CSP-safe
  : (() => {
      const _rawProxy = import.meta.env.VITE_CLERK_PROXY_URL ?? "/api/__clerk";
      return _rawProxy.startsWith("http") ? _rawProxy : `${window.location.origin}${_rawProxy}`;
    })();
```

**Why:** the "clean" version (`const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL`) that a past iteration of this note recommended is what caused dev breakage — `VITE_CLERK_PROXY_URL` lives in the **shared** env scope, so its value (an absolute production/custom-domain URL) leaks into dev too, and Vite's dev server (unlike the production build) actually inlines env vars, so `import.meta.env.VITE_CLERK_PROXY_URL` is NOT undefined in dev — it resolves to that absolute URL and breaks CSP + Clerk-proxy-domain verification.

## P0 Incident Timeline (July 2026)

1. Production custom domain (adalahai.com) was serving a stale bundle/broken Clerk proxy (400) — traced to the custom domain not being linked/verified in Replit's deployment domain settings (`getDeploymentInfo().additionalUrls` was empty) while the `*.replit.app` URL worked correctly.
2. While investigating, discovered dev preview showed `Clerk: Failed to load Clerk JS ... failed_to_load_clerk_js` for `https://adalahai.com/api/__clerk@6/dist/clerk.browser.js` — because shared env var forced dev to load Clerk JS from the (broken) production domain.
3. Fix: gate `clerkProxyUrl` on `import.meta.env.DEV` so dev always ignores the env var and lets Clerk connect directly; production keeps using the runtime-computed absolute/relative URL logic.

## Diagnosis Path

- If dev preview shows a Clerk script-load error or CSP `Refused to load the script` violation mentioning a non-`clerk.accounts.dev` domain → check if `clerkProxyUrl` is being computed from `VITE_CLERK_PROXY_URL` without a dev/prod gate.
- `getDeploymentInfo().additionalUrls` empty while a custom domain is expected to work → the custom domain was never linked/verified via Replit's Deployments → Custom Domains UI; DNS resolving via Cloudflare with no Replit TXT verification record is corroborating evidence, but final confirmation requires checking the Deployments UI directly (not available via any code-execution API).
