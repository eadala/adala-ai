# Engineering Lesson — Never Auth-Gate Compiled Frontend Assets

**Lesson ID:** STAGING-ASSET-403-2026-11

Compiled Vite assets under `/assets/*` are public, content-hashed, non-sensitive delivery units. Placing Clerk (or any API auth that returns JSON errors) **before** the static asset handler causes:

1. HTML to load,
2. JS/CSS to fail with JSON 403,
3. An indefinite pre-bootstrap loading screen that application-level timeouts cannot clear.

**Permanent guard:** `test:frontend-static` in CI asserts middleware order, MIME types, missing-asset 404 (non-HTML), and continued API 403 protection.

**Do not “fix” by disabling Clerk or Traefik Basic Auth.**
