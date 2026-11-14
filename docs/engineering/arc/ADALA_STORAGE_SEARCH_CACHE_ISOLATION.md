# Storage, Search & Cache Isolation

## Storage

| Control | Status |
|---|---|
| Auth on signed URL | VERIFIED static (`storageSignedOpen.test.ts`) |
| `office_id` filter | VERIFIED static |
| Canonical key ownership | VERIFIED helper design (`storageObjectOwnership.ts`) |
| Path prefix alone insufficient | Acknowledged — ownership uses DB refs |
| Cross-tenant signed URL theft | NOT_TESTED runtime |
| Upload / delete adversarial | NOT_TESTED runtime |

## Search

FTS readiness migrations and message tenant tests exist (static). Adversarial cross-tenant search result leakage: **NOT_TESTED**.

## Cache

| Cache | Risk | Status |
|---|---|---|
| `tenantMiddleware` user→office Map TTL 5m | Stale membership after revoke | MEDIUM residual |
| HTTP/CDN caches | NOT_TESTED | — |
| AI response caches | NOT_TESTED | — |

## Verdict

**STORAGE: PARTIAL VERIFIED (controls present) / SEARCH_CACHE: UNVERIFIED adversarial.**
