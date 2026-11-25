# Staging Asset 403 — Security Regression Verification

| Control | Expected | Verified how |
|---------|----------|--------------|
| Assets not auth-blocked | `/assets/*.js\|css` → 200 + correct MIME | `test:frontend-static` |
| API still protected | `/api/*` without auth → 403 JSON | same test |
| Sensitive paths | `/.env` → 404 | same + `test:stage9-security` |
| Traversal | `/assets/../.env` not 200 with secrets | `test:frontend-static` |
| Missing asset | 404 plain, not SPA HTML | `test:frontend-static` |
| Wiring order | Early assets → Clerk → `/api` → SPA | string/order asserts in tests |
| RLS / tenant | Unchanged code paths | no edits to tenant/RLS modules |
| Clerk secret in FE | Not introduced | Dockerfile still build-arg publishable only |

**Fail-open prohibited:** Fix does not disable Clerk, RLS, or staging Traefik Basic Auth.
