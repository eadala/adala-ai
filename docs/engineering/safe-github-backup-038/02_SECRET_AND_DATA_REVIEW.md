# Secret and Data Review (no values printed)

## Scope scanned

- Tip `9f631490…` tree + Phase 031 tip objects
- Tracked path name heuristics for env/keys/dumps
- `docker-compose.yml`, `.env.example`, `healSecret.ts`
- Large blobs (>5MB)

## Findings

| Path | Class | Remediation before public/remote backup |
|------|-------|----------------------------------------|
| `.env.example` (`CLERK_SECRET_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) | Short `sk_live_` / `whsec_` **prefix shapes** (len ~9–11) — likely placeholders | Confirm placeholders; prefer `sk_test_` / `REPLACE_ME` wording; never use live-shaped samples |
| `docker-compose.yml` `POSTGRES_PASSWORD` | Non-substitution **literal** (len=10) | Replace with `${POSTGRES_PASSWORD}` or documented local-only placeholder; rotate if ever used outside synthetic local |
| `artifacts/api-server/src/lib/healSecret.ts` | Uses env; also contains long string literal(s) (len=21) | Confirm test-only defaults; ensure not a production secret |
| `docs/.../phase-031-8685f64a.bundle` (~39MB) | Large binary | Prefer Git LFS, Release asset, or private object store — not ideal on public git history |
| `docs/.../master-032r-checkpoint.bundle` (~78MB) | Large binary | Same |

## Not found in HEAD tree

- Committed `.env` (non-example)
- `.pem` / `id_rsa`
- Database dumps / `.sql.gz`
- Client document corpora (by name heuristic)

**SECRET_SCAN:** `FINDINGS_REQUIRE_CONFIRMATION` — not a clean PASS; values not exposed here.
