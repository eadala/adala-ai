# Staging Asset 403 — Root Cause Report (Evidence-Corrected)

**Incident:** Staging (`https://staging.adalahai.com`) served HTML but first-party JS/CSS under `/assets/*` returned **HTTP 403** with **`Content-Type: application/json`**, leaving the SPA on the pre-React loading screen indefinitely.

## Responsible component (verified)

**`evaluateCorsOrigin` / Express CORS middleware** in:

* `artifacts/api-server/src/lib/corsOriginPolicy.ts`
* wired from `artifacts/api-server/src/app.ts` (CORS runs **before** static asset delivery)

### Triggering condition

1. Vite emits module/script and stylesheet tags with the **`crossorigin`** attribute.
2. The browser therefore sends `Origin: https://staging.adalahai.com` on those asset GETs (even though the Host is the same site).
3. Historical allowlist accepted only `https://adalahai.com`, `https://www.adalahai.com`, `ALLOWED_ORIGINS`, and `localhost`.
4. Staging Origin was **not** allowed → `createCorsOriginRejectedError` → **`403` + `application/json`** with `code: CORS_ORIGIN_NOT_ALLOWED` via `globalErrorHandler`.
5. React never executes → indefinite loading screen.

### Live reproduction (production host, sanitized)

Executed 2026-11-25 (Asia/Riyadh):

| Request | Result |
|---------|--------|
| `GET https://adalahai.com/assets/vendor-react-*.js` (no Origin) | **200** `text/javascript` |
| Same + `Origin: https://adalahai.com` | **200** `text/javascript` |
| Same + `Origin: https://staging.adalahai.com` | **403** `application/json` `CORS_ORIGIN_NOT_ALLOWED` |
| Same + `Origin: https://evil.example` | **403** `application/json` `CORS_ORIGIN_NOT_ALLOWED` |

Body shape matches the staging DevTools observation (JSON, not CSS/JS).

### Why HTML / favicon / fonts succeeded

* Document navigation typically omits `Origin` → CORS allow (`missing-origin`).
* Favicon / many image loads do not use CORS mode `cors`.
* External fonts are third-party and unrelated to this allowlist.

### Secondary concern (middleware order)

Clerk previously sat **before** late `express.static`. Serving allowlisted assets before Clerk remains a valid defense-in-depth boundary, but **cannot** fix this incident alone because **CORS rejects the request first**.

A miniature mock-auth harness that only models “auth after static” can go green without detecting the CORS defect. Differential coverage is therefore mandatory (`test:frontend-static-cors`).

### Why prior tests missed it

* No regression asserting staging Origin on `/assets/*`.
* CORS tests covered beacons / production domains, not staging Host/Origin asset loads.
* Production continued to work for `adalahai.com` Origins, masking staging misconfiguration.

### Other environments

Any Coolify/preview hostname not present in `PRODUCTION_CORS_DOMAINS` / `ALLOWED_ORIGINS` can reproduce the same JSON 403 on Vite `crossorigin` assets. Same-origin Host matching + explicit staging allowlist closes that class of failure.
