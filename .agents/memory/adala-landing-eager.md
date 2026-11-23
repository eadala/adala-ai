---
name: Adala Landing Eager Import
description: Why Landing must be eagerly imported (not lazy) to avoid production blank-screen bug
---

## Rule
`Landing` in `App.tsx` MUST be a top-level eager import, NOT a `lazy()` import.

```ts
// ✅ CORRECT
import Landing from "@/pages/landing";

// ❌ WRONG — causes blue-screen in production
const Landing = lazy(() => import("@/pages/landing"));
```

`HomeRedirect` renders `<Landing />` directly — no Suspense wrapper.

## Why
Forensic investigation of the production blank-blue-screen bug revealed:
- `publishableKeyFromHost()` throws in production (caught by try/catch, fallback live key used)
- Clerk initialization can be slower in production even when proxy works correctly
- While Clerk was initializing (`isLoaded=false`), HomeRedirect rendered `<Suspense fallback={<blue div>}><Landing /></Suspense>`
- The blue `#0F1B35` Suspense fallback showed while the Landing JS chunk was downloading
- Users saw only the blue fallback — giving the impression of a broken blank page
- Making Landing eager eliminates the Suspense entirely → Landing renders immediately at React mount

## How to apply
- If Landing is ever split into a lazy chunk again, wrap it in its own Suspense INSIDE HomeRedirect — but use a meaningful spinner, not a full-screen colored div
- Never use `style={{ background: "#0F1B35" }}` as a Suspense fallback for full-page routes — it's indistinguishable from a broken app
