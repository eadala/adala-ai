# Observability & SRE

## Present capabilities (code)

| Capability | Location | Runtime in this env |
|---|---|---|
| Structured logs (pino) | `lib/logger`, pino-http in `app.ts` | Assumed when server runs |
| Request/correlation IDs | `middlewares/requestId.ts` | Code review PASS |
| OTEL traces | `observability/tracer.ts` — gated on `OTEL_EXPORTER_OTLP_ENDPOINT` | **Not active here** (endpoint unset) |
| Prometheus middleware | `observability/prometheus` | Code present |
| Sentry | `app.ts` if `SENTRY_DSN` | Env-gated |
| Health score / metrics | `observability/healthcheck.ts`, `metrics.ts` | Used by monitoring cron |
| Liveness `/api/healthz` | `app.ts:52` | Always OK — no DB |
| Deep health | monitoring routes + systemHealthCheck | Not tied to Coolify HEALTHCHECK |

## Gaps ([Observability SRE inventory](bc-bba5d35d-796f-5e14-8f40-620e214b50c6))

| ID | Sev | Gap | Consequence |
|---|---|---|---|
| F-OBS-001 | P0 | No readiness distinct from liveness | Broken-DB instances stay in pool |
| F-OBS-002 | P1 | OTEL/Sentry env-gated; live scrape/export not verified here | Blind spots |
| F-OBS-003 | P1 | In-process business metrics helpers largely unwired (`recordRequest`/`recordAiRequest`/… mostly dead; used from simulate) | Cron/alert composites under-signal |
| F-OBS-004 | P1 | `collectMetrics` hardcodes `stripeHealth`/`apiHealth` true | Hides provider degradation |
| F-OBS-005 | P2 | `pino-http` before `requestIdMiddleware` — access logs use pino `req.id`, not `X-Correlation-Id` | Trace join friction |
| F-OBS-006 | P2 | Dual alert paths (smart alerts + Alertmanager) without shared suppress | Noise / double-page |
| F-OBS-007 | P2 | No formal SLO/error-budget burn alerts | Ops reactive only |

## Candidate SLIs

Availability, latency p95, 5xx rate, cron completion ratio, AI provider error rate, payment webhook success, backup job success, restore drill freshness.
