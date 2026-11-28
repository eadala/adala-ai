# Independent Adversarial Review (Author-Challenge Pass)

| # | Question | Finding | Severity | Disposition |
|---|----------|---------|----------|-------------|
| 1 | Can new asset serving expose unintended files? | Allowlist + `isSensitiveDotPath`; `.env` 404 in prod-app test | — | OK |
| 2 | Protected route via alternate path? | `/api/*` still auth-gated in real app test | — | OK |
| 3 | Encoded traversal / Host spoof CORS? | Asset allowlist rejects `..`; CORS does **not** trust Host/`X-Forwarded-Host` | — | OK |
| 4 | Auth bypass via route precedence? | Early static only for allowlisted paths; Clerk skip scoped | — | OK |
| 5 | Tenant isolation bypass? | No tenant middleware changes | — | OK |
| 6 | Secrets in FE artifacts? | No new Vite env secrets; `.env` not served | — | OK |
| 7 | Stale HTML → missing assets? | Missing `/assets` → 404 plain (not SPA) | — | OK |
| 8 | Tests pass while Docker fails? | Docker CLI BLOCKED here; CI docker job required | P1 | Operator/CI must confirm after push |
| 9 | Staging → production resources? | Not verifiable without Coolify | P1 | BLOCKED — operator verify `DATABASE_URL` / Clerk Dev |
| 10 | Silent reintroduction? | Differential CORS test + CI wiring | — | OK |

**Prior false lead:** Treating mock-auth-after-static as the sole root cause would have left the CORS defect intact. Corrected by live Origin probes + differential harness.
