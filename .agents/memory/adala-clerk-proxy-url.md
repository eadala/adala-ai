---
name: Adala Clerk proxyUrl production blank page
description: Root cause and fix for production blank page/infinite loading caused by missing or misconfigured VITE_CLERK_PROXY_URL
---

# Clerk proxyUrl — Production Infinite Loading Fix

## The Core Rule (Updated July 2026)

`VITE_CLERK_PROXY_URL` is **NOT auto-provisioned** by `setupClerkWhitelabelAuth()`. It must be set manually as a **production env var** to the **full absolute URL**:

```
VITE_CLERK_PROXY_URL=https://adalahai.com/api/__clerk   (environment: production)
```

**Why full absolute URL:** Clerk v6 requires absolute URL for `proxyUrl`. Do NOT use relative `/api/__clerk`.

## Canonical App.tsx Wiring (use this verbatim)

```typescript
import { publishableKeyFromHost } from "@clerk/react/internal";

// Resolves pk_test in dev from env, pk_live in prod from hostname
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

// Empty in dev (intentional — Clerk uses dev FAPI directly), absolute URL in prod
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
```

**Why:** The canonical skill code uses `import.meta.env.VITE_CLERK_PROXY_URL` directly — no `_rawProxy` transformation needed — because we set it to the full absolute URL in the production env var.

**Old pattern (DO NOT USE):**
```typescript
// Wrong — had a _rawProxy runtime expansion; now set the absolute URL directly in env var
const _rawProxy = import.meta.env.VITE_CLERK_PROXY_URL;
const clerkProxyUrl = _rawProxy ? _rawProxy.startsWith("/") ? `${window.location.origin}${_rawProxy}` : _rawProxy : undefined;
```

## P0 Incident Root Cause (July 2026)

Production stuck on "جاري التحميل…" because:
1. `VITE_CLERK_PROXY_URL` was NEVER baked into production bundles → Clerk JS called `clerk.adalahai.com` DNS → DNS fails → `isLoaded=false` forever
2. App.tsx had non-canonical `publishableKeyFromHost` avoidance (due to old `.replit.app` issue that no longer applies on `adalahai.com`)

## Fix Applied

1. Set `VITE_CLERK_PROXY_URL=https://adalahai.com/api/__clerk` as production env var
2. Updated App.tsx to canonical pattern (publishableKeyFromHost + simple clerkProxyUrl)
3. Ran `setupClerkWhitelabelAuth()` to re-provision Clerk keys
4. Published new build

## publishableKeyFromHost Note

Previously avoided on `.replit.app` because it threw. On `adalahai.com` it works correctly — resolves `pk_live_Y2xlcmsuYWRhbGFoYWkuY29tJA` from the hostname automatically.

## Diagnosis Path

- Check `viewEnvVars({ keys: ["VITE_CLERK_PROXY_URL"] })` — must be set for production
- Search production bundle for `/api/__clerk` → if absent, proxy URL was not baked in → infinite loading
- `host_invalid` from curl of `/api/__clerk` in dev workspace is EXPECTED (dev uses test SK, prod uses live SK) — not a real error
