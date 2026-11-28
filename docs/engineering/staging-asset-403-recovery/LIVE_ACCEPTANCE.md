# Live Staging Acceptance Evidence

**Date (Asia/Riyadh):** 2026-11-25

## Live Origin probe (production host — evidences the defect class)

| Check | Result |
|-------|--------|
| `GET /assets/vendor-react-*.js` no Origin | **200** `text/javascript` |
| Same + `Origin: https://adalahai.com` | **200** |
| Same + `Origin: https://staging.adalahai.com` | **403** `application/json` `CORS_ORIGIN_NOT_ALLOWED` |
| Same + `Origin: https://evil.example` | **403** JSON |

This matches staging DevTools (JSON 403 on JS/CSS with Vite `crossorigin`).

## Staging URL (agent)

| Check | Result |
|-------|--------|
| `GET https://staging.adalahai.com/` | **401** Traefik Basic Auth |
| Asset follow-up on staging | **BLOCKED** — no Basic Auth credentials |

## Automated (this recovery branch)

| Command | Result |
|---------|--------|
| `test:cors-origin` | PASS |
| `test:frontend-static-cors` (broken baseline + fixed) | PASS |
| `test:frontend-static` | PASS |
| `test:frontend-static-prod` (real `app`) | PASS |
| `test:stage9-security` | PASS |
| `tsc --noEmit` | PASS |
| Local Docker smoke | BLOCKED (no Docker CLI) |

## Operator checklist (after merge + Coolify redeploy + Basic Auth)

- [ ] Confirm Coolify staging `ALLOWED_ORIGINS` includes `https://staging.adalahai.com` (belt-and-suspenders)
- [ ] Deployed SHA matches recovery commit
- [ ] Browser: all HTML-referenced `/assets/*` → 200 + correct MIME
- [ ] No `CORS_ORIGIN_NOT_ALLOWED` on first-party assets
- [ ] React + Clerk sign-in render
- [ ] Staging DB / Clerk Dev isolation confirmed
- [ ] Production unchanged

## CI (2026-11-28 Asia/Riyadh)

PR #188 @ `fb6a6302`: **All Gates Passed**. Merge blocked: `REVIEW_REQUIRED`.

Operator smoke after deploy + Basic Auth:

`node scripts/staging/smoke-asset-delivery.mjs` (env: `STAGING_BASIC_AUTH_USER` / `STAGING_BASIC_AUTH_PASS`).

## Classification

**STAGING PARTIALLY RECOVERED — BLOCKERS REMAIN**
(code + CI verified; live Traefik/Coolify/merge approval pending owner)
