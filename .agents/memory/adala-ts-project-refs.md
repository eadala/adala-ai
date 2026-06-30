---
name: Adala TypeScript Project References (REMOVED)
description: Why references were removed from adala tsconfig and how libs are resolved instead
---

## Rule
Do NOT add "references" to artifacts/adala/tsconfig.json.

## Why
Both lib/api-client-react and lib/object-storage-web export TypeScript source directly:
  package.json "exports": { ".": "./src/index.ts" }

TypeScript composite references require pre-built .d.ts output in dist/.
But CI has no pre-build step and dist/ is gitignored → TS6305 on every CI run.

## How resolution actually works
- moduleResolution: "bundler" reads package.json exports field
- allowImportingTsExtensions: true allows resolving .ts files
- TypeScript reads lib source directly via pnpm workspace symlinks
- No dist build needed — works in CI fresh checkout without any extra steps

## How to apply
If you need to add a new shared lib under lib/ that the frontend uses:
1. Set package.json "exports": { ".": "./src/index.ts" } in the lib
2. Add the lib as "@workspace/your-lib": "workspace:*" dep in artifacts/adala/package.json
3. DO NOT add it to "references" in artifacts/adala/tsconfig.json

## Bundle measurement
CI bundle check uses gzip-compressed size (not du -k block-aligned size).
Gzip total: ~1649KB | Budget: 4096KB | Headroom: 59%
The du -k measurement is misleading: 6468KB (inflated) vs 6024KB (actual bytes).
