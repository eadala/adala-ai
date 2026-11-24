---
name: Adala Vite Radix Chunking
description: How to configure Vite/Rollup manualChunks for @radix-ui — any grouping causes TDZ or React namespace errors
---

## Rule
NEVER put `@radix-ui/*` packages into a manual Rollup chunk. Let Rollup decide automatically.

## What was tried and why it failed

| Approach | Error |
|---|---|
| All Radix → `vendor-radix` (one chunk) | `Cannot access 'Xt' before initialization` (TDZ from circular deps) |
| All Radix → `vendor-misc` catch-all + `hoistTransitiveImports:false` | `undefined is not an object (B.Children)` — React never initialized |
| Each Radix package → individual `radix-<pkg>` chunks | `undefined is not an object (t.useLayoutEffect)` — React namespace broken |

## Correct config (vite.config.ts)

```ts
rollupOptions: {
  output: {
    manualChunks(id) {
      if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/")) return "vendor-react";
      if (id.includes("node_modules/@clerk/"))       return "vendor-clerk";
      if (id.includes("node_modules/@tanstack/"))    return "vendor-tanstack";
      if (id.includes("node_modules/wouter"))        return "vendor-router";
      if (id.includes("node_modules/recharts") || id.includes("node_modules/d3-")) return "vendor-charts";
      if (id.includes("node_modules/lucide-react"))  return "vendor-icons";
      if (id.includes("node_modules/i18next") || id.includes("node_modules/react-i18next")) return "vendor-i18n";
      // @radix-ui → NO rule → Rollup automatic chunking
      // vendor-misc catch-all → REMOVED (would lump Radix with everything else)
    }
  }
}
```

**Why:** Rollup's automatic algorithm uses the real import graph to determine chunk boundaries and initialization order, correctly handling Radix's internal circular dependencies. Any forced grouping defeats this.

## Related: blank page root cause chain (production)
1. `publishableKeyFromHost` → corrupts Clerk singleton → blank (fixed: use VITE_CLERK_PUBLISHABLE_KEY directly)
2. Radix `vendor-radix` chunk → TDZ circular dep → blank (fixed: remove vendor-radix)
3. Radix per-package chunks → React namespace broken → blank (fixed: let Rollup decide)
