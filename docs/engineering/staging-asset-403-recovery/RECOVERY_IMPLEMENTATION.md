# Staging Asset 403 — Recovery Implementation

## Change set

| File | Role |
|------|------|
| `artifacts/api-server/src/lib/publicFrontendAssetPath.ts` | Strict allowlist: `/assets/*` (no `..` / dot segments) + small root file set |
| `artifacts/api-server/src/middlewares/productionFrontendStatic.ts` | Early gated static + missing-asset 404; late SPA fallback |
| `artifacts/api-server/src/app.ts` | Register early assets before Clerk; skip Clerk for allowlisted paths; SPA after `/api` |
| `artifacts/api-server/src/tests/frontendStaticDelivery.test.ts` | Regression: MIME, no auth JSON on assets, API still 403, wiring order |
| `artifacts/api-server/package.json` | `test:frontend-static` script |
| `.github/workflows/ci.yml` | Runs `test:frontend-static` in unit job |

## Security properties preserved

- No global auth disable; Clerk remains on all non-allowlisted routes including `/api/*`.
- Allowlist only — not “everything before Clerk.”
- Sensitive dot-paths (`/.env`, `/.git`, …) still 404 via `isSensitiveDotPath`.
- Missing `/assets/*` → `404 text/plain` (never SPA HTML, never auth JSON).
- Directory traversal under `/assets` rejected by allowlist (`..` / `/.`).
- RLS / tenant isolation / fail-closed session reset unchanged.
- Production secrets never injected into frontend bundles by this change.

## Middleware order (production)

1. Helmet, CORS, rate limits, body parsers (unchanged).
2. **`registerEarlyProductionFrontendAssets`** — gated static + asset 404.
3. Clerk gate with **`skipAuthForPublicFrontendAssets`**.
4. `/api` routers + isolation / guards.
5. **`registerProductionSpaFallback`** — HTML for non-API, non-asset GETs.
6. Global error handler.

## Rollback

1. Revert the PR commit on `develop` (or redeploy prior SHA).
2. Confirm Coolify staging points at previous image.
3. Expect recurrence of JSON 403 on `/assets/*` if rolled back without alternate fix.
