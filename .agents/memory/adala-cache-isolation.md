---
name: Adala cache isolation
description: Memory limits, tenant cache isolation, and organized deletion patterns
---

## Rules

### Node.js heap limit
`--max-old-space-size=350` in api-server/package.json start script. MUST stay — without it Node can consume unlimited RAM.

### Server cache (cache.ts)
- MAX_ENTRIES = 500 (LRU-lite eviction: expired first, then oldest 10%)
- `cache.flushTenant(tenantId)` — removes all keys containing tenantId (use on office data change)
- `cache.flush("prefix:")` — prefix-based flush
- `cache.clear()` — full wipe (emergency/admin only)

### React Query (App.tsx QueryClient)
- `gcTime = 10min` (NOT 30min) — stale office data freed faster, prevents cross-tenant data lingering
- `staleTime = 5min` — keeps fresh, avoids duplicate requests

### ClerkQueryClientCacheInvalidator
On user change: use `qc.removeQueries({ predicate })` NOT `qc.clear()`.
- KEEP: "landing-variant-public", "home-cms", "pricing-plans" (public, shared)
- REMOVE: all other queries (user/office-scoped data)
- Then: `qc.invalidateQueries({ refetchType: "none" })` to mark remaining stale

**Why:** qc.clear() wipes everything including public data cached for performance. Selective removal prevents cross-tenant data leaking while keeping shared cache warm.
