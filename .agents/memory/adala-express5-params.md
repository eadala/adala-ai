---
name: Adala Express 5 req.params fix patterns
description: How to correctly handle req.params in Express 5 — avoids TS2769 "No overload" and string|string[] errors in route handlers
---

## The Rule
Express 5 types `req.params` as `ParamsDictionary` which TypeScript resolves as `{}` for routes without declared params in the path string, and `string | string[]` for declared params.

**Why:** Express 5 broke the `req.params.id` being `string` assumption. Drizzle ORM's `eq()` rejects `string | string[]`, causing TS2769 "No overload" errors.

## How to Apply

### Direct access (inline):
```ts
// Before: req.params.id  →  string | string[]  ❌
// After:  String(req.params.id)  →  string  ✅
eq(table.column, String(req.params.id))
parseInt(String(req.params.id))
```

### Destructured access:
```ts
// Before: const { id } = req.params;  → string | string[] ❌
// After:  const { id } = req.params as Record<string, string>;  ✅
const { id, officeId } = req.params as Record<string, string>;
```

### Routes with NO `:id` in path string get `req.params` typed as `{}`:
```ts
// BUG: route is "/admin/promo" but uses req.params.id
router.delete("/admin/promo", ...)   // req.params = {}  ❌
// FIX: add :id to path
router.delete("/admin/promo/:id", ...)  // req.params = { id: string }  ✅
```

## Gotcha: Regex that converts `as string | undefined`
If a sed/python regex replaces `req.query.X as string | undefined` with `String(req.query.X) | undefined`, the `|` becomes bitwise OR (TS2362 arithmetic error).
Fix: revert to `req.query.X as string | undefined`.

## Gotcha: Variable name splitting
If String() wrapping regex uses negative lookahead `(?!\))`, it truncates variable names:
- `req.params.slug)` → `String(req.params.slu)g)` ❌
Fix script: `re.sub(r'String\(req\.params\.([a-zA-Z_]+)\)([a-zA-Z_]+)', ...)`
