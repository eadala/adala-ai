# Staging Asset 403 — Security Regression Verification

| Control | Expected | Verified how |
|---------|----------|--------------|
| Staging Origin assets | 200 + JS/CSS MIME | `test:frontend-static-cors`, `test:frontend-static-prod` |
| Broken baseline still fails | staging Origin → 403 JSON | `test:frontend-static-cors` broken mode |
| Evil Origin | still 403 `CORS_ORIGIN_NOT_ALLOWED` | cors + cors-incident + prod-app |
| No Host reflection | spoofed Host cannot grant CORS | `test:cors-origin` |
| ALLOWED_ORIGINS validation | wildcards/paths dropped | `test:cors-origin` |
| Localhost in production | rejected when `NODE_ENV=production` | `test:cors-origin` |
| API still protected | `/api/*` → 401/403 JSON | prod-app + static suites |
| Sensitive paths | `/.env` → 404, no secret leak | prod-app + stage9 |
| Traversal | `/assets/../.env` not secret-bearing 200 | `test:frontend-static` |
| Missing asset | 404 plain, not SPA HTML | cors-incident + static |
| Early static before Clerk | wiring order | `test:frontend-static` |
| RLS / tenant | Unchanged | no tenant/RLS edits |
| Clerk secret in FE | Not introduced | Dockerfile publishable-only |

**Fail-open prohibited:** Fix does not disable Clerk, CORS for unknown Origins, RLS, or Traefik Basic Auth.
