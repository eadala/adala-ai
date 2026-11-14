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

## Dependency / failure notes ([Architecture fitness inventory](bc-5feb28bf-8c9a-5cd2-9e65-aa287b3dd0f8))

| Finding ID | Severity | Evidence | Mechanism |
|---|---|---|---|
| F-ARCH-001 | P1 | Crons + Stripe reconcile + EventBus SSE in API process (`index.ts`) | Restart/OOM kills HTTP and jobs; 512MB heap |
| F-ARCH-002 | P1 | Single shared `pool` (`lib/db/src/index.ts`) no max/timeout | Global saturation |
| F-ARCH-003 | P1 | Dual payment stacks: orchestrator vs payments module Moyasar URLs | Drift / change amplification |
| F-ARCH-004 | P1 | `callAI` hub + unstable call sites (arg-order mismatch risk) | Latent behavioral bugs |
| F-ARCH-005 | P1 | Stripe boot: `stripe-replit-sync` side-effects every start | Vendor schema coupling |
| F-ARCH-006 | P2 | Flat ~100 router mounts; raw SQL dominates thin Drizzle schema | Schema change cost |
| F-ARCH-007 | P2 | JLWM demo seed on production boot path | Startup race / noise |
| F-ARCH-008 | P2 | Empty `lib/integrations/*` glob; `services/*` outside Dockerfile | Orphaned architecture |

## Recommendation (minimal)

Keep modular monolith. Split worker process for crons/backups; unify payment + AI gateways. Do **not** default to microservices.
