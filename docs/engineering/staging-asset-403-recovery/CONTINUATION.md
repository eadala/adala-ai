# Continuation State — Future Agents

## Done

* Root cause corrected to CORS Origin rejection on Vite `crossorigin` asset GETs (live-proven).
* Fix: same-origin Host match + `STAGING_CORS_DOMAINS`.
* Defense-in-depth: early allowlisted static before Clerk retained.
* Tests: Layer 1 + differential (fails on broken baseline) + real Express app integration.
* Docs + gate matrix under this directory.
* PR: https://github.com/eadala/adala-ai/pull/188 → `develop`

## Not done (genuine blockers)

1. Traefik Basic Auth credentials for `staging.adalahai.com` — required for G14–G16.
2. Coolify access to confirm deployed SHA / `DATABASE_URL` / Clerk Dev isolation (G11, G14).
3. Staging test user for authenticated dashboard (G16).
4. Local Docker CLI in agent VM (G06 local); rely on CI docker job after push.

## Do not

* Disable Clerk/CORS/RLS/Traefik to “make staging load.”
* Treat mock-auth-only green tests as operational recovery.
* Deploy or modify production.
