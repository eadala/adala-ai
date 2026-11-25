# Docker & Static Asset Delivery Contract

## Build

1. Vite builds `@workspace/adala` → `artifacts/adala/dist-stable/`.
2. Production image copies that tree to `/app/public` (`Dockerfile`).
3. `PUBLIC_DIR=/app/public`, `NODE_ENV=production`, process user `adala`.

## Runtime serving rules

| Path class | Handler | Auth |
|------------|---------|------|
| `/assets/<file>` (allowlisted) | Early `express.static` | Skipped (Clerk) |
| Exact public files (`/favicon.svg`, …) | Early static | Skipped |
| Missing allowlisted asset | `404 text/plain` | N/A |
| `/api/*` | API routers | Clerk + guards + RLS |
| Other GET (SPA routes) | Late `index.html` | Clerk middleware runs; typically allows document |
| `/.env`, `/.git`, … | `404` | Blocked |

## MIME

- JS → `application/javascript` (or equivalent JS MIME from `send`).
- CSS → `text/css`.
- HTML → `text/html`.

## Non-goals

- Do not serve source trees, `.env`, or arbitrary disk paths.
- Do not SPA-fallback missing `.js` / `.css` under `/assets`.
