# Engineering Lesson — CORS + Vite `crossorigin` Can Kill SPA Bootstrap

**Lesson ID:** STAGING-ASSET-403-2026-11

Vite emits `crossorigin` on JS/CSS. Browsers send `Origin: <site>` on those GETs. If the Express CORS allowlist omits the staging hostname, assets return **`403 application/json` (`CORS_ORIGIN_NOT_ALLOWED`)** while HTML still loads → indefinite loader.

Secondary lesson: middleware order (Clerk before static) is a real risk, but a green mock-auth harness is not proof of operational recovery. Require:

1. Differential test that fails on the broken baseline.
2. Real `app` integration with `Origin: staging…`.
3. Live Origin probes / browser acceptance when access exists.

**Permanent guards:** `test:frontend-static-cors`, `test:frontend-static-prod`, `test:cors-origin` in CI.

**CORS hardening:** use an explicit trusted-origin allowlist. Never reflect `Host` / `X-Forwarded-Host`. Never allow wildcards.

**Do not “fix” by disabling Clerk, CORS, RLS, or Traefik Basic Auth.**
