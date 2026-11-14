# Architecture Fitness

## Actual topology (observed)

Modular monolith:

- `artifacts/api-server` — Express API + colocated crons
- `artifacts/adala` — Vite/React SPA (wouter, RTL)
- `lib/db` — shared Drizzle schema + single `pg.Pool`
- `artifacts/arc-server` / `arc-console` — separate control plane
- `infra/` — docker, nginx, postgres, monitoring stubs

## Module map (`artifacts/api-server/src/modules`)

| Domain | Approx `.ts` files |
|---|---|
| platform | 43 |
| ai | 34 |
| jlwm | 18 |
| financial | 18 |
| operations | 17 |
| legal-core | 17 |
| monitoring | 7 |
| marketplace | 7 |
| security | 6 |
| integrations | 6 |
| bankruptcy | 5 |
| documents | 1 |
| auth | 1 |

Composition: `src/routes/index.ts` mounts dozens of routers; `src/app.ts` wires Clerk, Sentry, helmet, rate-limit, healthz-first.

## Dependency / failure notes

| Finding ID | Severity | Evidence | Mechanism |
|---|---|---|---|
| F-ARCH-001 | P1 | Crons in same process as HTTP (`src/cron/*` started with API) | CPU/memory/event-loop contention; deploy restart kills jobs |
| F-ARCH-002 | P1 | Single shared `pool` in `lib/db/src/index.ts` with no max/timeout | Global saturation → all domains fail together |
| F-ARCH-003 | P2 | Large `platform` + `ai` surface; many sibling financial routers | Change amplification; testing difficulty |
| F-ARCH-004 | P2 | External coupling: Clerk, Stripe/Moyasar, Meta WhatsApp, R2/S3, AI providers | Synchronous provider failures propagate without uniform bulkheads |
| F-ARCH-005 | P2 | ARC separate (good) but Coolify/GitHub boundary documented, not CI-enforced promotion gates | Release complexity |

## Recommendation (minimal)

Keep modular monolith. Introduce explicit **worker process boundary** for crons/backups; keep HTTP API thin. Do **not** split microservices by default.
