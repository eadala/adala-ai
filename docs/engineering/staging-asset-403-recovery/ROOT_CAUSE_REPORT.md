# Staging Asset 403 — Root Cause Report

**Incident:** Staging (`https://staging.adalahai.com`) served HTML but first-party JS/CSS under `/assets/*` returned **HTTP 403** with **`Content-Type: application/json`**, leaving the SPA on the pre-React loading screen indefinitely.

**Classification (code):** Fixed in branch `cursor/staging-asset-403-recovery-da81`.  
**Live acceptance:** Blocked without Traefik Basic Auth credentials (outer staging ACL). Agent probes receive `401 Unauthorized` / `www-authenticate: Basic realm="traefik"`.

## Evidence chain

| Observation | Implication |
|-------------|-------------|
| HTML document 200/304 | SPA entry + outer proxy allow document GET |
| `/assets/*.js`, `/assets/*.css` → 403 JSON | Auth/API error middleware, not missing files or MIME misconfig alone |
| CSS labeled `application/json` | Response body is JSON error, not static CSS |
| Favicon / external fonts OK | Allowlisted or CDN paths; hashed Vite assets hit Clerk/auth path |
| Production assets historically 200 | Defect is middleware order / boundary, not Vite build absence |

## Responsible component

**Express application middleware order** in `artifacts/api-server/src/app.ts`:

1. `clerkMiddleware` (and related auth JSON error shaping) ran **before** production `express.static` / SPA handlers.
2. Requests for `/assets/index-*.js` (etc.) therefore entered Clerk/auth failure paths and returned **JSON 403**, never reaching the filesystem under `PUBLIC_DIR=/app/public`.

**Why HTML succeeded:** Document requests were either served earlier, cached, or fell through differently than hashed asset paths; hashed `/assets/*` consistently traversed auth.

**Why loading never ends:** Browser receives `index.html` but cannot execute bootstrap bundles → React never mounts → Clerk/`useClerkTimeout` never runs.

**Other environments:** Same middleware order exists in production Docker (`NODE_ENV=production`, `PUBLIC_DIR=/app/public`). Any environment where Clerk rejects or short-circuits asset requests before static can reproduce this. Staging showed it first because Development Clerk + redeploy timing interacted with the late static mount.

## Non-causes (ruled out for primary defect)

- Missing compiled assets in the image (would be 404 HTML/plain, not JSON 403).
- Cloudflare WAF alone (JSON shape matches app auth errors).
- Coolify mis-routing only HTML (favicon and fonts still load).
- Intentionally requiring Clerk for JS/CSS (no product requirement).

## Fix summary

Serve allowlisted public frontend assets **before** Clerk; skip Clerk for those paths; register SPA HTML fallback **after** `/api` routers. See `RECOVERY_IMPLEMENTATION.md`.
