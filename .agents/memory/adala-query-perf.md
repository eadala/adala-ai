---
name: Adala query performance
description: TanStack Query caching defaults + safe refetch intervals + vite chunking patterns
---

# Adala Query Performance Configuration

## QueryClient Global Defaults (App.tsx)
```ts
staleTime: 5 * 60_000   // 5 min — don't re-fetch while data is fresh
gcTime: 30 * 60_000     // 30 min — keep cache in memory after last use
refetchOnWindowFocus: false
refetchOnReconnect: "always"
retry: 1
```

**Why:** The old defaults (staleTime=1min, gcTime=5min) caused duplicate API calls every minute across all mounted components. 5min staleTime means navigating between pages doesn't trigger new requests until data is genuinely old.

## Safe refetchInterval Floors
| Page type | Minimum interval |
|-----------|-----------------|
| Dashboard KPIs | 5 min |
| Live support chat | 25s (not 8s) |
| Live feed / activity stream | 60s |
| Attendance records | 2 min |
| Message counts | 60s |
| Reminders list | 2 min |
| Admin status checks | 60s |

**Why:** Any interval under 30s on a non-realtime page generates unnecessary load. The 8s interval in super-admin support chat was the worst offender.

## Vite manualChunks — Function Pattern
Use a function, not a plain object, so edge cases (double-matching packages) are handled deterministically:
```ts
manualChunks(id) {
  if (id.includes("node_modules/react/")) return "vendor-react";
  if (id.includes("node_modules/@clerk/")) return "vendor-clerk";
  if (id.includes("node_modules/@tanstack/")) return "vendor-tanstack";
  if (id.includes("node_modules/recharts") || id.includes("node_modules/d3-")) return "vendor-charts";
  if (id.includes("node_modules/@radix-ui/")) return "vendor-radix";
  if (id.includes("node_modules/lucide-react")) return "vendor-icons";
  if (id.includes("node_modules/@stripe/")) return "vendor-stripe";
  if (id.includes("node_modules/i18next")) return "vendor-i18n";
  if (id.includes("node_modules/")) return "vendor-misc";
}
```

## Vite Plugin Warning
Do NOT add babel plugins to `react()` in vite.config.ts without first installing them:
```ts
// WRONG — breaks build if @babel/plugin-transform-react-jsx not installed:
react({ babel: { plugins: [["@babel/plugin-transform-react-jsx", ...]] } })

// CORRECT — react() handles JSX out of the box:
react()
```
